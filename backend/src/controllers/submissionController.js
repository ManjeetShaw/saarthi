const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse, getStudentGroupInCourse } = require('../utils/access');

// ---------------------------------------------------------------------------
// Student: acknowledge a submission
// ---------------------------------------------------------------------------
// "I have submitted this work." The rules depend on the assignment type:
//   individual -> any enrolled student acknowledges for themselves.
//   group      -> ONLY the group leader may acknowledge. The acknowledgment
//                 is stored once, on the group's submission row, so every
//                 member sees it immediately (their status is read from that
//                 same row — nothing has to be copied to each member).
// Acknowledging twice is rejected with a 409 so a stale screen (for example
// a member looking at old data) gets a clear message instead of a silent no-op.
const acknowledge = asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const userId = req.user.id;

  // The student must be enrolled in the assignment's course.
  const found = await pool.query(
    `SELECT a.id, a.course_id, a.submission_type, a.title
     FROM assignments a
     JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = $2
     WHERE a.id = $1`,
    [assignmentId, userId]
  );
  if (!found.rows.length) {
    throw new AppError(404, 'Assignment not found, or you are not enrolled in its course');
  }
  const assignment = found.rows[0];

  let result;
  if (assignment.submission_type === 'individual') {
    result = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, status, confirmed_by, confirmed_at)
       VALUES ($1, $2, 'acknowledged', $2, NOW())
       ON CONFLICT (assignment_id, student_id) WHERE student_id IS NOT NULL
       DO UPDATE SET status = 'acknowledged', confirmed_by = EXCLUDED.confirmed_by, confirmed_at = NOW()
         WHERE submissions.status <> 'acknowledged'
       RETURNING *`,
      [assignmentId, userId]
    );
  } else {
    const group = await getStudentGroupInCourse(assignment.course_id, userId);
    if (!group) {
      throw new AppError(400, 'This is a group assignment. Create or join a group in this course first.');
    }
    if (group.leader_id !== userId) {
      throw new AppError(
        403,
        `Only the group leader (${group.leader_name}) can acknowledge a group submission.`
      );
    }
    result = await pool.query(
      `INSERT INTO submissions (assignment_id, group_id, status, confirmed_by, confirmed_at)
       VALUES ($1, $2, 'acknowledged', $3, NOW())
       ON CONFLICT (assignment_id, group_id)
       DO UPDATE SET status = 'acknowledged', confirmed_by = EXCLUDED.confirmed_by, confirmed_at = NOW()
         WHERE submissions.status <> 'acknowledged'
       RETURNING *`,
      [assignmentId, group.id, userId]
    );
  }

  if (!result.rows.length) {
    throw new AppError(409, 'This assignment has already been acknowledged.');
  }
  res.json(result.rows[0]);
});

// ---------------------------------------------------------------------------
// Professor: monitor one assignment
// ---------------------------------------------------------------------------
// Returns, in one response:
//   summary  - class-wide counts (students) and an acknowledged percentage
//   students - one row per enrolled student with their (or their group's) status
//   groups   - for group assignments, one row per group in the course
// `?status=` filters students and groups: pending | acknowledged | overdue.
// "overdue" = still pending after the due date. Bounded by the size of one
// course, so it is not paginated.
const STATUS_FILTERS = {
  pending: `status = 'pending' AND NOT is_overdue`,
  acknowledged: `status = 'acknowledged'`,
  overdue: `is_overdue`,
};

const assignmentTracking = asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const filter = STATUS_FILTERS[req.query.status] || null;

  const found = await pool.query(
    `SELECT a.*, c.code AS course_code, c.title AS course_title
     FROM assignments a JOIN courses c ON c.id = a.course_id
     WHERE a.id = $1`,
    [assignmentId]
  );
  if (!found.rows.length) throw new AppError(404, 'Assignment not found');
  const assignment = found.rows[0];
  await getOwnedCourse(assignment.course_id, req.user.id);

  const isGroup = assignment.submission_type === 'group';

  // Student-level rows. For a group assignment a student inherits the status
  // of their group; a student with no group yet shows as pending / "No group".
  const studentRows = await pool.query(
    `SELECT * FROM (
       SELECT u.id AS student_id, u.name, u.email, u.student_id AS roll_no,
              CASE WHEN $2 THEN v.group_id END AS group_id,
              CASE WHEN $2 THEN g.name END AS group_name,
              CASE WHEN $2 THEN (g.leader_id = u.id) ELSE false END AS is_leader,
              v.status::text AS status, v.confirmed_at,
              cb.name AS acknowledged_by,
              (v.status = 'pending' AND a.due_date < NOW()) AS is_overdue,
              (v.status = 'acknowledged' AND v.confirmed_at > a.due_date) AS is_late
       FROM student_assignment_status v
       JOIN assignments a ON a.id = v.assignment_id
       JOIN users u ON u.id = v.student_id
       LEFT JOIN groups g ON g.id = v.group_id
       LEFT JOIN users cb ON cb.id = v.confirmed_by
       WHERE v.assignment_id = $1
     ) rows
     ${filter ? `WHERE ${filter}` : ''}
     ORDER BY group_name NULLS LAST, name`,
    [assignmentId, isGroup]
  );

  const summaryResult = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged,
            COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date >= NOW())::int AS pending,
            COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date < NOW())::int AS overdue,
            COUNT(*) FILTER (WHERE $2 AND v.group_id IS NULL)::int AS without_group
     FROM student_assignment_status v
     JOIN assignments a ON a.id = v.assignment_id
     WHERE v.assignment_id = $1`,
    [assignmentId, isGroup]
  );
  const summary = summaryResult.rows[0];
  summary.percent = summary.total ? Math.round((summary.acknowledged / summary.total) * 100) : 0;

  let groups = [];
  if (isGroup) {
    const groupRows = await pool.query(
      `SELECT * FROM (
         SELECT g.id, g.name, lu.name AS leader_name,
                (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
                COALESCE(s.status, 'pending')::text AS status, s.confirmed_at,
                cb.name AS acknowledged_by,
                (COALESCE(s.status, 'pending'::submission_status) = 'pending' AND a.due_date < NOW()) AS is_overdue,
                (s.status = 'acknowledged' AND s.confirmed_at > a.due_date) AS is_late
         FROM assignments a
         JOIN groups g ON g.course_id = a.course_id
         JOIN users lu ON lu.id = g.leader_id
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.group_id = g.id
         LEFT JOIN users cb ON cb.id = s.confirmed_by
         WHERE a.id = $1
       ) rows
       ${filter ? `WHERE ${filter}` : ''}
       ORDER BY name`,
      [assignmentId]
    );
    groups = groupRows.rows;
  }

  res.json({ assignment, summary, students: studentRows.rows, groups });
});

module.exports = { acknowledge, assignmentTracking };
