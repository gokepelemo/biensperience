/**
 * User Invite Modal Component
 *
 * A simplified invite modal for regular users to invite friends.
 * Includes mutual follow option by default.
 */

import { useState } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { FaUserPlus, FaEnvelope } from 'react-icons/fa';
import { createInviteCode } from '../../utilities/invite-codes-service';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import { Button } from '../design-system';
import styles from './UserInviteModal.module.scss';

export default function UserInviteModal({ show, onHide, onInviteCreated }) {
  const { user } = useUser();
  const { success, error: showError } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    inviteeName: '',
    customMessage: '',
    sendEmail: true,
    mutualFollow: true // Default to true for user invites
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  const resetForm = () => {
    setFormData({
      email: '',
      inviteeName: '',
      customMessage: '',
      sendEmail: true,
      mutualFollow: true
    });
    setCreatedInvite(null);
  };

  const handleClose = () => {
    if (isCreating) return;
    resetForm();
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email && !formData.inviteeName) {
      showError('Please provide an email or name for the invite');
      return;
    }

    setIsCreating(true);
    try {
      const invite = await createInviteCode({
        email: formData.email || undefined,
        inviteeName: formData.inviteeName || undefined,
        customMessage: formData.customMessage || undefined,
        sendEmail: formData.sendEmail && !!formData.email,
        mutualFollow: formData.mutualFollow,
        maxUses: 1
      });

      setCreatedInvite(invite);

      const emailMsg = formData.sendEmail && formData.email && invite.emailSent
        ? ' - invite email sent!'
        : '';

      success(`Invite code created: ${invite.code}${emailMsg}`);
      logger.info('User invite code created', { code: invite.code, mutualFollow: formData.mutualFollow });

      // Notify parent component
      if (onInviteCreated) {
        onInviteCreated(invite);
      }
    } catch (err) {
      logger.error('Error creating user invite code', {}, err);
      showError(err.message || 'Failed to create invite code');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateAnother = () => {
    resetForm();
  };

  const copyToClipboard = async () => {
    if (!createdInvite) return;

    const signupUrl = `${window.location.origin}/signup?code=${createdInvite.code}`;
    try {
      await navigator.clipboard.writeText(signupUrl);
      success('Invite link copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = signupUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      success('Invite link copied to clipboard!');
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop="static"
      keyboard={!isCreating}
    >
      <Modal.Header closeButton={!isCreating}>
        <Modal.Title>
          <FaUserPlus className="me-2" />
          Invite a Friend
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {createdInvite ? (
          // Success state - show created invite
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <FaEnvelope />
            </div>
            <h5>Invite Created!</h5>
            <p className="text-muted mb-3">
              {formData.sendEmail && formData.email && createdInvite.emailSent
                ? `An invite has been sent to ${formData.email}`
                : 'Share this code with your friend to invite them'}
            </p>

            <div className={styles.codeDisplay}>
              {createdInvite.code}
            </div>

            <div className={styles.inviteLink}>
              <code>{window.location.origin}/signup?code={createdInvite.code}</code>
            </div>

            <div className="d-flex gap-2 justify-content-center mt-4">
              <Button variant="primary" onClick={copyToClipboard}>
                Copy Link
              </Button>
              <Button variant="outline" onClick={handleCreateAnother}>
                Create Another
              </Button>
            </div>

            {formData.mutualFollow && (
              <p className={styles.mutualFollowNote}>
                You'll automatically follow each other when they sign up!
              </p>
            )}
          </div>
        ) : (
          // Form state
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="friend@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isCreating}
                className={styles.formControl}
              />
              <Form.Text className="text-muted">
                If provided, we can send them an invite email
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Their Name (optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="John"
                value={formData.inviteeName}
                onChange={(e) => setFormData({ ...formData, inviteeName: e.target.value })}
                disabled={isCreating}
                className={styles.formControl}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Personal Message (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Hey! Join me on Biensperience..."
                value={formData.customMessage}
                onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                disabled={isCreating}
                className={styles.formControl}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="sendEmailCheckbox"
                label="Send invite email"
                checked={formData.sendEmail}
                onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                disabled={isCreating || !formData.email}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                id="mutualFollowCheckbox"
                label="Automatically follow each other"
                checked={formData.mutualFollow}
                onChange={(e) => setFormData({ ...formData, mutualFollow: e.target.checked })}
                disabled={isCreating}
              />
              <Form.Text className="text-muted">
                You'll both follow each other when they sign up
              </Form.Text>
            </Form.Group>

            <div className="d-flex gap-2 justify-content-end">
              <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Invite'}
              </Button>
            </div>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
}
