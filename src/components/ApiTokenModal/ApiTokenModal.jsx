/**
 * API Token Modal Component
 *
 * Displays and manages API tokens for the current user.
 * Allows users to:
 * - Enable/disable API access
 * - View existing tokens
 * - Generate new tokens
 * - Revoke/delete tokens
 */

import { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button, Alert as BootstrapAlert, ListGroup, Badge } from 'react-bootstrap';
import { FaCopy, FaTrash, FaKey } from 'react-icons/fa';
import { getApiTokens, createApiToken, deleteApiToken, toggleApiAccess } from '../../utilities/api-tokens-service';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import Loading from '../Loading/Loading';
import './ApiTokenModal.css';

export default function ApiTokenModal({ show, onHide, user, onUserUpdate }) {
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newToken, setNewToken] = useState(null); // Plain token (only shown once)
  const [newTokenName, setNewTokenName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [apiEnabled, setApiEnabled] = useState(user?.apiEnabled || false);
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { success, error: showError } = useToast();
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load tokens when modal opens and reset state when it closes
  useEffect(() => {
    if (show) {
      setIsClosing(false); // Reset closing flag when modal opens
      loadTokens();
      // Only set apiEnabled when modal opens, not when user changes
      setApiEnabled(user?.apiEnabled || false);
    } else {
      // Reset state when modal closes
      setNewToken(null);
      setNewTokenName('');
      setIsCreating(false);
      setIsTogglingAccess(false);
      setApiEnabled(false); // Reset apiEnabled when closing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]); // Only depend on show, not user

  const loadTokens = async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    try {
      const data = await getApiTokens();

      if (!isMountedRef.current) return; // Check before updating state

      setTokens(data);
      logger.info('API tokens loaded', { count: data.length });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error loading API tokens', {}, err);
      showError('Failed to load API tokens');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleToggleApiAccess = async () => {
    if (!isMountedRef.current) return;

    setIsTogglingAccess(true);
    try {
      const result = await toggleApiAccess(!apiEnabled);

      if (!isMountedRef.current) return;

      setApiEnabled(result.apiEnabled);

      // Notify parent to refresh user data after a short delay to avoid interfering with modal close
      if (onUserUpdate) {
        setTimeout(() => {
          onUserUpdate();
        }, 100);
      }

      if (result.apiEnabled) {
        success('API access enabled');
      } else {
        success('API access disabled and all tokens revoked');
        setTokens([]); // Clear tokens list
      }

      logger.info('API access toggled', { enabled: result.apiEnabled });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error toggling API access', {}, err);
      showError('Failed to toggle API access');
    } finally {
      if (isMountedRef.current) {
        setIsTogglingAccess(false);
      }
    }
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();

    if (!isMountedRef.current) return;

    if (!apiEnabled) {
      showError('Please enable API access first');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createApiToken({
        name: newTokenName || 'API Token',
      });

      if (!isMountedRef.current) return;

      setNewToken(result.token); // Store plain token for display
      setTokens([...tokens, result.tokenData]);
      setNewTokenName('');
      success(lang.en.success.apiTokenCreated);
      logger.info('API token created', { tokenId: result.tokenData._id });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error creating API token', {}, err);
      showError('Failed to create API token');
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
      }
    }
  };

  const handleCopyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      success('Token copied to clipboard');
    } catch (err) {
      logger.error('Error copying token', {}, err);
      showError('Failed to copy token');
    }
  };

  const handleDeleteToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    if (!isMountedRef.current) return;

    try {
      await deleteApiToken(tokenId);

      if (!isMountedRef.current) return;

      setTokens(tokens.filter(t => t._id !== tokenId));
      success('Token revoked successfully');
      logger.info('API token deleted', { tokenId });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error deleting API token', {}, err);
      showError('Failed to revoke token');
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

  const handleClose = () => {
    // Prevent multiple simultaneous close attempts
    if (isClosing) {
      logger.debug('Modal already closing, ignoring close request');
      return;
    }

    // Prevent closing while async operations are running
    if (isLoading || isCreating || isTogglingAccess) {
      logger.debug('Cannot close modal - async operation in progress');
      return;
    }

    logger.debug('API Token Modal closing');
    setIsClosing(true);

    // Call parent's onHide immediately
    if (onHide) {
      onHide();
    }
  };

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
          <FaKey className="me-2" />
          API Tokens
        </Modal.Title>
        <button 
          type="button" 
          className="btn-close" 
          onClick={handleClose} 
          aria-label="Close"
        ></button>
      </Modal.Header>
      <Modal.Body>
        {/* API Access Toggle */}
        <div className="api-access-toggle mb-4 p-3 border rounded">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-1">API Access</h5>
              <p className="text-muted mb-0 small">
                Enable API access to use API tokens for programmatic access
              </p>
            </div>
            <Form.Check
              type="switch"
              id="api-access-switch"
              checked={apiEnabled}
              onChange={handleToggleApiAccess}
              disabled={isTogglingAccess}
              label=""
              className="fs-4"
            />
          </div>
        </div>

        {!apiEnabled && (
          <BootstrapAlert variant="info">
            API access is currently disabled. Enable it above to create and use API tokens.
          </BootstrapAlert>
        )}

        {apiEnabled && (
          <>
            {/* New Token Display (shown only once after creation) */}
            {newToken && (
              <BootstrapAlert variant="success" className="mb-4">
                <h5>New Token Created!</h5>
                <p className="mb-2">
                  Make sure to copy your token now. You won't be able to see it again!
                </p>
                <div className="d-flex align-items-center gap-2">
                  <code className="flex-grow-1 p-2 bg-light rounded border user-select-all">
                    {newToken}
                  </code>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleCopyToken(newToken)}
                  >
                    <FaCopy /> Copy
                  </Button>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setNewToken(null)}
                  className="mt-2 p-0"
                >
                  I've copied it, dismiss this message
                </Button>
              </BootstrapAlert>
            )}

            {/* Create New Token Form */}
            <Form onSubmit={handleCreateToken} className="mb-4">
              <h5>Create New Token</h5>
              <div className="row g-2 align-items-end">
                <div className="col">
                  <Form.Control
                    type="text"
                    placeholder={lang.en.placeholder.tokenNameOptional}
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                <div className="col-auto">
                  <Button
                    type="submit"
                    variant="primary"
                    className="generate-token"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Generate Token'}
                  </Button>
                </div>
              </div>
              <Form.Text className="text-muted">
                Give your token a descriptive name to remember what it's for.
              </Form.Text>
            </Form>

            {/* Existing Tokens List */}
            <h5>Your Tokens</h5>
            {isLoading ? (
              <Loading size="md" message="Loading tokens..." />
            ) : tokens.length === 0 ? (
              <BootstrapAlert variant="info">
                You don't have any API tokens yet. Create one above to get started.
              </BootstrapAlert>
            ) : (
              <ListGroup>
                {tokens.map((token) => (
                  <ListGroup.Item
                    key={token._id}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong>{token.name}</strong>
                        {token.isActive ? (
                          <Badge bg="success">Active</Badge>
                        ) : (
                          <Badge bg="secondary">Revoked</Badge>
                        )}
                      </div>
                      <div className="text-muted small">
                        <div>Prefix: <code>{token.tokenPrefix}...</code></div>
                        <div>Created: {formatDate(token.createdAt)}</div>
                        {token.lastUsed && (
                          <div>Last used: {formatDate(token.lastUsed)}</div>
                        )}
                        {token.expiresAt && (
                          <div>Expires: {formatDate(token.expiresAt)}</div>
                        )}
                      </div>
                    </div>
                    {token.isActive && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteToken(token._id)}
                      >
                        <FaTrash /> Revoke
                      </Button>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}

            {/* Usage Instructions */}
            <div className="mt-4 p-3 bg-light rounded">
              <h6>How to use your API token:</h6>
              <ol className="mb-0 small">
                <li>Include the token in the <code>Authorization</code> header</li>
                <li>Format: <code>Authorization: Bearer YOUR_TOKEN_HERE</code></li>
                <li>API tokens bypass CSRF protection</li>
                <li>Tokens have the same permissions as your user account</li>
              </ol>
              <div className="mt-2">
                <strong>Example:</strong>
                <pre className="bg-white p-2 rounded border mt-1 mb-0">
{`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  ${window.location.origin}/api/experiences`}
                </pre>
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
