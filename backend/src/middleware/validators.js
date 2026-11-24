const { body, param, query } = require('express-validator');

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Please enter your full name.')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Please enter your email address.').bail()
    .isEmail().withMessage('Please enter a valid email address, like name@example.com.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Please create a password.').bail()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  body('role').optional().isIn(['student', 'admin']).withMessage('Account type must be student or admin.'),
  body('student_id')
    .optional({ checkFalsy: true })
    .isLength({ max: 50 }).withMessage('Student ID must be 50 characters or fewer.'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Please enter your email address.').bail()
    .isEmail().withMessage('Please enter a valid email address, like name@example.com.')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Please enter your password.'),
];

const createGroupRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Please enter a group name.')
    .isLength({ max: 100 }).withMessage('Group name must be 100 characters or fewer.'),
  body('course_id').isInt({ min: 1 }).withMessage('Please choose the course this group is for.'),
];

const addMemberRules = [
  param('groupId').isInt().withMessage('Invalid group id'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('student_id').optional({ checkFalsy: true }).isLength({ max: 50 }),
  body().custom((value) => {
    if (!value.email && !value.student_id) {
      throw new Error('Provide either email or student_id');
    }
    return true;
  }),
];

// Param-only validators for routes with no body, so a non-numeric id gets a
// clean 400 instead of falling through to Postgres and surfacing a 500.
const groupIdParamRules = [
  param('groupId').isInt().withMessage('Invalid group id'),
];

const memberIdParamRules = [
  param('groupId').isInt().withMessage('Invalid group id'),
  param('userId').isInt().withMessage('Invalid user id'),
];

const assignmentIdParamRules = [
  param('id').isInt().withMessage('Invalid assignment id'),
];

const assignmentIdOnlyParamRules = [
  param('assignmentId').isInt().withMessage('Invalid assignment id'),
];

const SUBMISSION_TYPES = ['individual', 'group'];

const createAssignmentRules = [
  body('course_id').isInt({ min: 1 }).withMessage('Please choose a course for this assignment.'),
  body('title')
    .trim()
    .notEmpty().withMessage('Please enter an assignment title.')
    .isLength({ max: 150 }).withMessage('Title must be 150 characters or fewer.'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 5000 })
    .withMessage('Description must be 5000 characters or fewer.'),
  body('due_date').isISO8601().withMessage('Please choose a valid due date and time.'),
  body('onedrive_link').trim().isURL({ require_protocol: true })
    .withMessage('Please enter a full link starting with https://'),
  body('submission_type').optional().isIn(SUBMISSION_TYPES)
    .withMessage('Submission type must be individual or group.'),
];

const updateAssignmentRules = [
  param('id').isInt().withMessage('Invalid assignment id'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty.')
    .isLength({ max: 150 }).withMessage('Title must be 150 characters or fewer.'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 5000 })
    .withMessage('Description must be 5000 characters or fewer.'),
  body('due_date').optional().isISO8601().withMessage('Please choose a valid due date and time.'),
  body('onedrive_link').optional().trim().isURL({ require_protocol: true })
    .withMessage('Please enter a full link starting with https://'),
  body('submission_type').optional().isIn(SUBMISSION_TYPES)
    .withMessage('Submission type must be individual or group.'),
];

// ---- Courses -------------------------------------------------------------
const courseCodeRule = (field = 'code') =>
  body(field)
    .trim()
    .notEmpty().withMessage('Please enter a course code.').bail()
    .matches(/^[A-Za-z0-9][A-Za-z0-9 _-]{1,19}$/)
    .withMessage('Course code must be 2-20 letters, numbers, dashes or spaces (for example CS301).')
    .customSanitizer((v) => v.toUpperCase());

const createCourseRules = [
  courseCodeRule(),
  body('title')
    .trim()
    .notEmpty().withMessage('Please enter a course title.')
    .isLength({ max: 150 }).withMessage('Course title must be 150 characters or fewer.'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or fewer.'),
];

const updateCourseRules = [
  param('id').isInt().withMessage('Invalid course id'),
  body('code').optional().trim().matches(/^[A-Za-z0-9][A-Za-z0-9 _-]{1,19}$/)
    .withMessage('Course code must be 2-20 letters, numbers, dashes or spaces (for example CS301).')
    .customSanitizer((v) => v.toUpperCase()),
  body('title').optional().trim().notEmpty().withMessage('Course title cannot be empty.')
    .isLength({ max: 150 }).withMessage('Course title must be 150 characters or fewer.'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or fewer.'),
];

const enrollRules = [
  body('code').trim().notEmpty().withMessage('Please enter the course code your professor shared.')
    .customSanitizer((v) => v.toUpperCase()),
];

const courseIdParamRules = [
  param('id').isInt().withMessage('Invalid course id'),
];

const courseStudentRules = [
  param('id').isInt().withMessage('Invalid course id'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email address.'),
  body('student_id').optional({ checkFalsy: true }).isLength({ max: 50 }),
  body().custom((value) => {
    if (!value.email && !value.student_id) {
      throw new Error('Enter the student email or student ID.');
    }
    return true;
  }),
];

const courseStudentParamRules = [
  param('id').isInt().withMessage('Invalid course id'),
  param('studentId').isInt().withMessage('Invalid student id'),
];

// ---- Submissions ---------------------------------------------------------
const trackingRules = [
  param('assignmentId').isInt().withMessage('Invalid assignment id'),
  query('status').optional().isIn(['all', 'pending', 'acknowledged', 'overdue'])
    .withMessage('status must be all, pending, acknowledged or overdue'),
];

const courseQueryRules = [
  query('course_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('course_id must be a number'),
];

// Shared pagination query validation for list endpoints.
const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
];

module.exports = {
  registerRules, loginRules, createGroupRules, addMemberRules,
  groupIdParamRules, memberIdParamRules, assignmentIdParamRules,
  assignmentIdOnlyParamRules,
  createAssignmentRules, updateAssignmentRules, paginationRules,
  createCourseRules, updateCourseRules, enrollRules, courseIdParamRules,
  courseStudentRules, courseStudentParamRules, trackingRules, courseQueryRules,
};
