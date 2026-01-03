/**
 * Invite Code Modal Component
 *
 * Displays and manages invite codes (Super Admin only).
 * Allows super admins to:
 * - View all invite codes
 * - Generate single invite codes
 * - Bulk upload invites from CSV
 * - Configure experiences/destinations for invites
 */

import { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Button, Alert as BootstrapAlert, ListGroup, Badge, Tabs, Tab } from 'react-bootstrap';
import { FaEnvelope, FaUsers, FaUpload, FaDownload } from 'react-icons/fa';
import {
  getInviteCodes,
  createInviteCode,
  bulkCreateInviteCodes,
  deactivateInviteCode,
  parseCsvFile
} from '../../utilities/invite-codes-service';
import { eventBus } from '../../utilities/event-bus';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import Loading from '../Loading/Loading';
import Checkbox from '../Checkbox/Checkbox';
import { SearchableSelect } from '../FormField';
import styles from './InviteCodeModal.module.scss';

export default function InviteCodeModal({ show, onHide, experiences = [], destinations = [] }) {
  const [invites, setInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');

  // Single invite form
  const [singleForm, setSingleForm] = useState({
    email: '',
    inviteeName: '',
    experiences: [],
    destinations: [],
    maxUses: 1,
    customMessage: '',
    sendEmail: true  // Default to sending email
  });

  // Bulk upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [bulkExperiences, setBulkExperiences] = useState([]);
  const [bulkDestinations, setBulkDestinations] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const [sendBulkEmails, setSendBulkEmails] = useState(true);  // Default to sending emails

  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { success, error: showError } = useToast();

  // Event handlers for real-time invite updates
  const handleInviteCreated = useCallback((event) => {
    const invite = event.invite || event.detail?.invite;
    if (invite) {
      setInvites(prev => {
        // Avoid duplicates
        if (prev.some(i => i._id === invite._id || i.code === invite.code)) {
          return prev;
        }
        return [invite, ...prev];
      });
      logger.debug('[InviteCodeModal] Invite created event received', { inviteId: invite._id });
    }
  }, []);

  const handleInviteRedeemed = useCallback((event) => {
    const invite = event.invite || event.detail?.invite;
    const inviteId = invite?._id || event.inviteId || event.detail?.inviteId;
    if (inviteId) {
      setInvites(prev => prev.map(i => {
        if (i._id === inviteId || i.code === invite?.code) {
          return invite || { ...i, usedCount: (i.usedCount || 0) + 1 };
        }
        return i;
      }));
      logger.debug('[InviteCodeModal] Invite redeemed event received', { inviteId });
    }
  }, []);

  const handleInviteDeleted = useCallback((event) => {
    const inviteId = event.inviteId || event.detail?.inviteId;
    if (inviteId) {
      setInvites(prev => prev.filter(i => i._id !== inviteId));
      logger.debug('[InviteCodeModal] Invite deleted event received', { inviteId });
    }
  }, []);

  // Subscribe to invite events for real-time updates
  useEffect(() => {
    const unsubCreate = eventBus.subscribe('invite:created', handleInviteCreated);
    const unsubRedeem = eventBus.subscribe('invite:redeemed', handleInviteRedeemed);
    const unsubDelete = eventBus.subscribe('invite:deleted', handleInviteDeleted);

    return () => {
      unsubCreate();
      unsubRedeem();
      unsubDelete();
    };
  }, [handleInviteCreated, handleInviteRedeemed, handleInviteDeleted]);

  // Load invites when modal opens and reset state when it closes
  useEffect(() => {
    if (show) {
      setIsClosing(false); // Reset closing flag when modal opens
      loadInvites();
    } else {
      // Reset state when modal closes
      setActiveTab('list');
      setBulkResult(null);
      setCsvData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const loadInvites = async () => {
    setIsLoading(true);
    try {
      const data = await getInviteCodes();
      setInvites(data);
      logger.info('Invite codes loaded', { count: data.length });
    } catch (err) {
      logger.error('Error loading invite codes', {}, err);
      showError(lang.current.alert.failedToLoadInviteCodes);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSingle = async (e) => {
    e.preventDefault();

    setIsCreating(true);
    try {
      const invite = await createInviteCode(singleForm);
      setInvites([invite, ...invites]);
      setSingleForm({
        email: '',
        inviteeName: '',
        experiences: [],
        destinations: [],
        maxUses: 1,
        customMessage: '',
        sendEmail: true
      });
      const emailMsg = singleForm.sendEmail && singleForm.email && invite.emailSent
        ? ' (email sent)'
        : singleForm.sendEmail && singleForm.email && !invite.emailSent
        ? ' (email failed to send)'
        : '';
      const message = lang.current.notification?.invite?.created?.replace('{code}', invite.code).replace('{emailMsg}', emailMsg) || `Invite code created: ${invite.code}${emailMsg}`;
      success(message);
      setActiveTab('list');
      logger.info('Invite code created', { code: invite.code, emailSent: invite.emailSent });
    } catch (err) {
      logger.error('Error creating invite code', {}, err);
      showError(lang.current.alert.failedToCreateInviteCode);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFile(file);
    try {
      const data = await parseCsvFile(file);
      setCsvData(data);
      const message = lang.current.notification?.invite?.csvParsed?.replace('{count}', data.length) || `Parsed ${data.length} invites from CSV`;
      success(message);
    } catch (err) {
      logger.error('Error parsing CSV file', {}, err);
      showError(err.message || 'Failed to parse CSV file');
      setCsvFile(null);
      setCsvData(null);
    }
  };

  const handleBulkCreate = async () => {
    if (!csvData || csvData.length === 0) {
      showError(lang.current.alert.noCsvDataToProcess);
      return;
    }

    setIsCreating(true);
    try {
      // Add experiences and destinations to each invite
      const invitesWithResources = csvData.map(invite => ({
        ...invite,
        experiences: bulkExperiences,
        destinations: bulkDestinations,
        maxUses: 1
      }));

      const result = await bulkCreateInviteCodes(invitesWithResources, sendBulkEmails);
      setBulkResult(result);

      if (result.created.length > 0) {
        const emailMsg = sendBulkEmails && result.emailResults
          ? ` (${result.emailResults.sent} emails sent${result.emailResults.failed > 0 ? `, ${result.emailResults.failed} failed` : ''})`
          : '';
        const message = lang.current.notification?.invite?.bulkCreated?.replace('{count}', result.created.length).replace('{emailMsg}', emailMsg) || `Created ${result.created.length} invite codes${emailMsg}`;
        success(message);
        loadInvites(); // Refresh list
      }

      if (result.errors.length > 0) {
        showError(`${result.errors.length} invites failed to create`);
      }

      logger.info('Bulk invite codes created', {
        total: csvData.length,
        created: result.created.length,
        errors: result.errors.length
      });
    } catch (err) {
      logger.error('Error bulk creating invite codes', {}, err);
      showError(lang.current.alert.failedToCreateBulkInvites);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (inviteId) => {
    if (!window.confirm(lang.current.modal.deactivateInviteConfirm)) {
      return;
    }

    try {
      await deactivateInviteCode(inviteId);
      setInvites(invites.map(inv =>
        inv._id === inviteId ? { ...inv, isActive: false } : inv
      ));
      success(lang.current.notification?.invite?.deactivated || 'Invite code deactivated. It can no longer be used.');
      logger.info('Invite code deactivated', { inviteId });
    } catch (err) {
      logger.error('Error deactivating invite code', {}, err);
      showError(lang.current.alert.failedToDeactivateInviteCode);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadCsvTemplate = () => {
    const csvContent = 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invite_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    // Prevent multiple simultaneous close attempts
    if (isClosing) {
      logger.debug('Modal already closing, ignoring close request');
      return;
    }

    // Prevent closing while async operations are running
    if (isLoading || isCreating) {
      logger.debug('Cannot close modal - async operation in progress');
      return;
    }

    logger.debug('Invite Code Modal closing');
    setIsClosing(true);

    // Call parent's onHide immediately
    if (onHide) {
      onHide();
    }
  };

  const experienceOptions = experiences.map((exp) => ({
    value: exp._id,
    label: exp.name,
  }));

  const destinationOptions = destinations.map((dest) => ({
    value: dest._id,
    label: `${dest.name}, ${dest.country}`,
  }));

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      centered
      backdrop={true}
      keyboard={true}
      scrollable={true}
      key={show ? 'modal-open' : 'modal-closed'}
    >
      <Modal.Header>
        <Modal.Title>
          <FaEnvelope className="me-2" />
          Invite Codes
        </Modal.Title>
        <button
          type="button"
          className="btn-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
          {/* List Tab */}
          <Tab eventKey="list" title={`All Invites (${invites.length})`}>
            {isLoading ? (
              <Loading variant="centered" size="md" message="Loading invite codes..." />
            ) : invites.length === 0 ? (
              <BootstrapAlert variant="info">
                No invite codes found. Create one in the "Create Single" or "Bulk Upload" tabs.
              </BootstrapAlert>
            ) : (
              <ListGroup>
                {invites.map((invite) => (
                  <ListGroup.Item
                    key={invite._id}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong className={styles.codeDisplay}>{invite.code}</strong>
                        {invite.isActive ? (
                          <Badge className="badge badge-success">Active</Badge>
                        ) : (
                          <Badge className="badge badge-secondary">Inactive</Badge>
                        )}
                        {invite.usedCount > 0 && (
                          <Badge bg="info">Used {invite.usedCount}/{invite.maxUses || '∞'}</Badge>
                        )}
                      </div>
                      <div className="text-muted small">
                        {invite.email && <div>Email: {invite.email}</div>}
                        {invite.inviteeName && <div>Name: {invite.inviteeName}</div>}
                        <div>Created: {formatDate(invite.createdAt)}</div>
                        {invite.experiences?.length > 0 && (
                          <div>Experiences: {invite.experiences.length}</div>
                        )}
                        {invite.destinations?.length > 0 && (
                          <div>Destinations: {invite.destinations.length}</div>
                        )}
                      </div>
                    </div>
                    {invite.isActive && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeactivate(invite._id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Tab>

          {/* Create Single Tab */}
          <Tab eventKey="create" title={lang.current.inviteTracking.tabCreateSingle}>
            <Form onSubmit={handleCreateSingle}>
              <Form.Group className="mb-3">
                <Form.Label>Email (optional)</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="user@example.com"
                  value={singleForm.email}
                  onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
                  style={{
                    backgroundColor: 'var(--form-field-control-bg)',
                    border: 'var(--form-field-border)',
                    color: 'var(--form-field-control-color)',
                    fontSize: 'var(--form-field-control-font-size)',
                    padding: 'var(--form-field-control-padding)',
                    minHeight: 'var(--form-field-min-height)',
                    outline: 'var(--form-field-control-outline)',
                    boxShadow: 'var(--form-field-control-box-shadow)',
                    borderRadius: 'var(--form-field-border-radius)',
                  }}
                />
                <Form.Text>If provided, only this email can use the code</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Name (optional)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="John Doe"
                  value={singleForm.inviteeName}
                  onChange={(e) => setSingleForm({ ...singleForm, inviteeName: e.target.value })}
                  style={{
                    backgroundColor: 'var(--form-field-control-bg)',
                    border: 'var(--form-field-border)',
                    color: 'var(--form-field-control-color)',
                    fontSize: 'var(--form-field-control-font-size)',
                    padding: 'var(--form-field-control-padding)',
                    minHeight: 'var(--form-field-min-height)',
                    outline: 'var(--form-field-control-outline)',
                    boxShadow: 'var(--form-field-control-box-shadow)',
                    borderRadius: 'var(--form-field-border-radius)',
                  }}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Experiences (optional)</Form.Label>
                <SearchableSelect
                  multiple
                  options={experienceOptions}
                  value={singleForm.experiences}
                  onChange={(values) => setSingleForm({ ...singleForm, experiences: values })}
                  placeholder="Search and select experiences..."
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Destinations (optional)</Form.Label>
                <SearchableSelect
                  multiple
                  options={destinationOptions}
                  value={singleForm.destinations}
                  onChange={(values) => setSingleForm({ ...singleForm, destinations: values })}
                  placeholder="Search and select destinations..."
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Max Uses</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={singleForm.maxUses}
                  onChange={(e) => setSingleForm({ ...singleForm, maxUses: parseInt(e.target.value) })}
                  style={{
                    backgroundColor: 'var(--form-field-control-bg)',
                    border: 'var(--form-field-border)',
                    color: 'var(--form-field-control-color)',
                    fontSize: 'var(--form-field-control-font-size)',
                    padding: 'var(--form-field-control-padding)',
                    minHeight: 'var(--form-field-min-height)',
                    outline: 'var(--form-field-control-outline)',
                    boxShadow: 'var(--form-field-control-box-shadow)',
                    borderRadius: 'var(--form-field-border-radius)',
                  }}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Custom Message (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Welcome to Biensperience!"
                  value={singleForm.customMessage}
                  onChange={(e) => setSingleForm({ ...singleForm, customMessage: e.target.value })}
                  style={{
                    backgroundColor: 'var(--form-field-control-bg)',
                    border: 'var(--form-field-border)',
                    color: 'var(--form-field-control-color)',
                    fontSize: 'var(--form-field-control-font-size)',
                    padding: 'var(--form-field-control-padding)',
                    outline: 'var(--form-field-control-outline)',
                    boxShadow: 'var(--form-field-control-box-shadow)',
                    borderRadius: 'var(--form-field-border-radius)',
                  }}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Checkbox
                  id="sendEmailCheckbox"
                  label="Send invite email"
                  checked={singleForm.sendEmail}
                  onChange={(e) => setSingleForm({ ...singleForm, sendEmail: e.target.checked })}
                />
                <Form.Text className="text-muted">
                  {singleForm.email
                    ? `Email will be sent to ${singleForm.email}`
                    : 'Email address required to send invite email'}
                </Form.Text>
              </Form.Group>

              <Button type="submit" variant="primary" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Invite Code'}
              </Button>
            </Form>
          </Tab>

          {/* Bulk Upload Tab */}
          <Tab eventKey="bulk" title={lang.current.inviteTracking.tabBulkUpload}>
            <div className="mb-3">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={downloadCsvTemplate}
                className="mb-3"
              >
                <FaDownload className="me-1" /> Download CSV Template
              </Button>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Upload CSV File</Form.Label>
              <Form.Control
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <Form.Text>
                CSV must have "name" and "email" columns
              </Form.Text>
            </Form.Group>

            {csvData && (
              <>
                <BootstrapAlert variant="success">
                  Loaded {csvData.length} invites from CSV
                </BootstrapAlert>

                <Form.Group className="mb-3">
                  <Form.Label>Apply Experiences to All (optional)</Form.Label>
                  <Form.Select
                    multiple
                    value={bulkExperiences}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setBulkExperiences(selected);
                    }}
                    size="sm"
                    style={{ height: '100px' }}
                  >
                    {experiences.map((exp) => (
                      <option key={exp._id} value={exp._id}>
                        {exp.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Apply Destinations to All (optional)</Form.Label>
                  <Form.Select
                    multiple
                    value={bulkDestinations}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setBulkDestinations(selected);
                    }}
                    size="sm"
                    style={{ height: '100px' }}
                  >
                    {destinations.map((dest) => (
                      <option key={dest._id} value={dest._id}>
                        {dest.name}, {dest.country}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Checkbox
                    id="send-bulk-emails"
                    label="Send email invitations to all recipients"
                    checked={sendBulkEmails}
                    onChange={(e) => setSendBulkEmails(e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    If checked, each recipient will receive an email with their unique invite code and signup link
                  </Form.Text>
                </Form.Group>

                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={handleBulkCreate}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : `Create ${csvData.length} Invite Code${csvData.length > 1 ? 's' : ''}`}
                  </Button>
                  {sendBulkEmails && (
                    <Badge bg="info">
                      Will send {csvData.length} email{csvData.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </>
            )}

            {bulkResult && (
              <div className="mt-3">
                <BootstrapAlert variant="info">
                  <strong>Results:</strong> Created {bulkResult.created.length} invite{bulkResult.created.length > 1 ? 's' : ''}
                  {bulkResult.errors.length > 0 && `, ${bulkResult.errors.length} failed`}
                  {bulkResult.emailResults && (
                    <>
                      <br />
                      <strong>Emails:</strong> {bulkResult.emailResults.sent} sent
                      {bulkResult.emailResults.failed > 0 && `, ${bulkResult.emailResults.failed} failed`}
                    </>
                  )}
                </BootstrapAlert>

                {bulkResult.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul>
                      {bulkResult.errors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row} ({err.email}): {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
