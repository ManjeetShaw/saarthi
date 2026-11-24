const express = require('express');
const {
  createAssignment, updateAssignment, deleteAssignment, studentAssignments, allAssignments, getAssignment,
} = require('../controllers/assignmentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const {
  createAssignmentRules, updateAssignmentRules, assignmentIdParamRules, paginationRules, courseQueryRules,
} = require('../middleware/validators');
const router = express.Router();

router.post('/', requireAuth, requireRole('admin'), createAssignmentRules, handleValidation, createAssignment);
router.get('/mine', requireAuth, requireRole('student'), courseQueryRules, handleValidation, studentAssignments);
router.get('/', requireAuth, requireRole('admin'), paginationRules, courseQueryRules, handleValidation, allAssignments);
router.get('/:id', requireAuth, assignmentIdParamRules, handleValidation, getAssignment);
router.put('/:id', requireAuth, requireRole('admin'), updateAssignmentRules, handleValidation, updateAssignment);
router.delete('/:id', requireAuth, requireRole('admin'), assignmentIdParamRules, handleValidation, deleteAssignment);

module.exports = router;
