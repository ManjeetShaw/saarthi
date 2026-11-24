import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import FormAlert from '../ui/FormAlert.jsx';
import { CheckCircle2, Users } from 'lucide-react';
import { acknowledgeSubmissionApi } from '../../api/submissions.js';
import { getErrorMessage } from '../../utils/apiErrors.js';

// Two deliberate steps so nobody acknowledges by accident: tick the
// statement, then confirm. For a group the dialog says plainly who the
// acknowledgment will cover.
export default function AcknowledgeModal({ isOpen, onClose, assignment, onAcknowledged }) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setChecked(false);
      setError('');
    }
  }, [isOpen]);

  if (!assignment) return null;
  const isGroup = assignment.submission_type === 'group';
  const memberNames = (assignment.members || []).map((m) => m.name);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError('');
    try {
      await acknowledgeSubmissionApi(assignment.id);
      onClose();
      if (onAcknowledged) onAcknowledged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not acknowledge the submission. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Acknowledge submission"
      subtitle={assignment.title}
      icon={CheckCircle2}
    >
      <div className="space-y-4">
        <FormAlert message={error} />

        {isGroup && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f3e9ff] border border-[#d3bcfc] text-xs text-[#2e1b50]">
            <Users className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              As group leader you are acknowledging for <strong>{assignment.group_name}</strong>.
              This marks the assignment as submitted for all {memberNames.length} members
              {memberNames.length > 0 && <> ({memberNames.join(', ')})</>}.
            </p>
          </div>
        )}

        <label className="flex items-start gap-3 p-3 rounded-xl border border-[#c1c8c2] cursor-pointer hover:bg-[#f8f9fa] transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#c1c8c2] text-[#012d1d] focus:ring-[#012d1d]"
          />
          <span className="text-sm text-[#191c1d]">
            {isGroup
              ? "I confirm our group's final work has been uploaded to the shared OneDrive workspace."
              : 'I confirm my final work has been uploaded to the shared OneDrive workspace.'}
          </span>
        </label>
        <p className="text-xs text-[#717973]">This cannot be undone.</p>

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!checked} isLoading={isLoading} icon={CheckCircle2}>
            {isGroup ? 'Acknowledge for group' : 'Acknowledge'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
