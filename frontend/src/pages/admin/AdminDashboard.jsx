import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatCard from '../../components/analytics/StatCard.jsx';
import CourseCard from '../../components/courses/CourseCard.jsx';
import CourseFormModal from '../../components/courses/CourseFormModal.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import CardSkeleton from '../../components/ui/CardSkeleton.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import { getMyCoursesApi } from '../../api/courses.js';
import { getAllAssignmentsApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { percentOf } from '../../utils/assignmentStatus.js';
import { formatDate } from '../../utils/formatters.js';
import { BookOpen, GraduationCap, FileText, TrendingUp, Plus, ChevronRight } from 'lucide-react';

export default function AdminDashboard() {
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCourseOpen, setIsCourseOpen] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [courseData, assignmentData] = await Promise.all([getMyCoursesApi(), getAllAssignmentsApi()]);
      setCourses(courseData || []);
      setAssignments(assignmentData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your courses.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const slots = courses.reduce((n, c) => n + c.total_slots, 0);
    const acknowledged = courses.reduce((n, c) => n + c.acknowledged_count, 0);
    return {
      students: courses.reduce((n, c) => n + c.student_count, 0),
      assignments: courses.reduce((n, c) => n + c.assignment_count, 0),
      rate: percentOf(acknowledged, slots),
      acknowledged,
      slots,
    };
  }, [courses]);

  // Where a nudge would help most: assignments with overdue work first, then
  // the ones with the most students still pending.
  const needsAttention = useMemo(
    () => assignments
      .filter((a) => a.overdue_count > 0 || (a.pending_count > 0 && new Date(a.due_date) - Date.now() < 3 * 86400000))
      .sort((x, y) => y.overdue_count - x.overdue_count || y.pending_count - x.pending_count)
      .slice(0, 5),
    [assignments]
  );

  return (
    <DashboardLayout title="Teaching overview" subtitle="Your courses and how students are progressing">
      <div className="space-y-8 pb-12">
        <FormAlert message={error} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Courses" value={courses.length} subtitle="You are teaching" icon={BookOpen} />
          <StatCard title="Students" value={totals.students} subtitle="Enrolled across courses" icon={GraduationCap} variant="gold" />
          <StatCard title="Assignments" value={totals.assignments} subtitle="Posted so far" icon={FileText} variant="accent" />
          <StatCard title="Acknowledged" value={`${totals.rate}%`} subtitle={`${totals.acknowledged} of ${totals.slots} submissions`} icon={TrendingUp} variant="primary" />
        </div>

        <section aria-labelledby="teaching-courses">
          <div className="flex items-center justify-between mb-4">
            <h2 id="teaching-courses" className="font-bold text-lg text-[#191c1d]">Your courses</h2>
            <Button size="sm" icon={Plus} onClick={() => setIsCourseOpen(true)}>New course</Button>
          </div>

          {isLoading ? (
            <CardSkeleton />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="You have not created a course yet"
              message="Create a course, then share its code so students can enroll."
              action={<Button icon={Plus} onClick={() => setIsCourseOpen(true)}>Create your first course</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} variant="professor" to={`/admin/courses/${c.id}`} />
              ))}
            </div>
          )}
        </section>

        {needsAttention.length > 0 && (
          <section aria-labelledby="needs-attention">
            <h2 id="needs-attention" className="font-bold text-lg text-[#191c1d] mb-4">Needs attention</h2>
            <ul className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow divide-y divide-[#f3f4f5] overflow-hidden">
              {needsAttention.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/admin/submissions?assignment=${a.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#f8f9fa] transition-colors focus:outline-none focus-visible:bg-[#f3f4f5]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#191c1d] truncate">{a.title}</p>
                      <p className="text-xs text-[#717973] mt-0.5">{a.course_code} · due {formatDate(a.due_date)}</p>
                    </div>
                    <div className="hidden sm:block"><TypeBadge type={a.submission_type} size="sm" /></div>
                    <div className="text-right text-xs shrink-0">
                      {a.overdue_count > 0 && <p className="text-[#D90429] font-semibold">{a.overdue_count} overdue</p>}
                      {a.pending_count > 0 && <p className="text-[#4361EE] font-semibold">{a.pending_count} pending</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#c1c8c2] shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <CourseFormModal isOpen={isCourseOpen} onClose={() => setIsCourseOpen(false)} onSaved={load} />
    </DashboardLayout>
  );
}
