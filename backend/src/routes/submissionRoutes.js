const express = require('express');
const { acknowledge, assignmentTracking } = require('../controllers/submissionController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { assignmentIdOnlyParamRules, trackingRules } = require('../middleware/validators');
const router = express.Router();

// Student: acknowledge (individual: yourself; group: the leader, for everyone)
router.post('/:assignmentId/acknowledge', requireAuth, requireRole('student'), assignmentIdOnlyParamRules, handleValidation, acknowledge);

// Professor: per-student / per-group status for one assignment, filterable
router.get('/:assignmentId', requireAuth, requireRole('admin'), trackingRules, handleValidation, assignmentTracking);

module.exports = router;
