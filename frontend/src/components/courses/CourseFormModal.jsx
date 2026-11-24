import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import FormAlert from '../ui/FormAlert.jsx';
import { BookPlus, Hash } from 'lucide-react';
import { createCourseApi, updateCourseApi } from '../../api/courses.js';
import { getErrorMessage, getFieldErrors } from '../../utils/apiErrors.js';

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,19}$/;

// Create (no `course`) or edit (`course` given) a course — professor only.
export default function CourseFormModal({ isOpen, onClose, onSaved, course }) {
  const isEditing = Boolean(course);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCode(course?.code || '');
    setTitle(course?.title || '');
    setDescription(course?.description || '');
    setFieldErrors({});
    setError('');
  }, [isOpen, course]);

  const clear = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (!code.trim()) errors.code = 'Please enter a course code.';
    else if (!CODE_PATTERN.test(code.trim())) errors.code = 'Use 2-20 letters, numbers or dashes, for example CS301.';
    if (!title.trim()) errors.title = 'Please enter a course title.';
    else if (title.trim().length > 150) errors.title = 'Course title must be 150 characters or fewer.';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const payload = { code: code.trim(), title: title.trim(), description: description.trim() };
      const saved = isEditing ? await updateCourseApi(course.id, payload) : await createCourseApi(payload);
      onClose();
      if (onSaved) onSaved(saved);
    } catch (err) {
      const serverFields = getFieldErrors(err);
      if (err.response?.status === 409) serverFields.code = getErrorMessage(err);
      if (Object.keys(serverFields).length) setFieldErrors(serverFields);
      else setError(getErrorMessage(err, 'Could not save the course. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit course' : 'Create a course'}
      subtitle={isEditing ? undefined : 'Students join with the course code'}
      icon={BookPlus}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Input
              label="Course code"
              placeholder="CS301"
              value={code}
              onChange={(e) => { setCode(e.target.value); clear('code'); }}
              icon={Hash}
              error={fieldErrors.code}
              autoFocus
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Course title"
              placeholder="Database Systems"
              value={title}
              onChange={(e) => { setTitle(e.target.value); clear('title'); }}
              error={fieldErrors.title}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="course-description" className="block text-sm font-semibold text-[#414844]">Description <span className="font-normal text-[#717973]">(optional)</span></label>
          <textarea
            id="course-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn in this course?"
            className="w-full rounded-xl bg-white border border-[#c1c8c2] focus:border-[#012d1d] focus:ring-2 focus:ring-[#012d1d]/10 px-3.5 py-2.5 text-sm outline-none transition-all"
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>{isEditing ? 'Save changes' : 'Create course'}</Button>
        </div>
      </form>
    </Modal>
  );
}
