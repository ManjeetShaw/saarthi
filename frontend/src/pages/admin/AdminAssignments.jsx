import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import AssignmentStatsRow from '../../components/assignments/AssignmentStatsRow.jsx';
import CreateAssignmentModal from '../../components/assignments/CreateAssignmentModal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Select from '../../components/ui/Select.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import { getAllAssignmentsApi, deleteAssignmentApi } from '../../api/assignments.js';
import { getMyCoursesApi } from '../../api/courses.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { Plus, Search, FileText } from 'lucide-react';

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [assignmentData, courseData] = await Promise.all([getAllAssignmentsApi(), getMyCoursesApi()]);
      setAssignments(assignmentData || []);
      setCourses(courseData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load assignments.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => assignments.filter((a) => {
    if (courseFilter !== 'all' && String(a.course_id) !== courseFilter) return false;
    if (typeFilter !== 'all' && a.submission_type !== typeFilter) return false;
    if (query && !a.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [assignments, courseFilter, typeFilter, query]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAssignmentApi(assignmentToDelete.id);
      setAssignmentToDelete(null);
      load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the assignment.'));
      setAssignmentToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Assignments" subtitle="Create, edit and monitor assignments across your courses">
      <div className="space-y-5 pb-12">
        <FormAlert message={error} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717973]" />
              <input
                type="search"
                aria-label="Search assignments"
                placeholder="Search by title"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white border border-[#c1c8c2] focus:border-[#012d1d] focus:ring-2 focus:ring-[#012d1d]/10 outline-none transition-all"
              />
            </div>
            <div className="sm:w-52">
              <Select aria-label="Filter by course" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                <option value="all">All courses</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
              </Select>
            </div>
            <div className="sm:w-40">
              <Select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </Select>
            </div>
          </div>
          <Button icon={Plus} onClick={() => { setAssignmentToEdit(null); setIsModalOpen(true); }} disabled={courses.length === 0}>
            New assignment
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#717973]">Loading assignments…</p>
        ) : courses.length === 0 ? (
          <EmptyState icon={FileText} title="Create a course first" message="Assignments belong to a course. Create one from the dashboard." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={assignments.length === 0 ? 'No assignments yet' : 'No assignments match'}
            message={assignments.length === 0 ? 'Create your first assignment to get started.' : 'Try clearing a filter.'}
          />
        ) : (
          <div className="space-y-3">
            {visible.map((a) => (
              <AssignmentStatsRow
                key={a.id}
                assignment={a}
                showCourse
                onEdit={(row) => { setAssignmentToEdit(row); setIsModalOpen(true); }}
                onDelete={setAssignmentToDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CreateAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignmentToEdit={assignmentToEdit}
        courses={courses}
        onSaved={load}
      />
      <ConfirmDialog
        isOpen={Boolean(assignmentToDelete)}
        onClose={() => setAssignmentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete assignment?"
        message={`"${assignmentToDelete?.title}" and every acknowledgment recorded for it will be removed. This cannot be undone.`}
        confirmText="Delete assignment"
        variant="danger"
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
