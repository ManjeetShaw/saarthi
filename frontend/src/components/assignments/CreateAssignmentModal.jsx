import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import FormAlert from '../ui/FormAlert.jsx';
import { FilePlus, Calendar, Link as LinkIcon, User, Users } from 'lucide-react';
import { createAssignmentApi, updateAssignmentApi } from '../../api/assignments.js';
import { getErrorMessage, getFieldErrors } from '../../utils/apiErrors.js';

// <input type="datetime-local"> wants local time without a zone: "2026-11-30T17:00"
function toLocalInput(value) {
  const d = value ? new Date(value) : new Date(Date.now() + 7 * 86400000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual', icon: User, hint: 'Every student acknowledges their own submission.' },
  { value: 'group', label: 'Group', icon: Users, hint: 'Only each group leader acknowledges, for the whole group.' },
];

export default function CreateAssignmentModal({ isOpen, onClose, onSaved, assignmentToEdit, courses = [], defaultCourseId }) {
  const isEditing = Boolean(assignmentToEdit);

  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState('group');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCourseId(String(assignmentToEdit?.course_id || defaultCourseId || courses[0]?.id || ''));
    setTitle(assignmentToEdit?.title || '');
    setDescription(assignmentToEdit?.description || '');
    setDueDate(toLocalInput(assignmentToEdit?.due_date));
    setLink(assignmentToEdit?.onedrive_link || '');
    setType(assignmentToEdit?.submission_type || 'group');
    setFieldErrors({});
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, assignmentToEdit, defaultCourseId]);

  const clear = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (!courseId) errors.course_id = 'Please choose a course for this assignment.';
    if (!title.trim()) errors.title = 'Please enter an assignment title.';
    else if (title.trim().length > 150) errors.title = 'Title must be 150 characters or fewer.';
    if (!dueDate) errors.due_date = 'Please choose a due date and time.';
    if (!link.trim()) errors.onedrive_link = 'Please add the OneDrive or repository link.';
    else if (!/^https?:\/\/\S+\.\S+/.test(link.trim())) errors.onedrive_link = 'Please enter a full link starting with https://';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Please fix the highlighted fields and try again.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        due_date: new Date(dueDate).toISOString(),
        onedrive_link: link.trim(),
        submission_type: type,
      };
      const saved = isEditing
        ? await updateAssignmentApi(assignmentToEdit.id, payload)
        : await createAssignmentApi({ ...payload, course_id: Number(courseId) });
      onClose();
      if (onSaved) onSaved(saved);
    } catch (err) {
      const serverFields = getFieldErrors(err);
      if (Object.keys(serverFields).length) {
        setFieldErrors(serverFields);
        setError('Please fix the highlighted fields and try again.');
      } else {
        setError(getErrorMessage(err, 'Could not save the assignment. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit assignment' : 'Create assignment'}
      subtitle="Students in the course see it straight away"
      icon={FilePlus}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />

        <Select
          label="Course"
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); clear('course_id'); }}
          disabled={isEditing}
          error={fieldErrors.course_id}
          helperText={isEditing ? 'The course cannot be changed after creation.' : undefined}
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
          ))}
        </Select>

        <Input
          label="Assignment title"
          placeholder="e.g. ER Diagram & Normalization"
          value={title}
          onChange={(e) => { setTitle(e.target.value); clear('title'); }}
          error={fieldErrors.title}
          autoFocus
        />

        <div className="space-y-1.5">
          <label htmlFor="assignment-description" className="block text-sm font-semibold text-[#414844]">
            Description <span className="font-normal text-[#717973]">(optional)</span>
          </label>
          <textarea
            id="assignment-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should students deliver, and how will it be assessed?"
            className="w-full rounded-xl bg-white border border-[#c1c8c2] focus:border-[#012d1d] focus:ring-2 focus:ring-[#012d1d]/10 px-3.5 py-2.5 text-sm outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Due date & time"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); clear('due_date'); }}
            icon={Calendar}
            error={fieldErrors.due_date}
          />
          <Input
            label="OneDrive / repo link"
            type="url"
            placeholder="https://onedrive.live.com/..."
            value={link}
            onChange={(e) => { setLink(e.target.value); clear('onedrive_link'); }}
            icon={LinkIcon}
            error={fieldErrors.onedrive_link}
          />
        </div>

        <fieldset className="space-y-2 pt-3 border-t border-[#f3f4f5]">
          <legend className="text-sm font-semibold text-[#414844] mb-2">Submission type</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={`flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                  type === value
                    ? 'bg-[#012d1d] text-white border-[#012d1d]'
                    : 'bg-white text-[#414844] border-[#c1c8c2] hover:bg-[#f3f4f5]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#717973]">{TYPE_OPTIONS.find((o) => o.value === type).hint}</p>
        </fieldset>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f3f4f5]">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>{isEditing ? 'Save changes' : 'Create assignment'}</Button>
        </div>
      </form>
    </Modal>
  );
}
