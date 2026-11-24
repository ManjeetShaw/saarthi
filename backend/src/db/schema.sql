-- Joineazy: Course, Group & Assignment Management System
-- PostgreSQL schema (Task 2: courses, enrollments, individual + group assignments)
--
-- This file is IDEMPOTENT: it can be run on a brand-new database (Docker
-- init, `npm run migrate`) AND on a database that already ran the Task 1
-- schema. Every statement is guarded (IF NOT EXISTS / DO blocks), so running
-- it twice changes nothing.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
-- 'admin' is the professor role (one login table, role flag; JWT carries it).
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('pending', 'acknowledged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task 1 called the second state 'confirmed'. Rename it in place so older
-- databases keep their data and use the same vocabulary as the API and UI.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'submission_status' AND e.enumlabel = 'confirmed'
    ) THEN
        ALTER TYPE submission_status RENAME VALUE 'confirmed' TO 'acknowledged';
    END IF;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_type AS ENUM ('individual', 'group');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Users (students + professors)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'student',
    student_id    VARCHAR(50) UNIQUE,          -- only meaningful for students
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Courses and enrollments
-- ---------------------------------------------------------------------------
-- A course is taught by exactly one professor. Students join with its code.
CREATE TABLE IF NOT EXISTS courses (
    id            SERIAL PRIMARY KEY,
    code          VARCHAR(20) UNIQUE NOT NULL,
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    professor_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Many-to-many: students <-> courses
CREATE TABLE IF NOT EXISTS enrollments (
    id           SERIAL PRIMARY KEY,
    course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Groups (belong to a course)
-- ---------------------------------------------------------------------------
-- A student forms a group inside one course and becomes its leader.
CREATE TABLE IF NOT EXISTS groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    leader_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id   INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;

-- Many-to-many: students <-> groups.
-- course_id repeats the group's course so the database itself can guarantee
-- "a student is in at most one group per course" (partial unique index below);
-- group assignments rely on that to know which group a student submits for.
CREATE TABLE IF NOT EXISTS group_members (
    id        SERIAL PRIMARY KEY,
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members_course_user
    ON group_members(course_id, user_id) WHERE course_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Assignments (belong to a course; individual or group)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
    id               SERIAL PRIMARY KEY,
    course_id        INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title            VARCHAR(150) NOT NULL,
    description      TEXT,
    due_date         TIMESTAMP NOT NULL,
    onedrive_link    TEXT NOT NULL,
    submission_type  submission_type NOT NULL DEFAULT 'group',
    created_by       INTEGER NOT NULL REFERENCES users(id),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_type submission_type NOT NULL DEFAULT 'group';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- Submissions / acknowledgments
-- ---------------------------------------------------------------------------
-- One row per acknowledged unit:
--   individual assignment -> (assignment_id, student_id), group_id is NULL
--   group assignment      -> (assignment_id, group_id),   student_id is NULL
-- A group row is shared by every member, which is how a leader's
-- acknowledgment is reflected across the whole group.
-- No row yet means "pending"; rows are created when someone acknowledges.
CREATE TABLE IF NOT EXISTS submissions (
    id             SERIAL PRIMARY KEY,
    assignment_id  INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    group_id       INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    student_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status         submission_status NOT NULL DEFAULT 'pending',
    confirmed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at   TIMESTAMP,
    UNIQUE (assignment_id, group_id)
);
ALTER TABLE submissions ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

DO $$ BEGIN
    ALTER TABLE submissions ADD CONSTRAINT submissions_one_owner
        CHECK ((group_id IS NULL) <> (student_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_assignment_student
    ON submissions(assignment_id, student_id) WHERE student_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- (UNIQUE constraints above already create their own indexes.)
CREATE INDEX IF NOT EXISTS idx_courses_professor ON courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group ON submissions(group_id);

-- ---------------------------------------------------------------------------
-- View: every (assignment, enrolled student) pair with its current status
-- ---------------------------------------------------------------------------
-- This is the single source of truth for "who has acknowledged what".
-- Dashboards, the assignment page, tracking and analytics all read it, so
-- individual and group assignments are always counted the same way:
--   individual -> the student's own submission row
--   group      -> the submission row of the student's group in that course
-- Overdue is not stored: it is "pending and due_date has passed", computed
-- where needed so it can never go stale.
CREATE OR REPLACE VIEW student_assignment_status AS
SELECT
    a.id               AS assignment_id,
    a.course_id        AS course_id,
    a.submission_type  AS submission_type,
    a.due_date         AS due_date,
    e.student_id       AS student_id,
    gm.group_id        AS group_id,
    COALESCE(s.status, 'pending'::submission_status) AS status,
    s.confirmed_at     AS confirmed_at,
    s.confirmed_by     AS confirmed_by
FROM assignments a
JOIN enrollments e
  ON e.course_id = a.course_id
LEFT JOIN group_members gm
  ON gm.course_id = a.course_id AND gm.user_id = e.student_id
LEFT JOIN submissions s
  ON s.assignment_id = a.id
 AND (
        (a.submission_type = 'individual' AND s.student_id = e.student_id)
     OR (a.submission_type = 'group'      AND s.group_id   = gm.group_id)
     );

/*
ER RELATIONSHIPS
-----------------
users (1) ---- (M) courses              [professor_id]
users (M) ---- (M) courses              via enrollments (students)
courses (1) --- (M) groups              [course_id]
users (1) ---- (M) groups               [leader_id]
users (M) ---- (M) groups               via group_members (unique per course)
courses (1) --- (M) assignments         [course_id]
users (1) ---- (M) assignments          [created_by, professor]
assignments (1) -- (M) submissions      individual: student_id | group: group_id
submissions (M) -- (1) users            [confirmed_by, who acknowledged]
*/
