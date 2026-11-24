# Joineazy: Courses, Groups & Assignment Tracking

A full-stack web app where **professors** run courses and post assignments, and **students** enroll, form groups and acknowledge their submissions. Group assignments can only be acknowledged by the **group leader**, and that acknowledgment shows up instantly for every member.

**Stack:** React 19 + Vite + Tailwind CSS 4 · Node.js + Express · PostgreSQL · JWT authentication · Docker

| | |
|---|---|
| Live app | https://joineazy-task-nine.vercel.app |
| API | https://saarthi-yxsk.onrender.com/api/health |
| Demo video | _add link_ |

> The backend runs on a free plan, so the first request after a quiet period can take about a minute while it wakes up.

---

## Contents
1. [What it does](#what-it-does)
2. [UI/UX design choices](#uiux-design-choices)
3. [Screenshots](#screenshots)
4. [Run it locally](#run-it-locally)
5. [Database design](#database-design)
6. [Backend and API](#backend-and-api)
7. [Frontend structure](#frontend-structure)
8. [Testing](#testing)
9. [Deployment](#deployment)

---

## What it does

**Students**
- Sign up, then **enroll in a course** with the code the professor shares.
- A **dashboard of course cards** (responsive grid). Each card shows the professor, personal progress and the next deadline, and opens that course's assignments.
- Create a **group per course** and add classmates; a student can be in only one group per course.
- Open an assignment to see its details, deadline, **submission type (individual or group)** and status.
- **Individual** assignments: acknowledge for yourself. **Group** assignments: only the **leader** can acknowledge, and every member sees it as acknowledged.

**Professors**
- Create and edit **courses**; students join by code, or you add them by email or student ID.
- Create, **edit** and delete **assignments** (individual or group) inside a course.
- A **dashboard of the courses you teach** with student counts and a live acknowledged / pending / overdue split.
- **Submission tracking** per assignment, per student and per group, with **status filters** (all, acknowledged, pending, overdue).
- **Analytics** across courses, assignments and groups.

**Authentication:** JWT, with role-based redirection after login (students go to the student dashboard, professors to the teaching overview). The server enforces every role and ownership rule; the UI only reflects it.

---

## UI/UX design choices

| Choice | Why |
|---|---|
| **Course-first navigation.** The dashboard is a grid of course cards, and everything else hangs off a course. | The task is organised around courses. Students think "what do I owe in this course?", not "show me all assignments". |
| **One status vocabulary everywhere:** *Acknowledged*, *Acknowledged late*, *Pending*, *Overdue*, always the same words and colours. | A student should never wonder whether "Done" on one page means the same as "Submitted" on another. One helper (`utils/assignmentStatus.js`) and one badge component produce them all. |
| **Finished work never reads as overdue.** Deadline text for an acknowledged assignment shows just the date. | "Overdue by 3 days" under a green *Acknowledged* badge is confusing and alarming. |
| **The acknowledgment is the one animated moment.** The check draws itself, then each member's check appears in turn. | It makes the rule *"the leader's acknowledgment covers everyone"* visible. Everything else is deliberately still, so this one thing is noticed. Motion respects `prefers-reduced-motion`. |
| **A two-step acknowledgment dialog**, naming exactly who it covers ("for all 3 members: ..."). | Acknowledging cannot be undone, and in a group it affects other people. |
| **Members see why they cannot act.** A non-leader sees "Waiting for *Aarav*, your group leader", not a disabled button. The page also refreshes when the tab regains focus, and polls gently while waiting. | A disabled button gives no reason. A waiting member should see the change without reloading. |
| **Progress as bars and badges, in two forms.** Students get a progress bar per course. Professors get a stacked bar (acknowledged / pending / overdue) per course and assignment. | A single percentage hides whether the rest is "not yet due" or "late". Stacked colours show that at a glance. |
| **Inline validation with specific messages** on every form (for example "Password must be at least 6 characters long."), a loading state on submit buttons, and server errors mapped back onto the right field. | Authentication and forms are where people give up. Telling them exactly what to fix keeps them going. |
| **Responsive by design.** Card grids use `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`, tables scroll inside their own container, and a bottom tab bar replaces the sidebar on phones. | Deadlines are often checked on a phone. |
| **Accessible basics.** Whole cards are real links (keyboard and middle-click work), visible focus rings, `aria-live` on status changes, and buttons use text plus icons, not colour alone. | Colour-only status fails for colour-blind users. |
| **Colour kept calm.** One deep green brand colour, a stable accent per course (derived from its id) and red reserved for *overdue*. | When red always means "late", it keeps its meaning. |

---

## Screenshots

**Sign up and validation**

| Login | Registration with field messages |
|---|---|
| ![Login](docs/screenshots/01-login.png) | ![Registration validation](docs/screenshots/02-register-validation.png) |

**Student flow**

![Student dashboard](docs/screenshots/03-student-dashboard.png)
![Course page](docs/screenshots/04-student-course.png)

A group member waits for the leader, and the leader acknowledges for everyone:

| Member view | Leader view |
|---|---|
| ![Member waiting](docs/screenshots/05-assignment-member-waiting.png) | ![Leader can acknowledge](docs/screenshots/06-assignment-leader-acknowledge.png) |

| Confirmation | Reflected for every member |
|---|---|
| ![Confirmation dialog](docs/screenshots/07-acknowledge-confirmation.png) | ![Acknowledged](docs/screenshots/08-assignment-acknowledged.png) |

**Professor flow**

![Professor dashboard](docs/screenshots/09-professor-dashboard.png)
![Course management](docs/screenshots/10-professor-course.png)
![Submission tracking](docs/screenshots/11-professor-tracking.png)

| Assignment form validation | Analytics |
|---|---|
| ![Form validation](docs/screenshots/12-create-assignment-validation.png) | ![Analytics](docs/screenshots/13-analytics.png) |

**Mobile**

| Dashboard | Assignment |
|---|---|
| ![Mobile dashboard](docs/screenshots/14-mobile-dashboard.png) | ![Mobile assignment](docs/screenshots/15-mobile-assignment.png) |

---

## Run it locally

### Option A: Docker (one command)
Requires Docker Desktop.

```bash
docker compose up --build
```

- App: http://localhost:3000
- API health: http://localhost:5000/api/health
- Postgres: `localhost:5433` (user `postgres`, password `postgres`, database `joineazy`)

The tables are created automatically on first start. To load demo data:

```bash
docker compose exec backend npm run seed
```

`docker compose down -v` wipes the database for a fresh start.

### Option B: Without Docker
Requires Node 20+ and a running PostgreSQL.

```bash
# 1. Backend
cd backend
cp .env.example .env        # then set DB_PASSWORD and JWT_SECRET
npm install
npm run migrate             # creates or upgrades the tables (safe to re-run)
npm run seed                # optional demo data
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:5000/api" > .env
npm run dev                 # http://localhost:3000
```

`FRONTEND_URL` in `backend/.env` must match the address the frontend runs on (`http://localhost:3000`), or the browser will block API calls.

### Demo accounts
After `npm run seed`, every account below uses the password `password123`:

| Role | Email | Notes |
|---|---|---|
| Professor | `prof@joineazy.dev` | Teaches CS301 and CS305 |
| Professor | `riyer@joineazy.dev` | Teaches CS410 |
| Student | `divya@joineazy.dev` | Leader of Team Alpha (CS301); no group in CS410 |
| Student | `aarav@joineazy.dev` | Leader of Pixel Pushers (CS305), member of Team Alpha |
| Student | `riya@joineazy.dev` | Leader of Team Beta |

You can also register your own student or professor account on the sign-up page.

---

## Database design

One PostgreSQL schema, `backend/src/db/schema.sql`. It is **idempotent**: it builds a new database and upgrades a Task 1 database in place, keeping its data. `npm run migrate` can be run any number of times.

```mermaid
erDiagram
    users ||--o{ courses : "teaches (professor_id)"
    users ||--o{ enrollments : "student"
    courses ||--o{ enrollments : ""
    courses ||--o{ groups : ""
    users ||--o{ groups : "leads (leader_id)"
    groups ||--o{ group_members : ""
    users ||--o{ group_members : ""
    courses ||--o{ assignments : ""
    assignments ||--o{ submissions : ""
    groups ||--o{ submissions : "group assignment"
    users ||--o{ submissions : "individual assignment"

    users { int id PK
            string email UK
            enum role "student | admin (professor)"
            string student_id UK }
    courses { int id PK
              string code UK
              int professor_id FK }
    enrollments { int course_id FK
                  int student_id FK }
    groups { int id PK
             int course_id FK
             int leader_id FK }
    group_members { int group_id FK
                    int user_id FK
                    int course_id FK }
    assignments { int id PK
                  int course_id FK
                  enum submission_type "individual | group"
                  timestamp due_date }
    submissions { int assignment_id FK
                  int group_id FK
                  int student_id FK
                  enum status "pending | acknowledged"
                  int confirmed_by FK }
```

**Students and professors** share one `users` table with a `role` (`student` or `admin`, where `admin` is the professor role), because both log in the same way. Everything role-specific is derived from relationships:
- *a professor's courses:* `courses.professor_id`
- *a student's enrolled courses:* `enrollments`
- *a student's assignments and submission status:* the `student_assignment_status` view (below)

**Key rules enforced by the database itself**
- A student is in **at most one group per course**: a partial unique index on `group_members(course_id, user_id)`.
- A submission belongs to **exactly one** of a group or a student: `CHECK ((group_id IS NULL) <> (student_id IS NULL))`.
- Course codes, enrollments and per-assignment submissions are unique.
- Deleting a course cascades to its enrollments, groups, assignments and submissions.

**How acknowledgments are stored**
- *Individual assignment:* one row `(assignment_id, student_id)`.
- *Group assignment:* one row `(assignment_id, group_id)`, shared by every member of the group. Because every member reads the same row, a leader's acknowledgment is automatically reflected for everyone, with nothing to copy and nothing that can drift out of sync.
- No row means *pending*. `confirmed_by` and `confirmed_at` record who acknowledged and when, which also gives *acknowledged late*.
- *Overdue* is never stored; it is "pending and past the due date", computed on read so it cannot go stale.

**The `student_assignment_status` view** lists every (assignment, enrolled student) pair with its current status, resolving individual versus group automatically. Student cards, the assignment page, professor tracking and analytics all read it, so every screen counts the same way.

---

## Backend and API

Express app in `backend/src`: `routes/` (URL and role guards), `controllers/` (logic), `middleware/` (JWT auth, validation, errors, rate limits), `utils/` (shared ownership checks, pagination).

All routes except register and login need `Authorization: Bearer <token>`.

| Area | Endpoint | Who | Purpose |
|---|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | public | Returns a JWT and the user (with role) |
| | `GET /api/auth/me` | any | Current user |
| Courses | `GET /api/courses/mine` | any | Student: enrolled courses + own progress. Professor: taught courses + class-wide status counts |
| | `POST /api/courses/enroll` | student | Enroll with a course code |
| | `POST /api/courses`, `PUT /:id`, `DELETE /:id` | professor | Create, edit, delete a course they own |
| | `GET /api/courses/:id` | enrolled student, owning professor | Course details (students also get their group) |
| | `GET/POST /api/courses/:id/students`, `DELETE /:id/students/:studentId` | professor | Roster |
| Groups | `POST /api/groups` | student | Create a group in an enrolled course (becomes leader) |
| | `GET /api/groups/mine` | student | My groups |
| | `POST /api/groups/:id/members`, `DELETE .../members/:userId` | leader | Manage members (must be enrolled in the course) |
| | `GET /api/groups` | professor | Groups in their courses (`?course_id=`) |
| Assignments | `POST /api/assignments`, `PUT /:id`, `DELETE /:id` | professor | Create, edit, delete in a course they teach |
| | `GET /api/assignments/mine` | student | My assignments with status (`?course_id=`) |
| | `GET /api/assignments` | professor | Assignments with live stats (`?course_id=`) |
| | `GET /api/assignments/:id` | enrolled student, owning professor | One assignment |
| Submissions | `POST /api/submissions/:assignmentId/acknowledge` | student | Individual: self. Group: **leader only**, applies to all members |
| | `GET /api/submissions/:assignmentId?status=` | professor | Per-student and per-group status; filter `pending`, `acknowledged`, `overdue` |
| Analytics | `GET /api/analytics/overview` | professor | Totals and per-course, per-assignment, per-group figures |

**Validation and errors.** `express-validator` returns `{ error, details: [{ field, message }] }` with human-readable messages. The frontend maps these onto the right form field. Other errors return `{ error }` with a precise status: `401` not signed in, `403` not allowed (for example "Only the group leader (Divya) can acknowledge a group submission."), `404`, `409` conflicts such as a duplicate course code or acknowledging twice.

**Security:** passwords hashed with bcrypt, JWT auth on every route, role and ownership checks on the server, `helmet`, CORS limited to `FRONTEND_URL`, and rate limiting (stricter on login and register). All SQL is parameterised.

---

## Frontend structure

```
frontend/src
├── api/            Axios modules: auth, courses, assignments, groups, submissions, analytics
├── context/        AuthContext: token, user, login/logout, role
├── routes/         ProtectedRoute: role-based access and redirects
├── utils/          assignmentStatus (states, deadlines), courseTheme (course accents), apiErrors, formatters
├── components/
│   ├── ui/         Button, Input, Select, Modal, Badge, StatusBadge, TypeBadge, ProgressBar,
│   │               StackedProgress, AnimatedCheck, EmptyState, CardSkeleton, ConfirmDialog
│   ├── layout/     DashboardLayout, Sidebar, Navbar, MobileNav
│   ├── courses/    CourseCard (student and professor variants), CourseFormModal, EnrollCourseModal
│   ├── assignments/ CreateAssignmentModal, AcknowledgeModal, AssignmentStatsRow
│   ├── groups/     CreateGroupModal, AddMemberModal, members table
│   └── analytics/  StatCard, charts
└── pages/
    ├── Login, Register
    ├── student/    Dashboard, CourseDetail, Assignments, AssignmentDetail, Groups, GroupDetail
    └── admin/      Dashboard, CourseDetail, Assignments, SubmissionTracking, Groups, Analytics
```

Shared pieces carry the consistency: `StatusBadge` and `assignmentStatus.js` define every status label, `CourseCard` renders both the student and professor views, and `apiErrors.js` turns any server or network failure into a readable message.

---

## Testing

```bash
cd backend
npm test                                  # 31 unit tests (27 more run with TEST_DATABASE_URL, see below)
```

The suite has two parts:
- **Unit tests** (mocked database): validation messages, authentication and role checks.
- **Integration tests** against a **real PostgreSQL**: the full flow of enrolling, forming a group, posting assignments, the leader-only acknowledgment and its reflection to every member, status filters, overdue and late, ownership checks, leadership handover and cascading deletes. They run when `TEST_DATABASE_URL` points at a throwaway database (it is wiped and rebuilt):

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/joineazy_test npm test
```

---

## Deployment

| Part | Where | Notes |
|---|---|---|
| Frontend | Vercel (Root directory `frontend`) | Set `VITE_API_URL=https://<backend>.onrender.com/api` |
| Backend | Render Web Service (Root directory `backend`, start `npm start`) | Set `DATABASE_URL` (internal URL), `DB_SSL=true`, `JWT_SECRET`, `FRONTEND_URL` (the Vercel URL, no trailing slash) |
| Database | Render PostgreSQL | Run `npm run migrate` once (and again after schema changes). It is safe to repeat. |

The schema file upgrades an existing Task 1 database without losing data (`confirmed` becomes `acknowledged`, new columns are added, existing rows are kept).
