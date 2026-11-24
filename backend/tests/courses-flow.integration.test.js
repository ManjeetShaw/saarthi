// End-to-end flow against a REAL PostgreSQL database (no mocks).
//
// Runs only when TEST_DATABASE_URL is set, for example:
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/joineazy_test npm test
// The database is wiped and rebuilt from src/db/schema.sql, so point it at a
// throwaway database, never at real data.
const fs = require('fs');
const path = require('path');

const TEST_DB = process.env.TEST_DATABASE_URL;
const suite = TEST_DB ? describe : describe.skip;

suite('Courses, groups and acknowledgments (real PostgreSQL)', () => {
  let request;
  let app;
  let pool;

  const users = {};   // name -> { token, id }
  const ids = {};     // named ids created during the flow
  const DAY = 86400000;

  const call = (method, url, who, body) => {
    let req = request(app)[method](url);
    if (who) req = req.set('Authorization', `Bearer ${users[who].token}`);
    return body ? req.send(body) : req;
  };

  async function register(key, role) {
    const res = await request(app).post('/api/auth/register').send({
      name: `User ${key}`, email: `${key}@test.dev`, password: 'secret123', role,
      student_id: role === 'student' ? `ID-${key}` : undefined,
    });
    expect(res.status).toBe(201);
    users[key] = { token: res.body.token, id: res.body.user.id };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AUTH_RATE_LIMIT_MAX = '1000';
    process.env.API_RATE_LIMIT_MAX = '10000';
    request = require('supertest');
    pool = require('../src/db/pool');
    app = require('../src/app');

    // Rebuild from scratch so the test is repeatable.
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8'));

    await register('prof', 'admin');
    await register('prof2', 'admin');
    await register('lead', 'student');     // will lead the group
    await register('member', 'student');   // group member
    await register('loner', 'student');    // enrolled, never joins a group
    await register('outsider', 'student'); // never enrolled
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  // ------------------------------------------------------------------ courses
  describe('courses and enrollment', () => {
    it('lets a professor create a course and rejects a duplicate code', async () => {
      const ok = await call('post', '/api/courses', 'prof', { code: 'cs-t1', title: 'Test Course' });
      expect(ok.status).toBe(201);
      expect(ok.body.code).toBe('CS-T1'); // normalized to upper case
      ids.course = ok.body.id;

      const dup = await call('post', '/api/courses', 'prof2', { code: 'CS-T1', title: 'Other' });
      expect(dup.status).toBe(409);
      expect(dup.body.error).toMatch(/already exists/i);
    });

    it('does not let a student create a course', async () => {
      const res = await call('post', '/api/courses', 'lead', { code: 'NOPE', title: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('enrolls students by code and rejects bad or repeated codes', async () => {
      for (const who of ['lead', 'member', 'loner']) {
        const res = await call('post', '/api/courses/enroll', who, { code: 'cs-t1' });
        expect(res.status).toBe(201);
      }
      const again = await call('post', '/api/courses/enroll', 'lead', { code: 'CS-T1' });
      expect(again.status).toBe(409);
      const wrong = await call('post', '/api/courses/enroll', 'outsider', { code: 'WRONG' });
      expect(wrong.status).toBe(404);
      expect(wrong.body.error).toMatch(/No course found/);
    });

    it('lists my courses with role-appropriate shapes', async () => {
      const student = await call('get', '/api/courses/mine', 'lead');
      expect(student.status).toBe(200);
      expect(student.body).toHaveLength(1);
      expect(student.body[0]).toMatchObject({ code: 'CS-T1', assignment_count: 0 });

      const prof = await call('get', '/api/courses/mine', 'prof');
      expect(prof.body[0]).toMatchObject({ code: 'CS-T1', student_count: 3 });

      const none = await call('get', '/api/courses/mine', 'outsider');
      expect(none.body).toEqual([]);
    });

    it('hides a course from students who are not enrolled and from other professors', async () => {
      expect((await call('get', `/api/courses/${ids.course}`, 'outsider')).status).toBe(403);
      expect((await call('get', `/api/courses/${ids.course}`, 'prof2')).status).toBe(403);
      expect((await call('get', `/api/courses/${ids.course}`, 'lead')).status).toBe(200);
    });
  });

  // ------------------------------------------------------------------- groups
  describe('groups inside a course', () => {
    it('requires enrollment to create a group', async () => {
      const res = await call('post', '/api/groups', 'outsider', { name: 'Ghosts', course_id: ids.course });
      expect(res.status).toBe(403);
    });

    it('creates a group with the creator as leader, and only one group per course', async () => {
      const res = await call('post', '/api/groups', 'lead', { name: 'Alpha', course_id: ids.course });
      expect(res.status).toBe(201);
      ids.group = res.body.id;

      const second = await call('post', '/api/groups', 'lead', { name: 'Beta', course_id: ids.course });
      expect(second.status).toBe(409);
      expect(second.body.error).toMatch(/already in "Alpha"/);
    });

    it('lets the leader add enrolled students only, once', async () => {
      const ok = await call('post', `/api/groups/${ids.group}/members`, 'lead', { email: 'member@test.dev' });
      expect(ok.status).toBe(201);

      const notEnrolled = await call('post', `/api/groups/${ids.group}/members`, 'lead', { email: 'outsider@test.dev' });
      expect(notEnrolled.status).toBe(400);
      expect(notEnrolled.body.error).toMatch(/not enrolled/);

      const dup = await call('post', `/api/groups/${ids.group}/members`, 'lead', { email: 'member@test.dev' });
      expect(dup.status).toBe(409);

      const byMember = await call('post', `/api/groups/${ids.group}/members`, 'member', { email: 'loner@test.dev' });
      expect(byMember.status).toBe(403);
    });
  });

  // -------------------------------------------------------------- assignments
  describe('assignments', () => {
    it('validates input and course ownership', async () => {
      const bad = await call('post', '/api/assignments', 'prof', { title: 'No course', due_date: new Date().toISOString(), onedrive_link: 'https://x.com/a' });
      expect(bad.status).toBe(400);

      const foreign = await call('post', '/api/assignments', 'prof2', {
        course_id: ids.course, title: 'Hijack', due_date: new Date(Date.now() + DAY).toISOString(), onedrive_link: 'https://x.com/a',
      });
      expect(foreign.status).toBe(403);
    });

    it('creates a group assignment, an individual assignment and an overdue one', async () => {
      const base = { course_id: ids.course, onedrive_link: 'https://onedrive.live.com/test' };
      const group = await call('post', '/api/assignments', 'prof', {
        ...base, title: 'Group Project', submission_type: 'group', due_date: new Date(Date.now() + 5 * DAY).toISOString(),
      });
      const indiv = await call('post', '/api/assignments', 'prof', {
        ...base, title: 'Solo Report', submission_type: 'individual', due_date: new Date(Date.now() + 5 * DAY).toISOString(),
      });
      const late = await call('post', '/api/assignments', 'prof', {
        ...base, title: 'Old Quiz', submission_type: 'individual', due_date: new Date(Date.now() - 2 * DAY).toISOString(),
      });
      expect([group.status, indiv.status, late.status]).toEqual([201, 201, 201]);
      ids.groupAssignment = group.body.id;
      ids.soloAssignment = indiv.body.id;
      ids.oldAssignment = late.body.id;
    });

    it('shows students the type, leader and group roster', async () => {
      const res = await call('get', `/api/assignments/${ids.groupAssignment}`, 'member');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        submission_type: 'group', status: 'pending', is_leader: false, can_acknowledge: false,
        group_name: 'Alpha', leader_name: 'User lead',
      });
      expect(res.body.members.map((m) => m.name)).toEqual(['User lead', 'User member']);

      const leader = await call('get', `/api/assignments/${ids.groupAssignment}`, 'lead');
      expect(leader.body).toMatchObject({ is_leader: true, can_acknowledge: true });

      const loner = await call('get', `/api/assignments/${ids.groupAssignment}`, 'loner');
      expect(loner.body).toMatchObject({ needs_group: true, can_acknowledge: false });
    });

    it('hides assignments from students outside the course', async () => {
      expect((await call('get', `/api/assignments/${ids.groupAssignment}`, 'outsider')).status).toBe(404);
    });
  });

  // ------------------------------------------------------------- acknowledge
  describe('acknowledging a group submission', () => {
    it('rejects a non-leader member', async () => {
      const res = await call('post', `/api/submissions/${ids.groupAssignment}/acknowledge`, 'member');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only the group leader/);
    });

    it('rejects a student with no group, and a student outside the course', async () => {
      const loner = await call('post', `/api/submissions/${ids.groupAssignment}/acknowledge`, 'loner');
      expect(loner.status).toBe(400);
      const outsider = await call('post', `/api/submissions/${ids.groupAssignment}/acknowledge`, 'outsider');
      expect(outsider.status).toBe(404);
    });

    it('accepts the leader and reflects it for every member', async () => {
      const res = await call('post', `/api/submissions/${ids.groupAssignment}/acknowledge`, 'lead');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('acknowledged');

      for (const who of ['lead', 'member']) {
        const view = await call('get', `/api/assignments/${ids.groupAssignment}`, who);
        expect(view.body).toMatchObject({
          is_acknowledged: true, status: 'acknowledged', acknowledged_by_name: 'User lead', can_acknowledge: false,
        });
      }
      // A student with no group is NOT covered by someone else's group.
      const loner = await call('get', `/api/assignments/${ids.groupAssignment}`, 'loner');
      expect(loner.body.is_acknowledged).toBe(false);
    });

    it('rejects acknowledging twice', async () => {
      const res = await call('post', `/api/submissions/${ids.groupAssignment}/acknowledge`, 'lead');
      expect(res.status).toBe(409);
    });
  });

  describe('acknowledging an individual submission', () => {
    it('applies only to the student who acknowledged', async () => {
      const res = await call('post', `/api/submissions/${ids.soloAssignment}/acknowledge`, 'member');
      expect(res.status).toBe(200);

      expect((await call('get', `/api/assignments/${ids.soloAssignment}`, 'member')).body.is_acknowledged).toBe(true);
      expect((await call('get', `/api/assignments/${ids.soloAssignment}`, 'lead')).body.is_acknowledged).toBe(false);
    });

    it('marks an acknowledgment after the deadline as late, and unacknowledged work as overdue', async () => {
      const mine = await call('get', `/api/assignments/${ids.oldAssignment}`, 'lead');
      expect(mine.body).toMatchObject({ is_overdue: true, is_acknowledged: false });

      await call('post', `/api/submissions/${ids.oldAssignment}/acknowledge`, 'lead');
      const after = await call('get', `/api/assignments/${ids.oldAssignment}`, 'lead');
      expect(after.body).toMatchObject({ is_acknowledged: true, is_late: true, is_overdue: false });
    });
  });

  // ---------------------------------------------------------------- tracking
  describe('professor tracking', () => {
    it('summarizes a group assignment and filters by status', async () => {
      const all = await call('get', `/api/submissions/${ids.groupAssignment}`, 'prof');
      expect(all.status).toBe(200);
      expect(all.body.summary).toMatchObject({ total: 3, acknowledged: 2, pending: 1, overdue: 0, without_group: 1, percent: 67 });
      expect(all.body.students).toHaveLength(3);
      expect(all.body.groups).toHaveLength(1);
      expect(all.body.groups[0]).toMatchObject({ name: 'Alpha', status: 'acknowledged', member_count: 2 });

      const ack = await call('get', `/api/submissions/${ids.groupAssignment}?status=acknowledged`, 'prof');
      expect(ack.body.students.map((s) => s.name).sort()).toEqual(['User lead', 'User member']);
      const pending = await call('get', `/api/submissions/${ids.groupAssignment}?status=pending`, 'prof');
      expect(pending.body.students.map((s) => s.name)).toEqual(['User loner']);
      expect(pending.body.groups).toHaveLength(0);
    });

    it('reports overdue work for a past-due assignment', async () => {
      const res = await call('get', `/api/submissions/${ids.oldAssignment}?status=overdue`, 'prof');
      expect(res.body.students.map((s) => s.name).sort()).toEqual(['User loner', 'User member']);
      expect(res.body.summary).toMatchObject({ total: 3, acknowledged: 1, overdue: 2 });
    });

    it('is restricted to the professor who teaches the course', async () => {
      expect((await call('get', `/api/submissions/${ids.groupAssignment}`, 'prof2')).status).toBe(403);
      expect((await call('get', `/api/submissions/${ids.groupAssignment}`, 'lead')).status).toBe(403);
      expect((await call('get', `/api/submissions/${ids.groupAssignment}?status=bogus`, 'prof')).status).toBe(400);
    });

    it('lists assignments with live stats and analytics for the professor only', async () => {
      const list = await call('get', '/api/assignments', 'prof');
      expect(list.body).toHaveLength(3);
      const group = list.body.find((a) => a.id === ids.groupAssignment);
      expect(group).toMatchObject({ total_students: 3, acknowledged_count: 2, pending_count: 1 });
      expect((await call('get', '/api/assignments', 'prof2')).body).toEqual([]);

      const analytics = await call('get', '/api/analytics/overview', 'prof');
      expect(analytics.body.totals).toMatchObject({ total_courses: 1, total_students: 3, total_assignments: 3, total_groups: 1 });
      expect(analytics.body.totals.confirmed_submissions).toBe(4); // 2 group + 1 solo + 1 late
    });

    it('shows each student their own progress on the course card', async () => {
      const res = await call('get', '/api/courses/mine', 'member');
      expect(res.body[0]).toMatchObject({ assignment_count: 3, acknowledged_count: 2, overdue_count: 1 });
    });
  });

  // ------------------------------------------------------------- maintenance
  describe('editing and removing', () => {
    it('blocks changing the submission type once students have acknowledged', async () => {
      const res = await call('put', `/api/assignments/${ids.groupAssignment}`, 'prof', { submission_type: 'individual' });
      expect(res.status).toBe(409);
    });

    it('lets the professor edit allowed fields', async () => {
      const res = await call('put', `/api/assignments/${ids.groupAssignment}`, 'prof', { title: 'Group Project v2' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Group Project v2');
      expect((await call('put', `/api/assignments/${ids.groupAssignment}`, 'prof2', { title: 'x' })).status).toBe(403);
    });

    it('passes group leadership on when the leader is removed from the course', async () => {
      const res = await call('delete', `/api/courses/${ids.course}/students/${users.lead.id}`, 'prof');
      expect(res.status).toBe(200);
      const members = await call('get', `/api/groups/${ids.group}/members`, 'prof');
      expect(members.body).toHaveLength(1);
      expect(members.body[0]).toMatchObject({ name: 'User member', is_leader: true });
    });

    it('deletes a course together with everything in it', async () => {
      expect((await call('delete', `/api/courses/${ids.course}`, 'prof2')).status).toBe(403);
      expect((await call('delete', `/api/courses/${ids.course}`, 'prof')).status).toBe(200);
      const left = await pool.query('SELECT (SELECT COUNT(*) FROM assignments) a, (SELECT COUNT(*) FROM groups) g, (SELECT COUNT(*) FROM submissions) s');
      expect(left.rows[0]).toEqual({ a: '0', g: '0', s: '0' });
    });
  });
});
