// Validation, role checks and error wording for the Task 2 endpoints.
// The database is mocked: these tests only cover what is decided before a
// query runs. The real behaviour (leader-only acknowledgment, filters,
// cascades) is covered by courses-flow.integration.test.js.
jest.mock('../src/db/pool');
const request = require('supertest');
const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');
const pool = require('../src/db/pool');

const studentToken = signToken({ id: 1, role: 'student', name: 'Divya', email: 'd@x.com' });
const adminToken = signToken({ id: 9, role: 'admin', name: 'Prof', email: 'p@x.com' });

const as = (token, method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe('courses', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/courses/mine')).status).toBe(401);
  });

  it('does not let a student create a course', async () => {
    const res = await as(studentToken, 'post', '/api/courses').send({ code: 'CS1', title: 'X' });
    expect(res.status).toBe(403);
  });

  it('explains what is wrong with a course form', async () => {
    const res = await as(adminToken, 'post', '/api/courses').send({ code: '', title: '' });
    expect(res.status).toBe(400);
    const messages = res.body.details.map((d) => d.message);
    expect(messages).toEqual(expect.arrayContaining(['Please enter a course code.', 'Please enter a course title.']));
  });

  it('rejects a malformed course code with an example', async () => {
    const res = await as(adminToken, 'post', '/api/courses').send({ code: '!!', title: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/for example CS301/);
  });

  it('asks a student to enter an enrollment code', async () => {
    const res = await as(studentToken, 'post', '/api/courses/enroll').send({ code: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/course code/i);
  });

  it('does not let a professor enroll as a student', async () => {
    expect((await as(adminToken, 'post', '/api/courses/enroll').send({ code: 'CS1' })).status).toBe(403);
  });
});

describe('assignments', () => {
  const valid = {
    course_id: 1, title: 'Lab', due_date: new Date(Date.now() + 86400000).toISOString(),
    onedrive_link: 'https://onedrive.live.com/x', submission_type: 'group',
  };

  it('requires a course', async () => {
    const { course_id, ...rest } = valid;
    const res = await as(adminToken, 'post', '/api/assignments').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'course_id')).toBe(true);
  });

  it('rejects a link without https:// and says how to fix it', async () => {
    const res = await as(adminToken, 'post', '/api/assignments').send({ ...valid, onedrive_link: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/starting with https/);
  });

  it('only accepts individual or group as the submission type', async () => {
    const res = await as(adminToken, 'post', '/api/assignments').send({ ...valid, submission_type: 'pair' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/individual or group/);
  });

  it('does not let a student create assignments', async () => {
    expect((await as(studentToken, 'post', '/api/assignments').send(valid)).status).toBe(403);
  });
});

describe('groups and submissions', () => {
  it('asks which course a new group is for', async () => {
    const res = await as(studentToken, 'post', '/api/groups').send({ name: 'Team' });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'course_id')).toBe(true);
  });

  it('only students can acknowledge', async () => {
    expect((await as(adminToken, 'post', '/api/submissions/1/acknowledge')).status).toBe(403);
    expect((await request(app).post('/api/submissions/1/acknowledge')).status).toBe(401);
  });

  it('only the professor can view tracking, and the status filter is validated', async () => {
    expect((await as(studentToken, 'get', '/api/submissions/1')).status).toBe(403);
    expect((await as(adminToken, 'get', '/api/submissions/1?status=bogus')).status).toBe(400);
  });
});
