import api from './axios.js';

// Student: assignments across enrolled courses (optionally one course)
export const getMyAssignmentsApi = async (courseId) => {
  const response = await api.get('/assignments/mine', { params: courseId ? { course_id: courseId } : {} });
  return response.data;
};

// One assignment (student: own status; professor: class-wide stats)
export const getAssignmentApi = async (id) => (await api.get(`/assignments/${id}`)).data;

// Professor: assignments in the courses they teach, with live stats
export const getAllAssignmentsApi = async (courseId) => {
  const response = await api.get('/assignments', { params: courseId ? { course_id: courseId } : {} });
  return response.data;
};

export const createAssignmentApi = async (data) => (await api.post('/assignments', data)).data;
export const updateAssignmentApi = async (id, data) => (await api.put(`/assignments/${id}`, data)).data;
export const deleteAssignmentApi = async (id) => (await api.delete(`/assignments/${id}`)).data;
