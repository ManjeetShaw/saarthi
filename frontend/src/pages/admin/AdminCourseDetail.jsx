import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import AssignmentStatsRow from '../../components/assignments/AssignmentStatsRow.jsx';
import CreateAssignmentModal from '../../components/assignments/CreateAssignmentModal.jsx';
import CourseFormModal from '../../components/courses/CourseFormModal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Input from '../../components/ui/Input.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import { getCourseApi, deleteCourseApi, getCourseStudentsApi, addCourseStudentApi, removeCourseStudentApi } from '../../api/courses.js';
import { getAllAssignmentsApi, deleteAssignmentApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { ChevronLeft, Pencil, Trash2, Plus, Copy, Check, FileText, UserPlus, Users, Crown, X } from 'lucide-react';

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [isDeleteCourseOpen, setIsDeleteCourseOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [courseData, assignmentData, studentData] = await Promise.all([
        getCourseApi(courseId), getAllAssignmentsApi(courseId), getCourseStudentsApi(courseId),
      ]);
      setCourse(courseData);
      setAssignments(assignmentData || []);
      setStudents(studentData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this course.'));
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => { setIsLoading(true); load(); }, [load]);

  const accent = courseAccent(course?.id || courseId);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(course.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable: the code is visible anyway */ }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setAddError('Enter the student email or student ID.');
      return;
    }
    setIsAdding(true);
    setAddError('');
    try {
      await addCourseStudentApi(courseId, value.includes('@') ? { email: value } : { student_id: value });
      setIdentifier('');
      load();
    } catch (err) {
      setAddError(getErrorMessage(err, 'Could not add this student.'));
    } finally {
      setIsAdding(false);
    }
  };

  const runBusy = async (fn, fallback) => {
    setIsBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDeleteAssignment = () => runBusy(async () => {
    await deleteAssignmentApi(assignmentToDelete.id);
    setAssignmentToDelete(null);
    load();
  }, 'Could not delete the assignment.');

  const confirmRemoveStudent = () => runBusy(async () => {
    await removeCourseStudentApi(courseId, studentToRemove.id);
    setStudentToRemove(null);
    load();
  }, 'Could not remove the student.');

  const confirmDeleteCourse = () => runBusy(async () => {
    await deleteCourseApi(courseId);
    navigate('/admin/dashboard');
  }, 'Could not delete the course.');

  return (
    <DashboardLayout title={course?.title || 'Course'} subtitle={course ? `${course.code} · ${course.student_count} students` : ''}>
      <div className="space-y-8 pb-12">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#414844] hover:text-[#012d1d]">
          <ChevronLeft className="w-4 h-4" /> All courses
        </Link>
        <FormAlert message={error} />
        {isLoading && !course && !error && <p className="text-sm text-[#717973]">Loading course…</p>}

        {course && (
          <>
            <div className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: accent.hex }} />
              <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-sm text-[#414844] max-w-2xl">{course.description || 'No course description yet.'}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <span className="text-xs text-[#717973]">Students enroll with code</span>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold border border-dashed border-[#c1c8c2] hover:bg-[#f3f4f5] transition-colors"
                      style={{ color: accent.hex }}
                      aria-label={`Copy course code ${course.code}`}
                    >
                      {course.code}
                      {copied ? <Check className="w-4 h-4 text-[#2D6A4F]" /> : <Copy className="w-3.5 h-3.5 text-[#717973]" />}
                    </button>
                    <span className="text-xs text-[#2D6A4F] font-semibold" aria-live="polite">{copied ? 'Copied' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" icon={Pencil} onClick={() => setIsEditOpen(true)}>Edit</Button>
                  <Button variant="outline" size="sm" icon={Trash2} className="text-[#D90429] hover:bg-[#D90429]/10" onClick={() => setIsDeleteCourseOpen(true)}>Delete</Button>
                </div>
              </div>
            </div>

            {/* Assignments */}
            <section aria-labelledby="course-assignments">
              <div className="flex items-center justify-between mb-4">
                <h2 id="course-assignments" className="font-bold text-lg text-[#191c1d]">Assignments</h2>
                <Button size="sm" icon={Plus} onClick={() => { setAssignmentToEdit(null); setIsAssignmentOpen(true); }}>New assignment</Button>
              </div>
              {assignments.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No assignments yet"
                  message="Post an assignment and every enrolled student sees it immediately."
                  action={<Button icon={Plus} onClick={() => { setAssignmentToEdit(null); setIsAssignmentOpen(true); }}>Create assignment</Button>}
                />
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <AssignmentStatsRow
                      key={a.id}
                      assignment={a}
                      onEdit={(row) => { setAssignmentToEdit(row); setIsAssignmentOpen(true); }}
                      onDelete={setAssignmentToDelete}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Roster */}
            <section aria-labelledby="course-roster">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 id="course-roster" className="font-bold text-lg text-[#191c1d]">Students <span className="text-[#717973] font-medium">({students.length})</span></h2>
                <form onSubmit={handleAddStudent} className="flex items-start gap-2" noValidate>
                  <div className="w-64">
                    <Input
                      aria-label="Student email or ID"
                      placeholder="Add by email or student ID"
                      value={identifier}
                      onChange={(e) => { setIdentifier(e.target.value); setAddError(''); }}
                      error={addError}
                    />
                  </div>
                  <Button type="submit" size="md" icon={UserPlus} isLoading={isAdding}>Add</Button>
                </form>
              </div>

              {students.length === 0 ? (
                <EmptyState icon={Users} title="No students enrolled" message={`Share the code ${course.code}, or add students by email above.`} />
              ) : (
                <div className="bg-white rounded-2xl border border-[#e1e3e4] overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-[#717973] border-b border-[#f3f4f5]">
                        <th className="font-medium px-5 py-3">Student</th>
                        <th className="font-medium px-3 py-3">Group</th>
                        <th className="font-medium px-3 py-3">Acknowledged</th>
                        <th className="font-medium px-3 py-3">Overdue</th>
                        <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f5]">
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td className="px-5 py-3">
                            <p className="font-semibold text-[#191c1d]">{s.name}</p>
                            <p className="text-xs text-[#717973]">{s.roll_no ? `${s.roll_no} · ` : ''}{s.email}</p>
                          </td>
                          <td className="px-3 py-3">
                            {s.group_name ? (
                              <span className="inline-flex items-center gap-1.5 text-[#414844]">
                                {s.group_name}{s.is_leader && <Crown className="w-3.5 h-3.5 text-[#FB8500]" aria-label="Leader" />}
                              </span>
                            ) : <span className="text-[#717973]">No group</span>}
                          </td>
                          <td className="px-3 py-3 text-[#414844]">{s.acknowledged_count} / {s.assignment_count}</td>
                          <td className="px-3 py-3">
                            {s.overdue_count > 0 ? <Badge variant="error" size="sm">{s.overdue_count}</Badge> : <span className="text-[#c1c8c2]">0</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" onClick={() => setStudentToRemove(s)} aria-label={`Remove ${s.name}`} className="p-2 rounded-lg text-[#717973] hover:bg-[#D90429]/10 hover:text-[#D90429] transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <CourseFormModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} course={course} onSaved={load} />
      <CreateAssignmentModal
        isOpen={isAssignmentOpen}
        onClose={() => setIsAssignmentOpen(false)}
        assignmentToEdit={assignmentToEdit}
        courses={course ? [course] : []}
        defaultCourseId={course?.id}
        onSaved={load}
      />
      <ConfirmDialog
        isOpen={Boolean(assignmentToDelete)}
        onClose={() => setAssignmentToDelete(null)}
        onConfirm={confirmDeleteAssignment}
        title="Delete assignment?"
        message={`"${assignmentToDelete?.title}" and every acknowledgment recorded for it will be removed. This cannot be undone.`}
        confirmText="Delete assignment"
        variant="danger"
        isLoading={isBusy}
      />
      <ConfirmDialog
        isOpen={Boolean(studentToRemove)}
        onClose={() => setStudentToRemove(null)}
        onConfirm={confirmRemoveStudent}
        title="Remove student?"
        message={`${studentToRemove?.name} will leave this course and its groups. If they lead a group, leadership passes to another member.`}
        confirmText="Remove student"
        variant="danger"
        isLoading={isBusy}
      />
      <ConfirmDialog
        isOpen={isDeleteCourseOpen}
        onClose={() => setIsDeleteCourseOpen(false)}
        onConfirm={confirmDeleteCourse}
        title="Delete this course?"
        message="All of its enrollments, groups, assignments and acknowledgments will be permanently removed."
        confirmText="Delete course"
        variant="danger"
        isLoading={isBusy}
      />
    </DashboardLayout>
  );
}
