import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import CreateGroupModal from '../../components/groups/CreateGroupModal.jsx';
import { getCourseApi } from '../../api/courses.js';
import { getMyAssignmentsApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { deadlineLine, percentOf } from '../../utils/assignmentStatus.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { formatDate } from '../../utils/formatters.js';
import { ChevronLeft, ChevronRight, FileText, Users, Crown, UserPlus } from 'lucide-react';

export default function StudentCourseDetail() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  const load = async () => {
    try {
      setError('');
      const [courseData, assignmentData] = await Promise.all([getCourseApi(courseId), getMyAssignmentsApi(courseId)]);
      setCourse(courseData);
      setAssignments(assignmentData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this course.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { setIsLoading(true); load(); /* eslint-disable-next-line */ }, [courseId]);

  const accent = courseAccent(course?.id || courseId);
  const acknowledged = assignments.filter((a) => a.is_acknowledged).length;
  const pct = percentOf(acknowledged, assignments.length);
  const hasGroupAssignments = assignments.some((a) => a.submission_type === 'group');
  const group = course?.my_group;

  return (
    <DashboardLayout title={course ? course.title : 'Course'} subtitle={course ? `${course.code} · ${course.professor_name}` : ''}>
      <div className="space-y-6 pb-12">
        <Link to="/student/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#414844] hover:text-[#012d1d]">
          <ChevronLeft className="w-4 h-4" /> All courses
        </Link>

        <FormAlert message={error} />

        {course && (
          <>
            <div className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: accent.hex }} />
              <div className="p-6 grid gap-6 md:grid-cols-[1fr_16rem] items-center">
                <div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: accent.soft, color: accent.hex }}>
                    {course.code}
                  </span>
                  <p className="text-sm text-[#414844] mt-3 max-w-2xl">
                    {course.description || 'No course description provided.'}
                  </p>
                  <p className="text-xs text-[#717973] mt-3">
                    Taught by {course.professor_name} · {course.student_count} students enrolled
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-sm mb-2">
                    <span className="text-[#414844]">Your progress</span>
                    <span className="font-bold text-[#191c1d]">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} color="success" size="lg" />
                  <p className="text-xs text-[#717973] mt-2">{acknowledged} of {assignments.length} assignments acknowledged</p>
                </div>
              </div>
            </div>

            {/* Group status for this course — matters for group assignments */}
            <div className="bg-white rounded-2xl border border-[#e1e3e4] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f3e9ff] text-[#2e1b50] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                {group ? (
                  <div>
                    <p className="font-semibold text-[#191c1d] flex items-center gap-2">
                      {group.name}
                      {group.is_leader && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b56000] bg-[#FB8500]/10 px-2 py-0.5 rounded-full">
                          <Crown className="w-3 h-3" /> Leader
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#717973]">
                      {group.is_leader ? 'You acknowledge group submissions for your team.' : `Group leader: ${group.leader_name}`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-[#191c1d]">You are not in a group for this course</p>
                    <p className="text-xs text-[#717973]">
                      {hasGroupAssignments ? 'Group assignments need a group before they can be acknowledged.' : 'Create one when a group assignment comes up.'}
                    </p>
                  </div>
                )}
              </div>
              {group ? (
                <Link to={`/student/groups/${group.id}`} className="text-sm font-semibold text-[#012d1d] hover:underline">View group</Link>
              ) : (
                <Button size="sm" icon={UserPlus} onClick={() => setIsGroupOpen(true)}>Create a group</Button>
              )}
            </div>

            <section aria-labelledby="course-assignments">
              <h2 id="course-assignments" className="font-bold text-lg text-[#191c1d] mb-4">Assignments</h2>
              {assignments.length === 0 ? (
                <EmptyState icon={FileText} title="No assignments yet" message="Your professor has not posted any assignments for this course." />
              ) : (
                <ul className="space-y-3">
                  {assignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/student/assignments/${a.id}`}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white rounded-2xl border border-[#e1e3e4] px-5 py-4 hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[#012d1d]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#191c1d]">{a.title}</p>
                          <p className={`text-xs mt-1 ${a.is_overdue ? 'text-[#D90429] font-semibold' : 'text-[#717973]'}`}>
                            {deadlineLine(a, formatDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <TypeBadge type={a.submission_type} size="sm" />
                          <StatusBadge assignment={a} size="sm" />
                          <ChevronRight className="w-4 h-4 text-[#c1c8c2] hidden sm:block" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {isLoading && !course && !error && <p className="text-sm text-[#717973]">Loading course…</p>}
      </div>

      <CreateGroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        courses={course ? [course] : []}
        defaultCourseId={course?.id}
        onGroupCreated={load}
      />
    </DashboardLayout>
  );
}
