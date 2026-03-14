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
import { Modal, Form, Button, Alert, Pill, ListGroup } from '../design-system';
import { FaCopy, FaTrash, FaKey } from 'react-icons/fa';
import { getApiTokens, createApiToken, deleteApiToken, toggleApiAccess } from '../../utilities/api-tokens-service';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import Loading from '../Loading/Loading';
import Toggle from '../Toggle';
import styles from './ApiTokenModal.module.css';

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
      showError(lang.current.api.failedToLoadTokens);
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
      logger.debug('ApiTokenModal: handleToggleApiAccess called', { current: apiEnabled, intended: !apiEnabled });
      const result = await toggleApiAccess(!apiEnabled);

      logger.debug('ApiTokenModal: toggleApiAccess result', { result });
      if (!isMountedRef.current) return;

      setApiEnabled(result.apiEnabled);

      // Notify parent to refresh user data after a short delay to avoid interfering with modal close
      if (onUserUpdate) {
        logger.debug('ApiTokenModal: calling onUserUpdate to refresh parent user data');
        setTimeout(() => {
          onUserUpdate();
        }, 100);
      }

      if (result.apiEnabled) {
        success(lang.current.notification?.api?.accessEnabled || 'API access enabled. You can now create tokens below.');
      } else {
        success(lang.current.notification?.api?.accessDisabled || 'API access disabled. All existing tokens have been revoked for security.');
        setTokens([]); // Clear tokens list
      }

      logger.info('API access toggled', { enabled: result.apiEnabled });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error toggling API access', { error: err.message }, err);
      showError(lang.current.api.failedToToggleAccess || 'Failed to toggle API access');
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
      success(lang.current.notification?.api?.tokenCreated || "Your new API token is ready. Copy it now - you won't see it again!");
      logger.info('API token created', { tokenId: result.tokenData._id });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error creating API token', {}, err);
      showError(lang.current.api.failedToCreateToken || 'Failed to create API token');
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
      }
    }
  };

  const handleCopyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      success(lang.current.notification?.api?.tokenCopied || 'Token copied! Paste it in your application to connect.');
    } catch (err) {
      logger.error('Error copying token', {}, err);
      showError(lang.current.api.failedToCopyToken || 'Failed to copy token');
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
      success(lang.current.notification?.api?.tokenRevoked || 'Token revoked. It can no longer be used to access your data.');
      logger.info('API token deleted', { tokenId });
    } catch (err) {
      if (!isMountedRef.current) return;

      logger.error('Error deleting API token', {}, err);
      showError(lang.current.api.failedToRevokeToken || 'Failed to revoke token');
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
      onClose={handleClose}
      size="xl"
      scrollable={true}
      title={<><FaKey className={styles.iconSpacer} />API Tokens</>}
      footer={
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      }
    >
        {/* API Access Toggle */}
        <div className={styles.apiAccessToggle}>
          <div className={styles.apiAccessToggleRow}>
            <Toggle
              name="apiAccess"
              variant="success"
              size="lg"
              checked={apiEnabled}
              onChange={handleToggleApiAccess}
              disabled={isTogglingAccess}
            />
            <label className={styles.apiAccessToggleLabel} htmlFor="apiAccess">
              <span className={styles.apiAccessToggleTitle}>{lang.current.api.accessTitle}</span>
              <span className={styles.apiAccessToggleDescription}>{lang.current.api.accessDescription}</span>
            </label>
          </div>
        </div>

        {!apiEnabled && (
          <Alert variant="info">
            {lang.current.api.accessDisabledMessage}
          </Alert>
        )}

        {apiEnabled && (
          <>
            {/* New Token Display (shown only once after creation) */}
            {newToken && (
              <Alert variant="success" className={styles.mb4}>
                <h5>{lang.current.api.newTokenTitle}</h5>
                <p className={styles.mb2}>{lang.current.api.copyTokenMessage || lang.current.api.copyTokenMessage}</p>
                <div className={styles.tokenRow}>
                  <code className={`flex-grow-1 p-2 rounded border ${styles.userSelectAll} ${styles.tokenDisplay}`}>
                    {newToken}
                  </code>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleCopyToken(newToken)}
                  >
                    <FaCopy /> {lang.current.api.copyButton}
                  </Button>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setNewToken(null)}
                  className={`${styles.mt2} ${styles.p0}`}
                >
                  {lang.current.api.dismissMessage || lang.current.api.dismissMessage}
                </Button>
              </Alert>
            )}

            {/* Create New Token Form */}
            <Form onSubmit={handleCreateToken} className={styles.tokenCreationForm}>
              <h5>{lang.current.api.createTokenTitle || lang.current.api.createNewToken}</h5>
              <div className={styles.tokenInputRow}>
                <Form.Control
                  type="text"
                  placeholder={lang.current.placeholder.tokenNameOptional}
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  disabled={isCreating}
                  className={styles.tokenInput}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.generateToken}
                  disabled={isCreating}
                >
                  {isCreating ? lang.current.api.creatingToken : lang.current.api.generateToken}
                </Button>
              </div>
              <Form.Text className={styles.helperText}>
                {lang.current.api.tokenNameHelp}
              </Form.Text>
            </Form>

            {/* Existing Tokens List */}
            <div className={styles.tokenListSection}>
              <h5>{lang.current.api.yourTokensTitle}</h5>
              {isLoading ? (
                <Loading size="md" message={lang.current.api.loadingTokens} />
              ) : tokens.length === 0 ? (
                <Alert variant="info">{lang.current.api.noTokensMessage}</Alert>
              ) : (
                <ListGroup>
                  {tokens.map((token) => (
                    <ListGroup.Item
                      key={token._id}
                      className={styles.tokenListItem}
                    >
                      <div className={styles.tokenContent}>
                        <div className={styles.tokenHeader}>
                          <strong>{token.name}</strong>
                          {token.isActive ? (
                            <Pill variant="success">{lang.current.api.activeStatus}</Pill>
                          ) : (
                            <Pill variant="neutral">{lang.current.api.revokedStatus}</Pill>
                          )}
                        </div>
                        <div className={styles.tokenMeta}>
                          <div>{lang.current.api.prefixLabel} <code>{token.tokenPrefix}...</code></div>
                          <div>{lang.current.api.createdLabel} {formatDate(token.createdAt)}</div>
                          {token.lastUsed && (
                            <div>{lang.current.api.lastUsedLabel} {formatDate(token.lastUsed)}</div>
                          )}
                          {token.expiresAt && (
                            <div>{lang.current.api.expiresLabel} {formatDate(token.expiresAt)}</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.tokenActions}>
                        {token.isActive ? (
                          <>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteToken(token._id)}
                            >
                              <FaTrash /> {lang.current.api.revokeButton}
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleCopyToken(token.token)}
                            >
                              <FaCopy /> {lang.current.api.copyButton}
                            </Button>
                          </>
                        ) : (
                          <div className={styles.revokedLabel}>{lang.current.api.revokedStatus}</div>
                        )}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}

              {/* Usage Instructions */}
              <div className={styles.usageInstructions + ' mt-4'}>
                <h6>{lang.current.api.usageTitle}</h6>
                <ol className={styles.instructionsList}>
                  <li>{lang.current.api.usageStep1}</li>
                  <li>{lang.current.api.usageStep2}</li>
                  <li>{lang.current.api.usageStep3}</li>
                  <li>{lang.current.api.usageStep4}</li>
                </ol>
                <div className={styles.mt2}>
                  <strong>{lang.current.api.exampleTitle}</strong>
                  <pre className={`p-2 rounded border mt-1 mb-0 ${styles.codeExample}`}>
{`curl -H "Authorization: Bearer YOUR_TOKEN"
  ${window.location.origin}/api/experiences`}
                  </pre>
                </div>
              </div>
            </div>
          </>
        )}
    </Modal>
  );
}
