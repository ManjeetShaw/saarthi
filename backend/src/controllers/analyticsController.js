const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

// Professor dashboard analytics, scoped to the courses the caller teaches.
// Everything is derived from student_assignment_status, so individual and
// group assignments are counted the same way (one slot per student per
// assignment).
const overview = asyncHandler(async (req, res) => {
  const professorId = req.user.id;

  const [totals, perCourse, perAssignment, perGroup] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM courses WHERE professor_id = $1) AS total_courses,
         (SELECT COUNT(DISTINCT e.student_id)::int FROM enrollments e
            JOIN courses c ON c.id = e.course_id WHERE c.professor_id = $1) AS total_students,
         (SELECT COUNT(*)::int FROM assignments a
            JOIN courses c ON c.id = a.course_id WHERE c.professor_id = $1) AS total_assignments,
         (SELECT COUNT(*)::int FROM groups g
            JOIN courses c ON c.id = g.course_id WHERE c.professor_id = $1) AS total_groups,
         COUNT(v.student_id)::int AS total_submissions,
         COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS confirmed_submissions,
         COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date >= NOW())::int AS pending_submissions,
         COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date < NOW())::int AS overdue_submissions
       FROM courses c
       LEFT JOIN student_assignment_status v ON v.course_id = c.id
       WHERE c.professor_id = $1`,
      [professorId]
    ),
    pool.query(
      `SELECT c.id, c.code, c.title,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS students,
              COUNT(v.student_id)::int AS total,
              COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS confirmed,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date < NOW())::int AS overdue
       FROM courses c
       LEFT JOIN student_assignment_status v ON v.course_id = c.id
       WHERE c.professor_id = $1
       GROUP BY c.id ORDER BY c.code`,
      [professorId]
    ),
    pool.query(
      `SELECT a.id, a.title, a.due_date, a.submission_type, c.code AS course_code,
              COUNT(v.student_id)::int AS target_groups,
              COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS confirmed_groups,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND a.due_date < NOW())::int AS overdue
       FROM assignments a
       JOIN courses c ON c.id = a.course_id AND c.professor_id = $1
       LEFT JOIN student_assignment_status v ON v.assignment_id = a.id
       GROUP BY a.id, c.code ORDER BY a.due_date ASC`,
      [professorId]
    ),
    pool.query(
      `SELECT g.id, g.name, c.code AS course_code,
              COUNT(a.id)::int AS total,
              COUNT(s.id) FILTER (WHERE s.status = 'acknowledged')::int AS confirmed
       FROM groups g
       JOIN courses c ON c.id = g.course_id AND c.professor_id = $1
       LEFT JOIN assignments a ON a.course_id = c.id AND a.submission_type = 'group'
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.group_id = g.id
       GROUP BY g.id, c.code ORDER BY c.code, g.name`,
      [professorId]
    ),
  ]);

  res.json({
    totals: totals.rows[0],
    perCourse: perCourse.rows,
    perAssignment: perAssignment.rows,
    perGroup: perGroup.rows,
  });
});

module.exports = { overview };
