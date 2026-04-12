/**
 * PlanItemNotes Component
 * Displays and manages notes for a plan item in a card-style interface
 * Features: search, endless scroll (newest at bottom), InteractiveTextArea with mentions support
 *
 * Notes are displayed in reverse chronological order - newest at the bottom.
 * User scrolls UP to see older notes.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button, Dropdown, SearchInput } from '../../components/design-system';
import SplitButton from '../SplitButton/SplitButton';
import { FaStickyNote, FaPlus, FaTimes, FaBan, FaCrosshairs } from 'react-icons/fa';
import InteractiveTextArea from '../InteractiveTextArea/InteractiveTextArea';
import UserAvatar from '../UserAvatar/UserAvatar';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import EmptyState from '../EmptyState/EmptyState';
import { renderTextWithMentionsAndUrls, extractUrls, mentionsToPlainText } from '../../utilities/mentions';
import { LinkPreviewList } from '../LinkPreview/LinkPreview';
import useEntityResolver from '../../hooks/useEntityResolver';
import { createFilter } from '../../utilities/trie';
import { logger } from '../../utilities/logger';
import { useFormPersistence } from '../../hooks/useFormPersistence';
import { formatRestorationMessage } from '../../utilities/time-utils';
import { useToast } from '../../contexts/ToastContext';
import { lang } from '../../lang.constants';
import styles from './PlanItemNotes.module.css';

// Visibility options for notes (plan-level restriction)
// - 'contributors': Visible to all plan collaborators (All Contributors)
// - 'private': Only visible to the note creator
const VISIBILITY_OPTIONS = [
  { value: 'contributors', label: 'All Contributors', icon: '👥' },
  { value: 'private', label: 'Private', icon: '🔒' }
];

/**
 * NoteForm Component - Unified form for Add and Edit operations
 * Ensures consistent interface between add and edit modes
 *
 * Accessibility:
 * - Auto-focuses textarea on mount for keyboard users
 * - Enter key submits when content is valid (Shift+Enter for newlines)
 * - Close button has aria-label for screen readers
 * - Visibility dropdown has aria-label describing its purpose
 */
function NoteForm({
  mode = 'add', // 'add' or 'edit'
  content,
  onContentChange,
  visibility,
  onVisibilityChange,
  onSubmit,
  onCancel,
  availableEntities = [],
  entityData = {},
  disabled = false,
  loading = false
}) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'Edit Note' : 'Add a Note';
  const submitText = isEdit ? 'Save' : 'Add Note';
  const loadingText = isEdit ? 'Saving...' : 'Adding...';
  const textareaRef = useRef(null);

  // Auto-focus textarea when form mounts for keyboard accessibility
  useEffect(() => {
    if (textareaRef.current) {
      // Small delay to ensure DOM is ready after render
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle keyboard shortcuts (Enter to submit, Escape to cancel)
  const handleKeyDown = useCallback((e) => {
    // Enter without Shift submits the form (if content is valid)
    if (e.key === 'Enter' && !e.shiftKey && content?.trim() && !loading) {
      e.preventDefault();
      onSubmit();
    }
    // Escape cancels the form
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [content, loading, onSubmit, onCancel]);

  const selectedVisibility = VISIBILITY_OPTIONS.find(opt => opt.value === visibility);

  return (
    <div
      className={styles.noteForm}
      role="form"
      aria-label={title}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.formHeader}>
        <h4 id="note-form-title">{title}</h4>
        <Button
          variant="link"
          size="sm"
          onClick={onCancel}
          className={styles.closeFormButton}
          disabled={loading}
          aria-label="Close note form"
        >
          <FaTimes aria-hidden="true" />
        </Button>
      </div>

      <InteractiveTextArea
        ref={textareaRef}
        value={content}
        onChange={onContentChange}
        availableEntities={availableEntities}
        entityData={entityData}
        placeholder="Write your note here..."
        rows={2}
        disabled={loading || disabled}
        highlightUrls={true}
        showFooter={false}
        aria-labelledby="note-form-title"
      />

      <div className={styles.formHint} aria-live="polite">
        <span>Use <strong>@</strong> to mention people &amp; places, <strong>#</strong> for plan items</span>
      </div>

      <div className={styles.formActions}>
        {/* Visibility selector on the left */}
        <Dropdown onSelect={onVisibilityChange} autoClose={true} className={styles.visibilityDropdown}>
          <Dropdown.Toggle
            variant="outline-secondary"
            size="sm"
            className={styles.visibilitySelector}
            aria-label={`Note visibility: ${selectedVisibility?.label || 'All Contributors'}`}
          >
            <span aria-hidden="true">{selectedVisibility?.icon}</span>{' '}
            {selectedVisibility?.label}
          </Dropdown.Toggle>
          <Dropdown.Menu aria-label="Note visibility options">
            {VISIBILITY_OPTIONS.map(option => (
              <Dropdown.Item
                key={option.value}
                eventKey={option.value}
                active={visibility === option.value}
                aria-selected={visibility === option.value}
              >
                <span aria-hidden="true">{option.icon}</span> {option.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>

        {/* Spacer to push buttons to the right */}
        <div className={styles.formActionsSpacer} />

        <SplitButton
          label={loading ? loadingText : submitText}
          icon={<FaStickyNote aria-hidden="true" />}
          onClick={onSubmit}
          variant="gradient"
          size="sm"
          disabled={!content?.trim() || loading}
          menuAriaLabel="Note form actions"
          placement="top-end"
        >
          <SplitButton.Item value="cancel" onClick={onCancel}>
            <FaBan /> {lang.current.button.cancel}
          </SplitButton.Item>
        </SplitButton>
      </div>
      <span id="note-form-hint" className={styles.visuallyHidden}>
        Press Enter to submit, Shift+Enter for new line, Escape to cancel
      </span>
    </div>
  );
}

/**
 * NoteMessage Component
 * Individual note message with entity resolution for mentions and URL previews
 */
function NoteMessage({ note, entityData, isAuthor, onStartEdit, onDelete, formatDate, onEntityClick, showLinkPreviews = true, noteUser, presenceConnected, isOnline, onVoteRelevancy, currentUserId }) {
  // Resolve any missing entities in this note's content
  const { entityData: mergedEntityData, loadingEntityIds } = useEntityResolver(note.content, entityData);

  // Extract URLs from the note content for previews
  const urls = useMemo(() => extractUrls(note.content), [note.content]);

  // Check if this is a private note
  const isPrivate = note.visibility === 'private';

  // Check if user data is still loading (no name resolved yet)
  const isUserLoading = !note.user?.name && note.user?._id && note.user._id !== 'unknown';

  // Whether the current user has voted this note as important
  const hasVoted = (note.relevancy_votes || []).some(
    v => String(v) === String(currentUserId) || String(v?._id) === String(currentUserId)
  );

  return (
    <div className={styles.noteCard}>
      {/* Private note indicator */}
      {isPrivate && (
        <div className={styles.notePrivateBadge} title="This note is only visible to you">
          <span role="img" aria-label="Private note">🔒</span>
          <span>Private note</span>
        </div>
      )}

      {/* Note content */}
      <div className={styles.noteContent}>
        {renderTextWithMentionsAndUrls(note.content, mergedEntityData, onEntityClick, { loadingEntityIds })}
      </div>

      {/* Link previews/embeds for URLs found in the note */}
      {showLinkPreviews && urls.length > 0 && (
        <LinkPreviewList
          urls={urls}
          showEmbed={true}
          maxPreviews={2}
        />
      )}

      {/* Note footer: avatar, author, timestamp, actions */}
      <div className={styles.noteFooter}>
        <div className={styles.noteAuthorTimestamp}>
          {isUserLoading ? (
            <div className={styles.skeletonName} />
          ) : (
            <>
              <UserAvatar
                user={noteUser}
                size="xs"
                linkToProfile={true}
                showPresence={presenceConnected}
                isOnline={isOnline}
              />
              <span className={styles.noteAuthorName}>
                {isAuthor ? 'You' : (note.user?.name || 'Unknown User')}
              </span>
            </>
          )}
          <span className={styles.noteSeparator}>&middot;</span>
          <span className={styles.noteTimestamp}>{formatDate(note.createdAt || note.updatedAt)}</span>
        </div>

        {isAuthor && (
          <div className={styles.noteActions}>
            <button
              onClick={() => onStartEdit(note)}
              type="button"
              className={styles.noteActionButton}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(note._id)}
              type="button"
              className={styles.noteActionButton}
            >
              Delete
            </button>
          </div>
        )}

        {/* Relevancy vote: single bullseye toggle available to owner/collaborators */}
        {onVoteRelevancy && (
          <button
            type="button"
            onClick={() => onVoteRelevancy(note._id)}
            className={`${styles.noteRelevancyButton} ${hasVoted ? styles.noteRelevancyButtonActive : ''}`}
            title={hasVoted ? 'Remove important mark' : 'Mark as important'}
            aria-label={hasVoted ? 'Remove important mark' : 'Mark note as important'}
            aria-pressed={hasVoted}
          >
            <FaCrosshairs aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlanItemNotes({
  notes = [],
  currentUser,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onVoteNoteRelevancy,
  disabled = false,
  // For mentions support
  availableEntities = [],
  entityData = {},
  // Callback for when a mention entity is clicked (e.g., plan-item deep link)
  onEntityClick,
  // Real-time presence for online indicators
  presenceConnected = false,
  onlineUserIds = new Set(),
  // Collaborators for resolving note author user data (names, photos)
  collaborators = [],
  // Plan item ID for form persistence (optional)
  planItemId = null
}) {
  const { success } = useToast();
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteVisibility, setNewNoteVisibility] = useState('contributors');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState('contributors');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedCount, setDisplayedCount] = useState(10); // For endless scroll
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const chatMessagesRef = useRef(null);
  const prevNotesLengthRef = useRef(notes.length);

  // Form persistence for new note content
  const formData = useMemo(() => ({
    content: newNoteContent,
    visibility: newNoteVisibility
  }), [newNoteContent, newNoteVisibility]);

  const setFormData = useCallback((data) => {
    if (!data) return;
    if (data.content !== undefined) setNewNoteContent(data.content);
    if (data.visibility !== undefined) setNewNoteVisibility(data.visibility);
  }, []);

  const persistence = useFormPersistence(
    planItemId ? `plan-item-note-form-${planItemId}` : null,
    formData,
    setFormData,
    {
      enabled: !!planItemId && !!currentUser?._id,
      userId: currentUser?._id,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000,
      shouldSave: (data) => data?.content?.trim()?.length > 0,
      onRestore: (savedData, age) => {
        if (savedData?.content?.trim()) {
          setShowAddNoteForm(true);
          const message = formatRestorationMessage(age, 'create');
          success(message, {
            duration: 15000,
            actions: [{
              label: 'Clear',
              onClick: () => {
                setNewNoteContent('');
                setNewNoteVisibility('contributors');
                persistence.clear();
              },
              variant: 'link'
            }]
          });
        }
      }
    }
  );

  // Resolve user data from collaborators for notes that only have user IDs
  // This prevents "Unknown User" flash by enriching notes with full user objects
  const resolveUserFromCollaborators = useCallback((noteUser) => {
    // If note.user is already a populated object with name, return as-is
    if (noteUser && typeof noteUser === 'object' && noteUser.name) {
      return noteUser;
    }

    // Get the user ID to look up
    const userId = typeof noteUser === 'string' ? noteUser : noteUser?._id;
    if (!userId) return noteUser;

    // Check if currentUser matches
    if (currentUser?._id === userId || currentUser?._id?.toString() === userId?.toString()) {
      return currentUser;
    }

    // Look up in collaborators array
    const collaborator = collaborators.find(c => {
      const collabId = c._id || c.user?._id;
      return collabId === userId || collabId?.toString() === userId?.toString();
    });

    if (collaborator) {
      // Return the user object from collaborator (handles both { user: {...} } and {...} structures)
      return collaborator.user || collaborator;
    }

    // Fallback: return original (may still show Unknown User)
    return noteUser;
  }, [collaborators, currentUser]);

  // Pre-resolve all note users to avoid flash during render
  const notesWithResolvedUsers = useMemo(() => {
    return notes.map(note => ({
      ...note,
      user: resolveUserFromCollaborators(note.user)
    }));
  }, [notes, resolveUserFromCollaborators]);

  // Build generic TrieFilter index for fast searching (memoized)
  // Supports filtering by content (high priority), author name (medium), and date (low)
  const notesFilter = useMemo(() => {
    return createFilter({
      fields: [
        {
          path: 'content',
          score: 100, // Note content gets highest priority
          // Transform mentions from {entity/id} to @EntityName for searchability
          transform: (content) => {
            // Convert mentions to plain text so searching for "Paris" finds "{destination/123}"
            return mentionsToPlainText(content, entityData);
          }
        },
        { path: 'user.name', score: 50 }, // Author name gets medium priority
        {
          path: 'createdAt',
          score: 20,
          // Transform date to searchable strings
          transform: (date) => {
            const d = new Date(date);
            return [
              d.toLocaleDateString(), // "11/23/2025"
              d.toLocaleString('en-US', { month: 'short' }), // "Nov"
              d.toLocaleString('en-US', { month: 'long' }), // "November"
              d.getFullYear().toString() // "2025"
            ];
          }
        }
      ]
    }).buildIndex(notesWithResolvedUsers);
  }, [notesWithResolvedUsers, entityData]);

  // Trie-based search with O(m) lookup complexity where m = query length
  // Real-time filtering as user types using generic TrieFilter
  const filteredNotes = useMemo(() => {
    return notesFilter.filter(searchQuery);
  }, [searchQuery, notesFilter]);

  // Sort notes by creation date (oldest first, so newest appears at bottom)
  // This enables chat-style display with newest at the bottom
  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA - dateB; // Oldest first (newest at bottom)
    });
  }, [filteredNotes]);

  // For endless scroll: show last N notes (newest at bottom)
  const displayedNotes = useMemo(() => {
    const total = sortedNotes.length;
    const startIndex = Math.max(0, total - displayedCount);
    return sortedNotes.slice(startIndex);
  }, [sortedNotes, displayedCount]);

  const hasMoreNotes = displayedCount < sortedNotes.length;

  // Scroll to bottom when new notes are added
  useEffect(() => {
    if (notes.length > prevNotesLengthRef.current && chatMessagesRef.current) {
      // New note was added - scroll to bottom
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
    prevNotesLengthRef.current = notes.length;
  }, [notes.length]);

  // Handle scroll to load more (when scrolling to top)
  const handleScroll = useCallback((e) => {
    const { scrollTop } = e.target;
    // Load more when scrolled to top
    if (scrollTop === 0 && hasMoreNotes) {
      setDisplayedCount(prev => Math.min(prev + 10, sortedNotes.length));
    }
  }, [hasMoreNotes, sortedNotes.length]);

  const handleAddNote = useCallback(async () => {
    if (!newNoteContent.trim()) return;

    setIsAdding(true);
    try {
      // newNoteContent is already in storage format {entity/id} from InteractiveTextArea
      await onAddNote(newNoteContent.trim(), newNoteVisibility);
      setNewNoteContent('');
      setNewNoteVisibility('contributors');
      setShowAddNoteForm(false);
      // Clear persisted form data on success
      persistence.clear();
    } catch (error) {
      logger.error('[PlanItemNotes] Failed to add note:', { error: error.message }, error);
    } finally {
      setIsAdding(false);
    }
  }, [newNoteContent, newNoteVisibility, onAddNote, persistence]);

  const handleStartEdit = useCallback((note) => {
    setEditingNoteId(note._id);
    setEditContent(note.content);
    setEditVisibility(note.visibility || 'contributors');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditContent('');
    setEditVisibility('contributors');
  }, []);

  const handleSaveEdit = useCallback(async (noteId) => {
    if (!editContent.trim()) return;

    setIsSaving(true);
    try {
      // editContent is already in storage format {entity/id} from InteractiveTextArea
      await onUpdateNote(noteId, editContent.trim(), editVisibility);
      setEditingNoteId(null);
      setEditContent('');
      setEditVisibility('contributors');
    } catch (error) {
      logger.error('[PlanItemNotes] Failed to update note:', { error: error.message }, error);
    } finally {
      setIsSaving(false);
    }
  }, [editContent, editVisibility, onUpdateNote]);

  const handleCancelAdd = useCallback(() => {
    setShowAddNoteForm(false);
    setNewNoteContent('');
    setNewNoteVisibility('contributors');
    persistence.clear();
  }, [persistence]);

  const handleDeleteNote = useCallback((noteId) => {
    setNoteToDelete(noteId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete) return;

    try {
      await onDeleteNote(noteToDelete);
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
    } catch (error) {
      logger.error('[PlanItemNotes] Failed to delete note:', { error: error.message }, error);
    }
  }, [noteToDelete, onDeleteNote]);

  const cancelDeleteNote = useCallback(() => {
    setShowDeleteConfirm(false);
    setNoteToDelete(null);
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isNoteAuthor = (note) => {
    return note.user?._id === currentUser?._id || note.user === currentUser?._id;
  };

  /**
   * Check if a user is currently online based on presence data
   * @param {Object|string} user - User object or user ID
   * @returns {boolean} True if user is online
   */
  const isUserOnline = useCallback((user) => {
    if (!presenceConnected || !onlineUserIds || onlineUserIds.size === 0) {
      return false;
    }
    const userId = user?._id?.toString() || user?.toString();
    return userId && onlineUserIds.has(userId);
  }, [presenceConnected, onlineUserIds]);

  const hasNotes = sortedNotes.length > 0;
  const isDefaultEmptyState = !hasNotes && !searchQuery && !showAddNoteForm;

  return (
    <div className={styles.planItemNotesChat}>
      {/* Search and Add Note Header */}
      {!isDefaultEmptyState && (
        <div className={styles.notesHeader}>
          <div className={styles.headerControls}>
            <SearchInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayedCount(10);
              }}
              onClear={() => setSearchQuery('')}
              placeholder="Search notes..."
              disabled={disabled}
              size="sm"
              className={styles.searchPill}
              inputClassName={styles.searchPillInput}
            />

            <button
              type="button"
              onClick={() => setShowAddNoteForm(!showAddNoteForm)}
              className={styles.addNotePill}
              disabled={disabled}
            >
              <FaPlus /> Add Note
            </button>
          </div>
        </div>
      )}

      {/* Add Note Form (unified NoteForm component) */}
      {showAddNoteForm && !disabled && (
        <NoteForm
          mode="add"
          content={newNoteContent}
          onContentChange={setNewNoteContent}
          visibility={newNoteVisibility}
          onVisibilityChange={setNewNoteVisibility}
          onSubmit={handleAddNote}
          onCancel={handleCancelAdd}
          availableEntities={availableEntities}
          entityData={entityData}
          loading={isAdding}
        />
      )}

      {isDefaultEmptyState ? (
        <div className={styles.emptyState}>
          <EmptyState
            variant="notes"
            primaryAction={!disabled ? 'Add a Note' : null}
            onPrimaryAction={!disabled ? () => setShowAddNoteForm(true) : null}
            size="md"
            fillContainer
          />
        </div>
      ) : (
        /* Chat messages area - scroll up to load more (newest at bottom) */
        <div
          className={styles.chatMessages}
          ref={chatMessagesRef}
          onScroll={handleScroll}
        >
          {/* Load more indicator */}
          {hasMoreNotes && (
            <div className={styles.loadMoreIndicator}>
              <span>Scroll up to load older notes</span>
            </div>
          )}

          {!hasNotes ? (
            <EmptyState
              variant="search"
              title="No Notes Found"
              description="No notes match your search. Try a different search term."
              size="sm"
            />
          ) : (
            displayedNotes.map((note) => {
            const isAuthor = isNoteAuthor(note);
            const isEditing = editingNoteId === note._id;
            const noteUser = isAuthor ? currentUser : note.user;

            return (
              <div
                key={note._id}
                className={`${styles.noteRow} ${note._optimistic ? styles.noteRowOptimistic : ''}`}
              >
                  {isEditing ? (
                  <NoteForm
                    mode="edit"
                    content={editContent}
                    onContentChange={setEditContent}
                    visibility={editVisibility}
                    onVisibilityChange={setEditVisibility}
                    onSubmit={() => handleSaveEdit(note._id)}
                    onCancel={handleCancelEdit}
                    availableEntities={availableEntities}
                    entityData={entityData}
                    loading={isSaving}
                  />
                ) : (
                  <NoteMessage
                    note={note}
                    entityData={entityData}
                    isAuthor={isAuthor}
                    onStartEdit={handleStartEdit}
                    onDelete={handleDeleteNote}
                    formatDate={formatDate}
                    onEntityClick={onEntityClick}
                    noteUser={noteUser}
                    presenceConnected={presenceConnected}
                    isOnline={isUserOnline(noteUser)}
                    onVoteRelevancy={onVoteNoteRelevancy}
                    currentUserId={currentUser?._id}
                  />
                )}
              </div>
            );
            })
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={cancelDeleteNote}
        onConfirm={confirmDeleteNote}
        title="Delete Note?"
        message="You are about to permanently delete this note"
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />
    </div>
  );
}
