const express = require('express');
const {
  myCourses, createCourse, updateCourse, deleteCourse, getCourse, enroll,
  courseStudents, addCourseStudent, removeCourseStudent,
} = require('../controllers/courseController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const {
  createCourseRules, updateCourseRules, enrollRules, courseIdParamRules,
  courseStudentRules, courseStudentParamRules,
} = require('../middleware/validators');
const router = express.Router();

// Fixed paths first so '/mine' and '/enroll' are never read as a course id.
router.get('/mine', requireAuth, myCourses);
router.post('/enroll', requireAuth, requireRole('student'), enrollRules, handleValidation, enroll);
router.post('/', requireAuth, requireRole('admin'), createCourseRules, handleValidation, createCourse);

router.get('/:id', requireAuth, courseIdParamRules, handleValidation, getCourse);
router.put('/:id', requireAuth, requireRole('admin'), updateCourseRules, handleValidation, updateCourse);
router.delete('/:id', requireAuth, requireRole('admin'), courseIdParamRules, handleValidation, deleteCourse);

router.get('/:id/students', requireAuth, requireRole('admin'), courseIdParamRules, handleValidation, courseStudents);
router.post('/:id/students', requireAuth, requireRole('admin'), courseStudentRules, handleValidation, addCourseStudent);
router.delete('/:id/students/:studentId', requireAuth, requireRole('admin'), courseStudentParamRules, handleValidation, removeCourseStudent);

module.exports = router;
