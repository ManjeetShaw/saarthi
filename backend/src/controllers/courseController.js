const pool = require('../db/pool');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse, getEnrollment, getStudentGroupInCourse } = require('../utils/access');

// ---------------------------------------------------------------------------
// "My courses" — one endpoint, two shapes, chosen by the caller's role.
//   student   -> the courses they are enrolled in + their own progress
//   professor -> the courses they teach + class-wide submission statuses
// Counts come from the student_assignment_status view so individual and
// group assignments are counted identically.
// ---------------------------------------------------------------------------
const myCourses = asyncHandler(async (req, res) => {
  if (req.user.role === 'student') {
    const result = await pool.query(
      `SELECT c.id, c.code, c.title, c.description, c.created_at,
              p.name AS professor_name,
              (SELECT COUNT(*)::int FROM enrollments e2 WHERE e2.course_id = c.id) AS student_count,
              COUNT(v.assignment_id)::int AS assignment_count,
              COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged_count,
              COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date < NOW())::int AS overdue_count,
              MIN(v.due_date) FILTER (WHERE v.status = 'pending' AND v.due_date >= NOW()) AS next_due
       FROM enrollments en
       JOIN courses c ON c.id = en.course_id
       JOIN users p ON p.id = c.professor_id
       LEFT JOIN student_assignment_status v
              ON v.course_id = c.id AND v.student_id = en.student_id
       WHERE en.student_id = $1
       GROUP BY c.id, p.name
       ORDER BY c.code`,
      [req.user.id]
    );
    return res.json(result.rows);
  }

  const result = await pool.query(
    `SELECT c.id, c.code, c.title, c.description, c.created_at,
            (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS student_count,
            (SELECT COUNT(*)::int FROM assignments a WHERE a.course_id = c.id) AS assignment_count,
            (SELECT COUNT(*)::int FROM groups g WHERE g.course_id = c.id) AS group_count,
            COUNT(v.student_id)::int AS total_slots,
            COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged_count,
            COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date >= NOW())::int AS pending_count,
            COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date < NOW())::int AS overdue_count
     FROM courses c
     LEFT JOIN student_assignment_status v ON v.course_id = c.id
     WHERE c.professor_id = $1
     GROUP BY c.id
     ORDER BY c.code`,
    [req.user.id]
  );
  res.json(result.rows);
});

const createCourse = asyncHandler(async (req, res) => {
  const { code, title, description } = req.body;

  const existing = await pool.query('SELECT 1 FROM courses WHERE code = $1', [code]);
  if (existing.rows.length) {
    throw new AppError(409, `A course with the code ${code} already exists. Choose a different code.`);
  }

  const result = await pool.query(
    `INSERT INTO courses (code, title, description, professor_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [code, title, description || null, req.user.id]
  );
  res.status(201).json(result.rows[0]);
});

const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, title, description } = req.body;
  await getOwnedCourse(Number(id), req.user.id);

  if (code) {
    const clash = await pool.query('SELECT 1 FROM courses WHERE code = $1 AND id <> $2', [code, id]);
    if (clash.rows.length) {
      throw new AppError(409, `A course with the code ${code} already exists. Choose a different code.`);
    }
  }

  const result = await pool.query(
    `UPDATE courses SET
       code = COALESCE($1, code),
       title = COALESCE($2, title),
       description = COALESCE($3, description)
     WHERE id = $4 RETURNING *`,
    [code || null, title || null, description === undefined ? null : description, id]
  );
  res.json(result.rows[0]);
});

// Cascades to enrollments, groups, assignments and submissions.
const deleteCourse = asyncHandler(async (req, res) => {
  await getOwnedCourse(Number(req.params.id), req.user.id);
  await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
  res.json({ message: 'Course deleted' });
});

// One course, for whoever is allowed to see it (its professor or an enrolled
// student). Students also get their own group in the course, if any.
const getCourse = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);

  const result = await pool.query(
    `SELECT c.*, p.name AS professor_name, p.email AS professor_email,
            (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS student_count,
            (SELECT COUNT(*)::int FROM assignments a WHERE a.course_id = c.id) AS assignment_count
     FROM courses c JOIN users p ON p.id = c.professor_id
     WHERE c.id = $1`,
    [courseId]
  );
  if (!result.rows.length) throw new AppError(404, 'Course not found');
  const course = result.rows[0];

  if (req.user.role === 'admin') {
    if (course.professor_id !== req.user.id) {
      throw new AppError(403, 'You can only view courses you teach');
    }
    return res.json(course);
  }

  if (!(await getEnrollment(courseId, req.user.id))) {
    throw new AppError(403, 'You are not enrolled in this course');
  }
  const group = await getStudentGroupInCourse(courseId, req.user.id);
  res.json({
    ...course,
    my_group: group
      ? { id: group.id, name: group.name, leader_id: group.leader_id, leader_name: group.leader_name,
          is_leader: group.leader_id === req.user.id }
      : null,
  });
});

// Student joins a course with the code the professor shared.
const enroll = asyncHandler(async (req, res) => {
  const { code } = req.body;

  const course = await pool.query('SELECT id, code, title FROM courses WHERE code = $1', [code]);
  if (!course.rows.length) {
    throw new AppError(404, `No course found with the code ${code}. Check the code and try again.`);
  }

  const inserted = await pool.query(
    `INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)
     ON CONFLICT (course_id, student_id) DO NOTHING RETURNING id`,
    [course.rows[0].id, req.user.id]
  );
  if (!inserted.rows.length) {
    throw new AppError(409, `You are already enrolled in ${course.rows[0].code}.`);
  }
  res.status(201).json({ message: 'Enrolled', course: course.rows[0] });
});

// ---------------------------------------------------------------------------
// Professor: roster management
// ---------------------------------------------------------------------------
const courseStudents = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  await getOwnedCourse(courseId, req.user.id);

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.student_id AS roll_no, e.enrolled_at,
            g.id AS group_id, g.name AS group_name, (g.leader_id = u.id) AS is_leader,
            COUNT(v.assignment_id)::int AS assignment_count,
            COUNT(*) FILTER (WHERE v.status = 'acknowledged')::int AS acknowledged_count,
            COUNT(*) FILTER (WHERE v.status = 'pending' AND v.due_date < NOW())::int AS overdue_count
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN group_members gm ON gm.course_id = e.course_id AND gm.user_id = u.id
     LEFT JOIN groups g ON g.id = gm.group_id
     LEFT JOIN student_assignment_status v ON v.course_id = e.course_id AND v.student_id = u.id
     WHERE e.course_id = $1
     GROUP BY u.id, e.enrolled_at, g.id
     ORDER BY u.name`,
    [courseId]
  );
  res.json(result.rows);
});

const addCourseStudent = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  const { email, student_id } = req.body;
  await getOwnedCourse(courseId, req.user.id);

  const found = email
    ? await pool.query(`SELECT id, name FROM users WHERE email = $1 AND role = 'student'`, [email.toLowerCase()])
    : await pool.query(`SELECT id, name FROM users WHERE student_id = $1 AND role = 'student'`, [student_id]);
  if (!found.rows.length) {
    throw new AppError(404, 'No student account matches that email or student ID.');
  }

  const inserted = await pool.query(
    `INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)
     ON CONFLICT (course_id, student_id) DO NOTHING RETURNING id`,
    [courseId, found.rows[0].id]
  );
  if (!inserted.rows.length) {
    throw new AppError(409, `${found.rows[0].name} is already enrolled in this course.`);
  }
  res.status(201).json({ message: 'Student enrolled', student: found.rows[0] });
});

// Removing a student also removes them from the course's groups. If they led
// a group, leadership passes to the longest-standing remaining member; if
// nobody is left the group is deleted — so no group is ever leaderless.
const removeCourseStudent = asyncHandler(async (req, res) => {
  const courseId = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  await getOwnedCourse(courseId, req.user.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const removed = await client.query(
      'DELETE FROM enrollments WHERE course_id = $1 AND student_id = $2 RETURNING id',
      [courseId, studentId]
    );
    if (!removed.rows.length) throw new AppError(404, 'That student is not enrolled in this course');

    const led = await client.query(
      'SELECT id FROM groups WHERE course_id = $1 AND leader_id = $2',
      [courseId, studentId]
    );
    await client.query('DELETE FROM group_members WHERE course_id = $1 AND user_id = $2', [courseId, studentId]);

    for (const group of led.rows) {
      const next = await client.query(
        'SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY joined_at, id LIMIT 1',
        [group.id]
      );
      if (next.rows.length) {
        await client.query('UPDATE groups SET leader_id = $1 WHERE id = $2', [next.rows[0].user_id, group.id]);
      } else {
        await client.query('DELETE FROM groups WHERE id = $1', [group.id]);
      }
    }

    // Their individual acknowledgments for this course are no longer relevant.
    await client.query(
      `DELETE FROM submissions s USING assignments a
       WHERE s.assignment_id = a.id AND a.course_id = $1 AND s.student_id = $2`,
      [courseId, studentId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Student removed from course' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = {
  myCourses, createCourse, updateCourse, deleteCourse, getCourse, enroll,
  courseStudents, addCourseStudent, removeCourseStudent,
};
