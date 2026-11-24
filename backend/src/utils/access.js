const pool = require('../db/pool');
const AppError = require('./AppError');

// Shared ownership / membership checks, so every controller answers
// "is this person allowed to touch this course?" the same way.

// Returns the course row if `professorId` teaches it, otherwise throws.
// 404 for a missing course, 403 for somebody else's course.
async function getOwnedCourse(courseId, professorId, db = pool) {
  const result = await db.query('SELECT * FROM courses WHERE id = $1', [courseId]);
  if (!result.rows.length) throw new AppError(404, 'Course not found');
  if (result.rows[0].professor_id !== professorId) {
    throw new AppError(403, 'You can only manage courses you teach');
  }
  return result.rows[0];
}

// Returns the enrollment row, or null when the student is not in the course.
async function getEnrollment(courseId, studentId, db = pool) {
  const result = await db.query(
    'SELECT * FROM enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, studentId]
  );
  return result.rows[0] || null;
}

// The group a student belongs to inside one course (at most one — the
// database enforces it), or null.
async function getStudentGroupInCourse(courseId, studentId, db = pool) {
  const result = await db.query(
    `SELECT g.*, lu.name AS leader_name
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     JOIN users lu ON lu.id = g.leader_id
     WHERE g.course_id = $1 AND gm.user_id = $2`,
    [courseId, studentId]
  );
  return result.rows[0] || null;
}

module.exports = { getOwnedCourse, getEnrollment, getStudentGroupInCourse };
