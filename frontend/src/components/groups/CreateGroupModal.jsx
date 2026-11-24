import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import FormAlert from '../ui/FormAlert.jsx';
import { Users } from 'lucide-react';
import { createGroupApi } from '../../api/groups.js';
import { getErrorMessage, getFieldErrors } from '../../utils/apiErrors.js';

// A group always belongs to one course. `courses` are the ones the student
// is enrolled in; `defaultCourseId` pre-selects when opened from a course page.
export default function CreateGroupModal({ isOpen, onClose, onGroupCreated, courses = [], defaultCourseId }) {
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setCourseId(String(defaultCourseId || courses[0]?.id || ''));
    setFieldErrors({});
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultCourseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!courseId) errors.course_id = 'Please choose the course this group is for.';
    if (!name.trim()) errors.name = 'Please enter a group name.';
    else if (name.trim().length > 100) errors.name = 'Group name must be 100 characters or fewer.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const newGroup = await createGroupApi({ name: name.trim(), course_id: Number(courseId) });
      onClose();
      if (onGroupCreated) onGroupCreated(newGroup);
    } catch (err) {
      const serverFields = getFieldErrors(err);
      if (Object.keys(serverFields).length) setFieldErrors(serverFields);
      else setError(getErrorMessage(err, 'Failed to create group. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a group"
      subtitle="You become the group leader"
      icon={Users}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />

        <Select
          label="Course"
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setFieldErrors((p) => ({ ...p, course_id: undefined })); setError(''); }}
          error={fieldErrors.course_id}
          helperText={courses.length === 0 ? 'Enroll in a course first, then create a group for it.' : undefined}
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
          ))}
        </Select>

        <Input
          label="Group name"
          placeholder="e.g. Team Alpha, Web Wizards"
          value={name}
          onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined })); setError(''); }}
          error={fieldErrors.name}
          autoFocus
        />

        <div className="bg-[#f8f9fa] border border-[#e1e3e4] rounded-xl p-3 text-xs text-[#414844] space-y-1">
          <p className="font-semibold text-[#191c1d]">As the leader you can:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[#717973]">
            <li>Add classmates from this course by email or student ID</li>
            <li>Acknowledge group submissions for the whole group</li>
            <li>Remove members or disband the group</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Create group</Button>
        </div>
      </form>
    </Modal>
  );
}
