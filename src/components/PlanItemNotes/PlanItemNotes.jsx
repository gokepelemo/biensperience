/**
 * PlanItemNotes Component
 * Displays and manages notes for a plan item in a chat-style interface
 * Features: search, endless scroll (newest at bottom), InteractiveTextArea with mentions support
 *
 * Notes are displayed in reverse chronological order - newest at the bottom.
 * User scrolls UP to see older notes.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '../../components/design-system';
import { FaPaperPlane, FaSearch, FaPlus, FaTimes } from 'react-icons/fa';
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
import styles from './PlanItemNotes.module.scss';

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

  return (
    <div className={styles.noteForm}>
      <div className={styles.formHeader}>
        <h4>{title}</h4>
        <Button
          variant="link"
          size="sm"
          onClick={onCancel}
          className={styles.closeFormButton}
          disabled={loading}
        >
          <FaTimes />
        </Button>
      </div>

      <InteractiveTextArea
        value={content}
        onChange={onContentChange}
        visibility={visibility}
        onVisibilityChange={onVisibilityChange}
        availableEntities={availableEntities}
        entityData={entityData}
        placeholder="Type your note... Use @ to mention users, destinations, or experiences"
        rows={4}
        disabled={loading || disabled}
        highlightUrls={true}
      />

      <div className={styles.formActions}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          {lang.current.button.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!content?.trim() || loading}
        >
          <FaPaperPlane /> {loading ? loadingText : submitText}
        </Button>
      </div>
    </div>
  );
}

/**
 * NoteMessage Component
 * Individual note message with entity resolution for mentions and URL previews
 */
function NoteMessage({ note, entityData, isAuthor, onStartEdit, onDelete, formatDate, onEntityClick, showLinkPreviews = true }) {
  // Resolve any missing entities in this note's content
  const { entityData: mergedEntityData, loadingEntityIds } = useEntityResolver(note.content, entityData);

  // Extract URLs from the note content for previews
  const urls = useMemo(() => extractUrls(note.content), [note.content]);

  // Check if this is a private note
  const isPrivate = note.visibility === 'private';

  return (
    <div
      style={{
        padding: 'var(--space-4) var(--space-5)',
        backgroundColor: isAuthor ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
        color: isAuthor ? 'white' : 'var(--color-text-primary)',
        borderRadius: isAuthor
          ? 'var(--radius-2xl) var(--radius-2xl) var(--radius-sm) var(--radius-2xl)'
          : 'var(--radius-2xl) var(--radius-2xl) var(--radius-2xl) var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
        fontSize: 'var(--font-size-base)',
        lineHeight: 'var(--line-height-relaxed)',
        wordWrap: 'break-word'
      }}
    >
      {/* Private note indicator */}
      {isPrivate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            marginBottom: 'var(--space-2)',
            fontSize: 'var(--font-size-xs)',
            opacity: 0.8
          }}
          title="This note is only visible to you"
        >
          <span role="img" aria-label="Private note">🔒</span>
          <span>Private note</span>
        </div>
      )}

      {/* Render text with mentions and clickable URLs */}
      {renderTextWithMentionsAndUrls(note.content, mergedEntityData, onEntityClick, { loadingEntityIds })}

      {/* Link previews/embeds for URLs found in the note */}
      {showLinkPreviews && urls.length > 0 && (
        <LinkPreviewList
          urls={urls}
          showEmbed={true}
          maxPreviews={2}
        />
      )}

      {/* Timestamp and actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'var(--space-2)',
        fontSize: 'var(--font-size-xs)',
        opacity: 0.8
      }}>
        <span>{formatDate(note.createdAt || note.updatedAt)}</span>

        {isAuthor && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'var(--space-3)' }}>
            <button
              onClick={() => onStartEdit(note)}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontSize: 'inherit'
              }}
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(note._id)}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontSize: 'inherit'
              }}
            >
              Delete
            </button>
          </div>
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
  }, []);

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

  return (
    <div className={styles.planItemNotesChat}>
      {/* Search and Add Note Header */}
      <div className={styles.notesHeader}>
        <div className={styles.headerControls}>
          <div className={styles.searchPill}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayedCount(10); // Reset to initial display count on search
              }}
              placeholder="Search notes..."
              disabled={disabled}
              className={styles.searchInput}
            />
          </div>

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

      {/* Chat messages area - scroll up to load more (newest at bottom) */}
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

        {sortedNotes.length === 0 ? (
          searchQuery ? (
            <EmptyState
              variant="search"
              title="No Notes Found"
              description="No notes match your search. Try a different search term."
              size="sm"
            />
          ) : (
            <EmptyState
              variant="notes"
              primaryAction={!disabled ? "Add a Note" : null}
              onPrimaryAction={!disabled ? () => setShowAddNoteForm(true) : null}
              size="sm"
            />
          )
        ) : (
          displayedNotes.map((note) => {
            const isAuthor = isNoteAuthor(note);
            const isEditing = editingNoteId === note._id;

            return (
              <div
                key={note._id}
                className={`${styles.messageRow} ${isAuthor ? styles.messageRowAuthor : styles.messageRowReceived}`}
              >
                {/* Avatar for received messages */}
                {!isAuthor && (
                  <UserAvatar
                    user={note.user}
                    size="md"
                    linkToProfile={true}
                    showPresence={presenceConnected}
                    isOnline={isUserOnline(note.user)}
                  />
                )}

                {/* Message bubble */}
                <div className={`${styles.messageBubble} ${isEditing ? styles.messageBubbleEdit : styles.messageBubbleView}`}>
                  {/* User name header (for received messages) */}
                  {!isAuthor && (
                    <div className={styles.messageUserName}>
                      {note.user?.name || 'Unknown User'}
                    </div>
                  )}

                  {isEditing ? (
                    // Edit mode with unified NoteForm
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
                    // View mode with entity resolution
                    <NoteMessage
                      note={note}
                      entityData={entityData}
                      isAuthor={isAuthor}
                      onStartEdit={handleStartEdit}
                      onDelete={handleDeleteNote}
                      formatDate={formatDate}
                      onEntityClick={onEntityClick}
                    />
                  )}
                </div>

                {/* Avatar for sent messages */}
                {isAuthor && (
                  <UserAvatar
                    user={currentUser}
                    size="md"
                    linkToProfile={true}
                    showPresence={presenceConnected}
                    isOnline={isUserOnline(currentUser)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

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
