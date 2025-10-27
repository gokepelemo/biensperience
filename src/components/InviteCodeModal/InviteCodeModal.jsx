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

import { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert as BootstrapAlert, ListGroup, Badge, Tabs, Tab } from 'react-bootstrap';
import { FaEnvelope, FaUsers, FaUpload, FaDownload } from 'react-icons/fa';
import {
  getInviteCodes,
  createInviteCode,
  bulkCreateInviteCodes,
  deactivateInviteCode,
  parseCsvFile
} from '../../utilities/invite-codes-service';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import './InviteCodeModal.css';

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
    customMessage: ''
  });

  // Bulk upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [bulkExperiences, setBulkExperiences] = useState([]);
  const [bulkDestinations, setBulkDestinations] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const [sendBulkEmails, setSendBulkEmails] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const { success, error: showError } = useToast();

  // Load invites when modal opens
  useEffect(() => {
    if (show) {
      loadInvites();
    }
  }, [show]);

  const loadInvites = async () => {
    setIsLoading(true);
    try {
      const data = await getInviteCodes();
      setInvites(data);
      logger.info('Invite codes loaded', { count: data.length });
    } catch (err) {
      logger.error('Error loading invite codes', {}, err);
      showError('Failed to load invite codes');
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
        customMessage: ''
      });
      success(`Invite code created: ${invite.code}`);
      setActiveTab('list');
      logger.info('Invite code created', { code: invite.code });
    } catch (err) {
      logger.error('Error creating invite code', {}, err);
      showError('Failed to create invite code');
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
      success(`Parsed ${data.length} invites from CSV`);
    } catch (err) {
      logger.error('Error parsing CSV file', {}, err);
      showError(err.message || 'Failed to parse CSV file');
      setCsvFile(null);
      setCsvData(null);
    }
  };

  const handleBulkCreate = async () => {
    if (!csvData || csvData.length === 0) {
      showError('No CSV data to process');
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
        success(`Created ${result.created.length} invite codes${emailMsg}`);
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
      showError('Failed to create bulk invites');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (inviteId) => {
    if (!window.confirm('Are you sure you want to deactivate this invite code?')) {
      return;
    }

    try {
      await deactivateInviteCode(inviteId);
      setInvites(invites.map(inv =>
        inv._id === inviteId ? { ...inv, isActive: false } : inv
      ));
      success('Invite code deactivated');
      logger.info('Invite code deactivated', { inviteId });
    } catch (err) {
      logger.error('Error deactivating invite code', {}, err);
      showError('Failed to deactivate invite code');
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

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaEnvelope className="me-2" />
          Invite Codes
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
          {/* List Tab */}
          <Tab eventKey="list" title={`All Invites (${invites.length})`}>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
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
                        <strong className="code-display">{invite.code}</strong>
                        {invite.isActive ? (
                          <Badge bg="success">Active</Badge>
                        ) : (
                          <Badge bg="secondary">Inactive</Badge>
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
          <Tab eventKey="create" title="Create Single">
            <Form onSubmit={handleCreateSingle}>
              <Form.Group className="mb-3">
                <Form.Label>Email (optional)</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="user@example.com"
                  value={singleForm.email}
                  onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
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
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Experiences (optional)</Form.Label>
                <Form.Select
                  multiple
                  value={singleForm.experiences}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSingleForm({ ...singleForm, experiences: selected });
                  }}
                  size="sm"
                  style={{ height: '100px' }}
                >
                  {experiences.map((exp) => (
                    <option key={exp._id} value={exp._id}>
                      {exp.title}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text>Hold Ctrl/Cmd to select multiple</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Destinations (optional)</Form.Label>
                <Form.Select
                  multiple
                  value={singleForm.destinations}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSingleForm({ ...singleForm, destinations: selected });
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
                <Form.Text>Hold Ctrl/Cmd to select multiple</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Max Uses</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={singleForm.maxUses}
                  onChange={(e) => setSingleForm({ ...singleForm, maxUses: parseInt(e.target.value) })}
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
                />
              </Form.Group>

              <Button type="submit" variant="primary" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Invite Code'}
              </Button>
            </Form>
          </Tab>

          {/* Bulk Upload Tab */}
          <Tab eventKey="bulk" title="Bulk Upload">
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
                        {exp.title}
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
                  <Form.Check
                    type="checkbox"
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
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
