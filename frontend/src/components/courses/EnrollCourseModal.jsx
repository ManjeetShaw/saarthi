import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import FormAlert from '../ui/FormAlert.jsx';
import { BookOpen, Hash } from 'lucide-react';
import { enrollInCourseApi } from '../../api/courses.js';
import { getErrorMessage } from '../../utils/apiErrors.js';

export default function EnrollCourseModal({ isOpen, onClose, onEnrolled }) {
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setCode('');
    setFieldError('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setFieldError('Please enter the course code your professor shared.');
      return;
    }
    setFieldError('');
    setError('');
    setIsLoading(true);
    try {
      const result = await enrollInCourseApi(code.trim());
      setCode('');
      onClose();
      if (onEnrolled) onEnrolled(result.course);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not enroll. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Enroll in a course"
      subtitle="Use the code your professor shared"
      icon={BookOpen}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        <Input
          label="Course code"
          placeholder="e.g. CS301"
          value={code}
          onChange={(e) => { setCode(e.target.value); setFieldError(''); setError(''); }}
          icon={Hash}
          error={fieldError}
          autoFocus
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Enroll</Button>
        </div>
      </form>
    </Modal>
  );
}
