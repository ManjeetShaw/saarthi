import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import CardSkeleton from '../../components/ui/CardSkeleton.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import CreateGroupModal from '../../components/groups/CreateGroupModal.jsx';
import { getMyGroupsApi } from '../../api/groups.js';
import { getMyCoursesApi } from '../../api/courses.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { Users, Plus, Crown, ArrowRight } from 'lucide-react';

export default function StudentGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [groupData, courseData] = await Promise.all([getMyGroupsApi(), getMyCoursesApi()]);
      setGroups(groupData || []);
      setCourses(courseData || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your groups.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  // A student can be in one group per course, so only offer courses without one.
  const coursesWithoutGroup = courses.filter((c) => !groups.some((g) => g.course_id === c.id));

  return (
    <DashboardLayout title="My groups" subtitle="One group per course, for group assignments">
      <div className="space-y-6 pb-12">
        <FormAlert message={error} />

        <div className="flex items-center justify-between">
          <p className="text-sm text-[#717973]">{groups.length} {groups.length === 1 ? 'group' : 'groups'}</p>
          <Button icon={Plus} onClick={() => setIsCreateOpen(true)} disabled={courses.length > 0 && coursesWithoutGroup.length === 0}>
            Create a group
          </Button>
        </div>

        {isLoading ? (
          <CardSkeleton count={2} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="You are not in a group yet"
            message={courses.length === 0
              ? 'Enroll in a course first, then create a group for it or ask a classmate to add you.'
              : 'Create a group for one of your courses, or ask a classmate to add you to theirs.'}
            action={courses.length > 0 ? <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>Create a group</Button> : null}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {groups.map((group) => {
              const accent = courseAccent(group.course_id);
              return (
                <Link
                  key={group.id}
                  to={`/student/groups/${group.id}`}
                  className="group block bg-white rounded-2xl border border-[#e1e3e4] soft-shadow hover-lift overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#012d1d]"
                >
                  <div className="h-1.5" style={{ backgroundColor: accent.hex }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      {group.course_code && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: accent.soft, color: accent.hex }}>
                          {group.course_code}
                        </span>
                      )}
                      {group.is_leader ? (
                        <Badge variant="warning"><Crown className="w-3 h-3" /> Leader</Badge>
                      ) : (
                        <Badge variant="neutral">Member</Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-[#191c1d] mt-3">{group.name}</h3>
                    <p className="text-xs text-[#717973] mt-1">
                      {group.course_title} · {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                    </p>
                    {!group.is_leader && <p className="text-xs text-[#717973] mt-1">Leader: {group.leader_name}</p>}
                    <div className="flex items-center justify-end mt-4 text-sm font-semibold text-[#012d1d]">
                      Open <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        courses={coursesWithoutGroup}
        onGroupCreated={load}
      />
    </DashboardLayout>
  );
}
