import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Text } from '../design-system';
import Autocomplete from '../Autocomplete/Autocomplete';
import { CloseIcon } from './icons';
import styles from './BienBotPanel.module.css';

function SessionSharePopover({ open, onClose, sharedWith, onShare, onUnshare, isOwner, onSearchUsers }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2 || !onSearchUsers) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const users = await onSearchUsers(query);
      // Filter out users already shared with
      const sharedIds = new Set((sharedWith || []).map(c => c.user_id?.toString()));
      setSearchResults((users || []).filter(u => !sharedIds.has(u._id?.toString())));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onSearchUsers, sharedWith]);

  const handleSelect = useCallback(async (item) => {
    if (!item?._id || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await onShare(item._id, 'viewer');
      if (result) {
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setError('Could not share. The user may not mutually follow you.');
      }
    } catch {
      setError('Failed to share session.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onShare]);

  if (!open) return null;

  return (
    <div className={styles.sharePopover}>
      <div className={styles.sharePopoverHeader}>
        <Text size="sm" style={{ fontWeight: 600 }}>Share session</Text>
        <button type="button" className={styles.sharePopoverClose} onClick={onClose} aria-label="Close share popover">
          <CloseIcon />
        </button>
      </div>

      {isOwner && (
        <div className={styles.shareForm}>
          <Autocomplete
            inputId="bienbot-share-search"
            placeholder="Search mutual followers…"
            entityType="user"
            items={searchResults}
            onSelect={handleSelect}
            onSearch={handleSearch}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            showAvatar={true}
            showMeta={true}
            size="sm"
            loading={isSearching}
            emptyMessage={
              searchQuery && searchQuery.length < 2
                ? 'Type at least 2 characters'
                : 'No mutual followers found'
            }
            disableFilter={true}
            disabled={isSubmitting}
          />
        </div>
      )}

      {error && <Text size="sm" className={styles.shareError}>{error}</Text>}

      {(sharedWith || []).length > 0 && (
        <div className={styles.shareList}>
          {sharedWith.map((collab) => (
            <div key={collab.user_id} className={styles.shareListItem}>
              <Text size="sm" className={styles.shareListUser}>
                {collab.user_name || collab.user_id?.toString().slice(-6)}
              </Text>
              {isOwner && (
                <button
                  type="button"
                  className={styles.shareRemoveButton}
                  onClick={() => onUnshare(collab.user_id)}
                  aria-label="Remove collaborator"
                  title="Remove"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(sharedWith || []).length === 0 && !isOwner && (
        <Text size="sm" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-2) 0' }}>
          No collaborators yet.
        </Text>
      )}
    </div>
  );
}

SessionSharePopover.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  sharedWith: PropTypes.array,
  onShare: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
  isOwner: PropTypes.bool,
  onSearchUsers: PropTypes.func
};

export default SessionSharePopover;
