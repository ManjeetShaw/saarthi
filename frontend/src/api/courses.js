import api from './axios.js';

// Courses the caller is enrolled in (student) or teaches (professor)
export const getMyCoursesApi = async () => (await api.get('/courses/mine')).data;

export const getCourseApi = async (id) => (await api.get(`/courses/${id}`)).data;

// Student joins a course with the code the professor shared
export const enrollInCourseApi = async (code) => (await api.post('/courses/enroll', { code })).data;

// Professor course management
export const createCourseApi = async (data) => (await api.post('/courses', data)).data;
export const updateCourseApi = async (id, data) => (await api.put(`/courses/${id}`, data)).data;
export const deleteCourseApi = async (id) => (await api.delete(`/courses/${id}`)).data;

// Professor roster management
export const getCourseStudentsApi = async (id) => (await api.get(`/courses/${id}/students`)).data;
export const addCourseStudentApi = async (id, identifier) =>
  (await api.post(`/courses/${id}/students`, identifier)).data;
export const removeCourseStudentApi = async (id, studentId) =>
  (await api.delete(`/courses/${id}/students/${studentId}`)).data;
