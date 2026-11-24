// Prints EXPLAIN ANALYZE for the heaviest read queries, to check they use
// indexes. Run after `npm run seed`:   npm run explain
require('dotenv').config();
const pool = require('../src/db/pool');

const queries = {
  'Student course cards (per-student progress)': {
    sql: `SELECT c.id, COUNT(v.assignment_id) AS assignments,
                 COUNT(*) FILTER (WHERE v.status = 'acknowledged') AS acknowledged
          FROM enrollments en
          JOIN courses c ON c.id = en.course_id
          LEFT JOIN student_assignment_status v ON v.course_id = c.id AND v.student_id = en.student_id
          WHERE en.student_id = $1 GROUP BY c.id`,
    params: [1],
  },
  'Professor course cards (class-wide status counts)': {
    sql: `SELECT c.id, COUNT(v.student_id) AS slots,
                 COUNT(*) FILTER (WHERE v.status = 'acknowledged') AS acknowledged
          FROM courses c LEFT JOIN student_assignment_status v ON v.course_id = c.id
          WHERE c.professor_id = $1 GROUP BY c.id`,
    params: [1],
  },
  'Assignment tracking (students and their status)': {
    sql: `SELECT u.name, v.status FROM student_assignment_status v
          JOIN users u ON u.id = v.student_id WHERE v.assignment_id = $1`,
    params: [1],
  },
};

(async () => {
  for (const [name, { sql, params }] of Object.entries(queries)) {
    const result = await pool.query(`EXPLAIN ANALYZE ${sql}`, params);
    console.log(`\n=== ${name} ===`);
    result.rows.forEach((row) => console.log(row['QUERY PLAN']));
  }
  await pool.end();
})().catch((err) => { console.error(err); process.exit(1); });
