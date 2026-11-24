import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import CourseCard from '../../components/courses/CourseCard.jsx';
import EnrollCourseModal from '../../components/courses/EnrollCourseModal.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import CardSkeleton from '../../components/ui/CardSkeleton.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import { getMyCoursesApi } from '../../api/courses.js';
import { getMyAssignmentsApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { describeDeadline } from '../../utils/assignmentStatus.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { BookOpen, Plus, ChevronRight } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [courseData, assignmentData] = await Promise.all([getMyCoursesApi(), getMyAssignmentsApi()]);
      setCourses(courseData || []);
      setAssignments(assignmentData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your courses.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    open: assignments.filter((a) => !a.is_acknowledged).length,
    acknowledged: assignments.filter((a) => a.is_acknowledged).length,
    overdue: assignments.filter((a) => a.is_overdue).length,
  }), [assignments]);

  // Work that still needs attention, most urgent first (overdue sorts to the top by date).
  const upNext = useMemo(
    () => assignments.filter((a) => !a.is_acknowledged).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5),
    [assignments]
  );

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <DashboardLayout title={`Hi, ${firstName}`} subtitle="Your courses and what is due next">
      <div className="space-y-8 pb-12">
        <FormAlert message={error} />

        {/* One compact line of figures instead of a wall of stat cards */}
        {!isLoading && courses.length > 0 && (
          <dl className="flex flex-wrap items-stretch bg-white rounded-2xl border border-[#e1e3e4] soft-shadow divide-x divide-[#e1e3e4]">
            {[
              { label: 'Courses', value: courses.length },
              { label: 'Still to do', value: summary.open },
              { label: 'Acknowledged', value: summary.acknowledged },
              { label: 'Overdue', value: summary.overdue, alert: summary.overdue > 0 },
            ].map((item) => (
              <div key={item.label} className="flex-1 min-w-[40%] sm:min-w-0 px-5 py-4">
                <dt className="text-xs text-[#717973]">{item.label}</dt>
                <dd className={`text-2xl font-bold mt-0.5 ${item.alert ? 'text-[#D90429]' : 'text-[#191c1d]'}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <section aria-labelledby="my-courses">
          <div className="flex items-center justify-between mb-4">
            <h2 id="my-courses" className="font-bold text-lg text-[#191c1d]">My courses</h2>
            <Button variant="outline" size="sm" icon={Plus} onClick={() => setIsEnrollOpen(true)}>
              Enroll in a course
            </Button>
          </div>

          {isLoading ? (
            <CardSkeleton />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="You are not enrolled in any course yet"
              message="Ask your professor for the course code, then enroll to see assignments here."
              action={<Button icon={Plus} onClick={() => setIsEnrollOpen(true)}>Enroll with a code</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} to={`/student/courses/${course.id}`} />
              ))}
            </div>
          )}
        </section>

        {upNext.length > 0 && (
          <section aria-labelledby="up-next">
            <h2 id="up-next" className="font-bold text-lg text-[#191c1d] mb-4">Coming up</h2>
            <ul className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow divide-y divide-[#f3f4f5] overflow-hidden">
              {upNext.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/student/assignments/${a.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#f8f9fa] transition-colors focus:outline-none focus-visible:bg-[#f3f4f5]"
                  >
                    <span
                      className="hidden sm:inline-block w-16 text-center text-xs font-bold py-1 rounded-lg shrink-0"
                      style={{ backgroundColor: courseAccent(a.course_id).soft, color: courseAccent(a.course_id).hex }}
                    >
                      {a.course_code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#191c1d] truncate">{a.title}</p>
                      <p className={`text-xs mt-0.5 ${a.is_overdue ? 'text-[#D90429] font-semibold' : 'text-[#717973]'}`}>
                        {describeDeadline(a.due_date)}
                      </p>
                    </div>
                    <div className="hidden md:block"><TypeBadge type={a.submission_type} size="sm" /></div>
                    <StatusBadge assignment={a} size="sm" />
                    <ChevronRight className="w-4 h-4 text-[#c1c8c2] shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <EnrollCourseModal isOpen={isEnrollOpen} onClose={() => setIsEnrollOpen(false)} onEnrolled={load} />
    </DashboardLayout>
  );
}
