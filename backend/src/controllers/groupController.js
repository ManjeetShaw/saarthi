const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, setPaginationHeaders } = require('../utils/pagination');

const { getOwnedCourse, getEnrollment } = require('../utils/access');

// Student creates a group inside a course they are enrolled in and becomes
// its leader (and first member). A student can be in only one group per
// course — the database enforces it, we check first to give a clear message.
const createGroup = asyncHandler(async (req, res) => {
  const { name, course_id } = req.body;
  const courseId = Number(course_id);

  if (!(await getEnrollment(courseId, req.user.id))) {
    throw new AppError(403, 'You can only create groups in courses you are enrolled in');
  }
  const already = await pool.query(
    'SELECT g.name FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.course_id = $1 AND gm.user_id = $2',
    [courseId, req.user.id]
  );
  if (already.rows.length) {
    throw new AppError(409, `You are already in "${already.rows[0].name}" for this course. Leave it before creating another group.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const group = await client.query(
      `INSERT INTO groups (name, leader_id, course_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, req.user.id, courseId]
    );
    await client.query(
      `INSERT INTO group_members (group_id, user_id, course_id) VALUES ($1, $2, $3)`,
      [group.rows[0].id, req.user.id, courseId]
    );
    await client.query('COMMIT');
    res.status(201).json(group.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Add a member by email or student_id — only the leader can add members,
// and the student must be enrolled in the group's course and not already in
// another group there.
const addMember = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { email, student_id } = req.body;

  const group = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) throw new AppError(404, 'Group not found');
  if (group.rows[0].leader_id !== req.user.id) {
    throw new AppError(403, 'Only the group leader can add members');
  }
  const courseId = group.rows[0].course_id;

  const userQuery = email
    ? await pool.query(`SELECT id, name FROM users WHERE email = $1 AND role = 'student'`, [email.toLowerCase()])
    : await pool.query(`SELECT id, name FROM users WHERE student_id = $1 AND role = 'student'`, [student_id]);

  if (!userQuery.rows.length) throw new AppError(404, 'No student account matches that email or student ID.');
  const member = userQuery.rows[0];

  if (!(await getEnrollment(courseId, member.id))) {
    throw new AppError(400, `${member.name} is not enrolled in this course yet.`);
  }

  const existing = await pool.query(
    'SELECT group_id FROM group_members WHERE course_id = $1 AND user_id = $2',
    [courseId, member.id]
  );
  if (existing.rows.length) {
    throw new AppError(
      409,
      existing.rows[0].group_id === Number(groupId)
        ? `${member.name} is already in this group.`
        : `${member.name} is already in another group for this course.`
    );
  }

  await pool.query(
    `INSERT INTO group_members (group_id, user_id, course_id) VALUES ($1, $2, $3)`,
    [groupId, member.id, courseId]
  );
  res.status(201).json({ message: 'Member added', member });
});

// Leader removes a member (cannot remove the leader themselves — use deleteGroup for that)
const removeMember = asyncHandler(async (req, res) => {
  const { groupId, userId } = req.params;

  const group = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) throw new AppError(404, 'Group not found');
  if (group.rows[0].leader_id !== req.user.id) {
    throw new AppError(403, 'Only the group leader can remove members');
  }
  if (Number(userId) === group.rows[0].leader_id) {
    throw new AppError(400, 'The leader cannot be removed — delete the group instead');
  }

  await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  res.json({ message: 'Member removed' });
});

// A non-leader member removes themselves from the group
const leaveGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const group = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) throw new AppError(404, 'Group not found');
  if (group.rows[0].leader_id === req.user.id) {
    throw new AppError(400, 'The leader cannot leave — delete the group instead');
  }

  const result = await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *',
    [groupId, req.user.id]
  );
  if (!result.rows.length) throw new AppError(404, 'You are not a member of this group');
  res.json({ message: 'You left the group' });
});

// Leader deletes the group entirely (cascades to memberships, targets, and submissions)
const deleteGroup = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const group = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) throw new AppError(404, 'Group not found');
  if (group.rows[0].leader_id !== req.user.id) {
    throw new AppError(403, 'Only the group leader can delete the group');
  }

  await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
  res.json({ message: 'Group deleted' });
});

// Groups the logged-in student belongs to (naturally small — one user's own
// memberships), with the course and leader so the UI can label them.
const myGroups = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT g.*, c.code AS course_code, c.title AS course_title, lu.name AS leader_name,
            (g.leader_id = $1) AS is_leader,
            (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     LEFT JOIN courses c ON c.id = g.course_id
     JOIN users lu ON lu.id = g.leader_id
     WHERE gm.user_id = $1
     ORDER BY c.code, g.name`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Member list for one group — restricted to the professor of the group's
// course and to the group's own members, so a student can't enumerate the
// roster of a group they're not in.
const groupMembers = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const group = await pool.query('SELECT id, leader_id, course_id FROM groups WHERE id = $1', [groupId]);
  if (!group.rows.length) throw new AppError(404, 'Group not found');

  if (req.user.role === 'admin') {
    await getOwnedCourse(group.rows[0].course_id, req.user.id);
  } else {
    const membership = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    if (!membership.rows.length) {
      throw new AppError(403, 'You are not a member of this group');
    }
  }

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.student_id, (u.id = g.leader_id) AS is_leader
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY (u.id = g.leader_id) DESC, u.name`,
    [groupId]
  );
  res.json(result.rows);
});

// Professor: groups in the courses they teach (optionally one course), with
// member counts. Paginated (X-Total-Count etc.) since it grows with enrollment.
const allGroups = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const courseId = req.query.course_id ? Number(req.query.course_id) : null;

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT g.*, u.name AS leader_name, c.code AS course_code, c.title AS course_title,
              (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count
       FROM groups g
       JOIN users u ON u.id = g.leader_id
       JOIN courses c ON c.id = g.course_id AND c.professor_id = $1
       WHERE ($2::int IS NULL OR g.course_id = $2)
       ORDER BY c.code, g.name
       LIMIT $3 OFFSET $4`,
      [req.user.id, courseId, pagination.limit, pagination.offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM groups g
       JOIN courses c ON c.id = g.course_id AND c.professor_id = $1
       WHERE ($2::int IS NULL OR g.course_id = $2)`,
      [req.user.id, courseId]
    ),
  ]);

  setPaginationHeaders(res, pagination, Number(countResult.rows[0].count));
  res.json(result.rows);
});

module.exports = {
  createGroup, addMember, removeMember, leaveGroup, deleteGroup, myGroups, groupMembers, allGroups,
};
