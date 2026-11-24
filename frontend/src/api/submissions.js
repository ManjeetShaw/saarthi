import api from './axios.js';

// Student: acknowledge a submission. Individual: for yourself.
// Group: leader only, and it applies to every member of the group.
export const acknowledgeSubmissionApi = async (assignmentId) =>
  (await api.post(`/submissions/${assignmentId}/acknowledge`)).data;

// Professor: per-student and per-group status for one assignment.
// status: 'all' | 'pending' | 'acknowledged' | 'overdue'
export const getAssignmentTrackingApi = async (assignmentId, status = 'all') => {
  const response = await api.get(`/submissions/${assignmentId}`, {
    params: status && status !== 'all' ? { status } : {},
  });
  return response.data;
};
