// Populates the database with a realistic demo dataset:
//   2 professors, 10 students, 3 courses with enrollments, groups per course,
//   and 8 assignments (individual + group) in a mix of states: acknowledged,
//   pending, overdue, acknowledged late, and a student with no group yet.
//
// Safe to run repeatedly: rows are looked up (or upserted against the
// schema's unique constraints) before insert, so re-running never duplicates.
//
// Usage: npm run seed   (run after `npm run migrate`)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const DEMO_PASSWORD = 'password123';
const DAY = 86400000;
const daysFromNow = (d) => new Date(Date.now() + d * DAY);

async function upsertUser(client, { name, email, hash, role, student_id = null }) {
  const result = await client.query(
    `INSERT INTO users (name, email, password_hash, role, student_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
     RETURNING id`,
    [name, email, hash, role, student_id]
  );
  return result.rows[0].id;
}

async function upsertCourse(client, { code, title, description, professorId }) {
  const result = await client.query(
    `INSERT INTO courses (code, title, description, professor_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
     RETURNING id`,
    [code, title, description, professorId]
  );
  return result.rows[0].id;
}

async function enroll(client, courseId, studentIds) {
  for (const studentId of studentIds) {
    await client.query(
      `INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)
       ON CONFLICT (course_id, student_id) DO NOTHING`,
      [courseId, studentId]
    );
  }
}

// Groups have no unique constraint of their own, so idempotency is done by
// looking the group up by (course, name) before inserting.
async function upsertGroup(client, { name, courseId, leaderId, memberIds }) {
  const existing = await client.query(
    'SELECT id FROM groups WHERE course_id = $1 AND name = $2',
    [courseId, name]
  );
  let groupId;
  if (existing.rows.length) {
    groupId = existing.rows[0].id;
  } else {
    const inserted = await client.query(
      'INSERT INTO groups (name, leader_id, course_id) VALUES ($1, $2, $3) RETURNING id',
      [name, leaderId, courseId]
    );
    groupId = inserted.rows[0].id;
  }
  for (const userId of memberIds) {
    await client.query(
      `INSERT INTO group_members (group_id, user_id, course_id) VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, userId, courseId]
    );
  }
  return groupId;
}

async function upsertAssignment(client, { courseId, title, description, dueDate, link, type, createdBy }) {
  const existing = await client.query(
    'SELECT id FROM assignments WHERE course_id = $1 AND title = $2',
    [courseId, title]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, submission_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [courseId, title, description, dueDate, link, type, createdBy]
  );
  return inserted.rows[0].id;
}

// Acknowledge for a whole group (leader) or a single student.
async function acknowledgeGroup(client, assignmentId, groupId, by, at) {
  await client.query(
    `INSERT INTO submissions (assignment_id, group_id, status, confirmed_by, confirmed_at)
     VALUES ($1, $2, 'acknowledged', $3, $4)
     ON CONFLICT (assignment_id, group_id) DO NOTHING`,
    [assignmentId, groupId, by, at]
  );
}

async function acknowledgeStudent(client, assignmentId, studentId, at) {
  await client.query(
    `INSERT INTO submissions (assignment_id, student_id, status, confirmed_by, confirmed_at)
     VALUES ($1, $2, 'acknowledged', $2, $3)
     ON CONFLICT (assignment_id, student_id) WHERE student_id IS NOT NULL DO NOTHING`,
    [assignmentId, studentId, at]
  );
}

async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- Professors ---
    const sharma = await upsertUser(client, { name: 'Prof. Sharma', email: 'prof@joineazy.dev', hash, role: 'admin' });
    const iyer = await upsertUser(client, { name: 'Dr. Rakesh Iyer', email: 'riyer@joineazy.dev', hash, role: 'admin' });

    // --- Students ---
    const studentDefs = [
      ['Divya Das', 'divya@joineazy.dev', 'S101'],
      ['Aarav Mehta', 'aarav@joineazy.dev', 'S102'],
      ['Riya Sen', 'riya@joineazy.dev', 'S103'],
      ['Karan Roy', 'karan@joineazy.dev', 'S104'],
      ['Ananya Gupta', 'ananya@joineazy.dev', 'S105'],
      ['Rohan Verma', 'rohan@joineazy.dev', 'S106'],
      ['Priya Nair', 'priya@joineazy.dev', 'S107'],
      ['Sameer Khan', 'sameer@joineazy.dev', 'S108'],
      ['Neha Kulkarni', 'neha@joineazy.dev', 'S109'],
      ['Vikram Singh', 'vikram@joineazy.dev', 'S110'],
    ];
    const s = {};
    for (const [name, email, studentId] of studentDefs) {
      s[email.split('@')[0]] = await upsertUser(client, { name, email, hash, role: 'student', student_id: studentId });
    }

    // --- Courses + enrollments ---
    const db = await upsertCourse(client, {
      code: 'CS301', title: 'Database Systems', professorId: sharma,
      description: 'Relational design, SQL, normalization and transactions.',
    });
    const web = await upsertCourse(client, {
      code: 'CS305', title: 'Web Development', professorId: sharma,
      description: 'Modern front-end and back-end development with React and Node.js.',
    });
    const sec = await upsertCourse(client, {
      code: 'CS410', title: 'Software Security', professorId: iyer,
      description: 'Threat modeling and secure engineering practices.',
    });

    await enroll(client, db, [s.divya, s.aarav, s.riya, s.karan, s.ananya, s.rohan, s.priya, s.sameer]);
    await enroll(client, web, [s.divya, s.aarav, s.riya, s.karan, s.neha, s.vikram]);
    await enroll(client, sec, [s.divya, s.rohan, s.priya, s.sameer, s.neha, s.vikram]);

    // --- Groups (one per student per course) ---
    const alpha = await upsertGroup(client, { name: 'Team Alpha', courseId: db, leaderId: s.divya, memberIds: [s.divya, s.aarav, s.ananya] });
    await upsertGroup(client, { name: 'Team Beta', courseId: db, leaderId: s.riya, memberIds: [s.riya, s.karan] });
    await upsertGroup(client, { name: 'Team Gamma', courseId: db, leaderId: s.rohan, memberIds: [s.rohan, s.priya, s.sameer] });

    const wizards = await upsertGroup(client, { name: 'Web Wizards', courseId: web, leaderId: s.neha, memberIds: [s.neha, s.vikram] });
    await upsertGroup(client, { name: 'Pixel Pushers', courseId: web, leaderId: s.aarav, memberIds: [s.aarav, s.divya] });
    await upsertGroup(client, { name: 'UI Crew', courseId: web, leaderId: s.riya, memberIds: [s.riya, s.karan] });

    const secSquad = await upsertGroup(client, { name: 'Sec Squad', courseId: sec, leaderId: s.rohan, memberIds: [s.rohan, s.priya] });
    await upsertGroup(client, { name: 'Red Team', courseId: sec, leaderId: s.neha, memberIds: [s.neha, s.vikram] });
    // Sameer and Divya deliberately have no group in CS410, to show the
    // "create or join a group first" state on group assignments.

    // --- CS301 assignments ---
    const erd = await upsertAssignment(client, {
      courseId: db, title: 'ER Diagram & Normalization', type: 'group', createdBy: sharma,
      description: 'Design an ER diagram for a library system and normalize it to 3NF.',
      dueDate: daysFromNow(6), link: 'https://onedrive.live.com/demo/er-diagram',
    });
    await acknowledgeGroup(client, erd, alpha, s.divya, daysFromNow(-1));

    const sqlLab = await upsertAssignment(client, {
      courseId: db, title: 'SQL Query Lab', type: 'individual', createdBy: sharma,
      description: 'Solve the 12 query problems in the lab sheet using joins and aggregates.',
      dueDate: daysFromNow(3), link: 'https://onedrive.live.com/demo/sql-lab',
    });
    await acknowledgeStudent(client, sqlLab, s.divya, daysFromNow(-1));
    await acknowledgeStudent(client, sqlLab, s.aarav, daysFromNow(-1));
    await acknowledgeStudent(client, sqlLab, s.rohan, daysFromNow(-2));

    const txn = await upsertAssignment(client, {
      courseId: db, title: 'Transactions Report', type: 'individual', createdBy: sharma,
      description: 'Write a two-page report on ACID properties with one worked example.',
      dueDate: daysFromNow(-2), link: 'https://onedrive.live.com/demo/transactions',
    });
    await acknowledgeStudent(client, txn, s.divya, daysFromNow(-3));
    await acknowledgeStudent(client, txn, s.priya, daysFromNow(-3));
    await acknowledgeStudent(client, txn, s.aarav, daysFromNow(-1)); // acknowledged late

    // --- CS305 assignments ---
    const portfolio = await upsertAssignment(client, {
      courseId: web, title: 'Portfolio Website', type: 'individual', createdBy: sharma,
      description: 'Build and deploy a responsive personal portfolio.',
      dueDate: daysFromNow(9), link: 'https://onedrive.live.com/demo/portfolio',
    });
    await acknowledgeStudent(client, portfolio, s.neha, daysFromNow(-1));

    const components = await upsertAssignment(client, {
      courseId: web, title: 'React Component Library', type: 'group', createdBy: sharma,
      description: 'Build and document five reusable React components.',
      dueDate: daysFromNow(4), link: 'https://onedrive.live.com/demo/components',
    });
    await acknowledgeGroup(client, components, wizards, s.neha, daysFromNow(-1));

    await upsertAssignment(client, {
      courseId: web, title: 'REST API Project', type: 'group', createdBy: sharma,
      description: 'Design and implement a REST API with authentication and tests.',
      dueDate: daysFromNow(14), link: 'https://onedrive.live.com/demo/rest-api',
    });

    // --- CS410 assignments ---
    const owasp = await upsertAssignment(client, {
      courseId: sec, title: 'OWASP Top 10 Report', type: 'group', createdBy: iyer,
      description: 'Document the mitigations your project applies for each OWASP Top 10 risk.',
      dueDate: daysFromNow(7), link: 'https://onedrive.live.com/demo/owasp',
    });
    await acknowledgeGroup(client, owasp, secSquad, s.rohan, daysFromNow(-1));

    const threat = await upsertAssignment(client, {
      courseId: sec, title: 'Threat Modeling Exercise', type: 'individual', createdBy: iyer,
      description: 'Produce a STRIDE threat model for a login flow.',
      dueDate: daysFromNow(2), link: 'https://onedrive.live.com/demo/threat-model',
    });
    await acknowledgeStudent(client, threat, s.rohan, daysFromNow(-1));

    await client.query('COMMIT');


    console.log('Seed complete. Log in with any of these (password: "password123"):');
    console.log('  Professor: prof@joineazy.dev    (Prof. Sharma - CS301, CS305)');
    console.log('  Professor: riyer@joineazy.dev   (Dr. Rakesh Iyer - CS410)');
    console.log('  Student:   divya@joineazy.dev   (leader of Team Alpha; no group in CS410)');
    console.log('  Student:   aarav@joineazy.dev   (member of Team Alpha)');
    console.log('  Student:   riya@joineazy.dev    (leader of Team Beta)');
    console.log('  Student:   rohan@joineazy.dev   (leader of Team Gamma and Sec Squad)');
    console.log('  ...and 6 more students across the three courses.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
