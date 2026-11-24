const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, setPaginationHeaders } = require('../utils/pagination');
const { getOwnedCourse } = require('../utils/access');

// ---------------------------------------------------------------------------
// Professor: create / edit / delete
// ---------------------------------------------------------------------------
// An assignment belongs to a course the professor teaches and is either
// 'individual' (every enrolled student acknowledges for themselves) or
// 'group' (each group acknowledges once, through its leader). No submission
// rows are pre-created: a unit is "pending" until someone acknowledges, which
// keeps late enrollments and new groups working with no extra bookkeeping.
const createAssignment = asyncHandler(async (req, res) => {
  const { course_id, title, description, due_date, onedrive_link, submission_type } = req.body;
  await getOwnedCourse(Number(course_id), req.user.id);

  const result = await pool.query(
    `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, submission_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [course_id, title, description || null, due_date, onedrive_link, submission_type || 'group', req.user.id]
  );
  res.status(201).json(result.rows[0]);
});

const updateAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, onedrive_link, submission_type } = req.body;

  const current = await pool.query(
    `SELECT a.*, c.professor_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1`,
    [id]
  );
  if (!current.rows.length) throw new AppError(404, 'Assignment not found');
  if (current.rows[0].professor_id !== req.user.id) {
    throw new AppError(403, 'You can only edit assignments in courses you teach');
  }

  // Switching individual <-> group after students acknowledged would orphan
  // those acknowledgments, so it is only allowed while nothing is acknowledged.
  if (submission_type && submission_type !== current.rows[0].submission_type) {
    const used = await pool.query('SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1', [id]);
    if (used.rows.length) {
      throw new AppError(409, 'The submission type cannot change after students have acknowledged this assignment.');
    }
  }

  const result = await pool.query(
    `UPDATE assignments SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       due_date = COALESCE($3, due_date),
       onedrive_link = COALESCE($4, onedrive_link),
       submission_type = COALESCE($5::submission_type, submission_type),
       updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [title, description, due_date, onedrive_link, submission_type, id]
  );
  res.json(result.rows[0]);
});

// Deletes the assignment and (by cascade) its submissions.
const deleteAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const current = await pool.query(
    `SELECT c.professor_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1`,
    [id]
  );
  if (!current.rows.length) throw new AppError(404, 'Assignment not found');
  if (current.rows[0].professor_id !== req.user.id) {
    throw new AppError(403, 'You can only delete assignments in courses you teach');
  }
  await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
  res.json({ message: 'Assignment deleted' });
});

// ---------------------------------------------------------------------------
// Student views
// ---------------------------------------------------------------------------
// Shared SELECT for "an assignment as one student sees it". The status comes
// from student_assignment_status: the student's own row for individual
// assignments, their group's row for group assignments.
const STUDENT_ASSIGNMENT_SELECT = `
  SELECT a.id, a.title, a.description, a.due_date, a.onedrive_link, a.submission_type,
         a.created_at, a.updated_at,
         c.id AS course_id, c.code AS course_code, c.title AS course_title,
         pr.name AS professor_name,
         v.status,
         (v.status = 'acknowledged') AS is_acknowledged,
         (v.status = 'pending' AND a.due_date < NOW()) AS is_overdue,
         (v.status = 'acknowledged' AND v.confirmed_at > a.due_date) AS is_late,
         v.confirmed_at,
         cb.name AS acknowledged_by_name,
         CASE WHEN a.submission_type = 'group' THEN v.group_id END AS group_id,
         CASE WHEN a.submission_type = 'group' THEN g.name END AS group_name,
         CASE WHEN a.submission_type = 'group' THEN g.leader_id END AS leader_id,
         CASE WHEN a.submission_type = 'group' THEN lu.name END AS leader_name
  FROM student_assignment_status v
  JOIN assignments a ON a.id = v.assignment_id
  JOIN courses c ON c.id = a.course_id
  JOIN users pr ON pr.id = c.professor_id
  LEFT JOIN groups g ON g.id = v.group_id
  LEFT JOIN users lu ON lu.id = g.leader_id
  LEFT JOIN users cb ON cb.id = v.confirmed_by
`;

// Adds what the UI needs to decide whether to show the acknowledge button.
function withPermissions(row, userId) {
  const isGroup = row.submission_type === 'group';
  const isLeader = isGroup && row.leader_id === userId;
  return {
    ...row,
    is_leader: isLeader,
    needs_group: isGroup && !row.group_id,
    can_acknowledge: !row.is_acknowledged && (!isGroup || isLeader),
  };
}

// All assignments for the courses the student is enrolled in (optionally one
// course). Scoped to one student, so left unpaginated (naturally small).
const studentAssignments = asyncHandler(async (req, res) => {
  const courseId = req.query.course_id ? Number(req.query.course_id) : null;
  const result = await pool.query(
    `${STUDENT_ASSIGNMENT_SELECT}
     WHERE v.student_id = $1 AND ($2::int IS NULL OR a.course_id = $2)
     ORDER BY a.due_date ASC`,
    [req.user.id, courseId]
  );
  res.json(result.rows.map((row) => withPermissions(row, req.user.id)));
});

// One assignment. Students get their own status (plus the group roster for
// group assignments, where every member shares the group's status); the
// professor of the course gets the class-wide numbers.
const getAssignment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role === 'admin') {
    const result = await pool.query(
      `SELECT a.*, c.code AS course_code, c.title AS course_title, c.professor_id,
              COUNT(v.student_id)::int AS total_students,
              COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged_count,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date >= NOW())::int AS pending_count,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date < NOW())::int AS overdue_count
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN student_assignment_status v ON v.assignment_id = a.id
       WHERE a.id = $1
       GROUP BY a.id, c.code, c.title, c.professor_id`,
      [id]
    );
    if (!result.rows.length) throw new AppError(404, 'Assignment not found');
    if (result.rows[0].professor_id !== req.user.id) {
      throw new AppError(403, 'You can only view assignments in courses you teach');
    }
    return res.json(result.rows[0]);
  }

  const result = await pool.query(
    `${STUDENT_ASSIGNMENT_SELECT} WHERE v.student_id = $1 AND a.id = $2`,
    [req.user.id, id]
  );
  if (!result.rows.length) {
    throw new AppError(404, 'Assignment not found, or you are not enrolled in its course');
  }
  const assignment = withPermissions(result.rows[0], req.user.id);

  if (assignment.group_id) {
    const members = await pool.query(
      `SELECT u.id, u.name, u.student_id, (u.id = $2) AS is_leader
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY (u.id = $2) DESC, u.name`,
      [assignment.group_id, assignment.leader_id]
    );
    assignment.members = members.rows;
  }
  res.json(assignment);
});

// ---------------------------------------------------------------------------
// Professor: assignments across the courses they teach, with live stats.
// Bounded + paginated since this grows over a semester.
// ---------------------------------------------------------------------------
const allAssignments = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const courseId = req.query.course_id ? Number(req.query.course_id) : null;

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT a.id, a.course_id, a.title, a.description, a.due_date, a.onedrive_link,
              a.submission_type, a.created_at, a.updated_at,
              c.code AS course_code, c.title AS course_title,
              COUNT(v.student_id)::int AS total_students,
              COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged_count,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date >= NOW())::int AS pending_count,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date < NOW())::int AS overdue_count
       FROM assignments a
       JOIN courses c ON c.id = a.course_id AND c.professor_id = $1
       LEFT JOIN student_assignment_status v ON v.assignment_id = a.id
       WHERE ($2::int IS NULL OR a.course_id = $2)
       GROUP BY a.id, c.code, c.title
       ORDER BY a.due_date ASC
       LIMIT $3 OFFSET $4`,
      [req.user.id, courseId, pagination.limit, pagination.offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM assignments a
       JOIN courses c ON c.id = a.course_id AND c.professor_id = $1
       WHERE ($2::int IS NULL OR a.course_id = $2)`,
      [req.user.id, courseId]
    ),
  ]);

  setPaginationHeaders(res, pagination, Number(countResult.rows[0].count));
  res.json(result.rows);
});

module.exports = {
  createAssignment, updateAssignment, deleteAssignment,
  studentAssignments, allAssignments, getAssignment,
};
