/**
 * PlanItemNotes Component
 * Displays and manages notes for a plan item in a chat-style interface
 * Features: search, pagination, InteractiveTextArea with mentions support
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '../../components/design-system';
import { FaPaperPlane, FaSearch, FaPlus, FaTimes } from 'react-icons/fa';
import InteractiveTextArea from '../InteractiveTextArea/InteractiveTextArea';
import UserAvatar from '../UserAvatar/UserAvatar';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { renderTextWithMentions } from '../../utilities/mentions';
import useEntityResolver from '../../hooks/useEntityResolver';
import styles from './PlanItemNotes.module.scss';

/**
 * NoteMessage Component
 * Individual note message with entity resolution for mentions
 */
function NoteMessage({ note, entityData, isAuthor, onStartEdit, onDelete, formatDate }) {
  // Resolve any missing entities in this note's content
  const { entityData: mergedEntityData } = useEntityResolver(note.content, entityData);

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
      {renderTextWithMentions(note.content, mergedEntityData)}

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
  entityData = {}
}) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteVisibility, setNewNoteVisibility] = useState('public');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const notesPerPage = 5;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

  // Filtered and paginated notes
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;

    const query = searchQuery.toLowerCase();
    return notes.filter(note =>
      note.content?.toLowerCase().includes(query) ||
      note.user?.name?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const paginatedNotes = useMemo(() => {
    const startIndex = (currentPage - 1) * notesPerPage;
    const endIndex = startIndex + notesPerPage;
    return filteredNotes.slice(startIndex, endIndex);
  }, [filteredNotes, currentPage, notesPerPage]);

  const totalPages = Math.ceil(filteredNotes.length / notesPerPage);

  const handleAddNote = useCallback(async () => {
    if (!newNoteContent.trim()) return;

    setIsAdding(true);
    try {
      // newNoteContent is already in storage format {entity/id} from InteractiveTextArea
      await onAddNote(newNoteContent.trim(), newNoteVisibility);
      setNewNoteContent('');
      setNewNoteVisibility('public');
      setShowAddNoteForm(false);
    } catch (error) {
      console.error('[PlanItemNotes] Failed to add note:', error);
    } finally {
      setIsAdding(false);
    }
  }, [newNoteContent, newNoteVisibility, onAddNote]);

  const handleStartEdit = useCallback((note) => {
    setEditingNoteId(note._id);
    setEditContent(note.content);
    setEditVisibility(note.visibility || 'public');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditContent('');
    setEditVisibility('public');
  }, []);

  const handleSaveEdit = useCallback(async (noteId) => {
    if (!editContent.trim()) return;

    try {
      // editContent is already in storage format {entity/id} from InteractiveTextArea
      await onUpdateNote(noteId, editContent.trim(), editVisibility);
      setEditingNoteId(null);
      setEditContent('');
      setEditVisibility('public');
    } catch (error) {
      console.error('[PlanItemNotes] Failed to update note:', error);
    }
  }, [editContent, editVisibility, onUpdateNote]);

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
      console.error('[PlanItemNotes] Failed to delete note:', error);
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

  return (
    <div className={styles.planItemNotesChat}>
      {/* Search and Add Note Header */}
      <div className={styles.notesHeader}>
        <div className={styles.notesSearchWrapper}>
          <div className={styles.searchIconContainer}>
            <FaSearch className={styles.searchIcon} />
          </div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className={styles.searchInput}
            disabled={disabled}
            aria-label="Search notes"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={styles.clearSearchButton}
              aria-label="Clear search"
              disabled={disabled}
            >
              <FaTimes />
            </button>
          )}
        </div>

        <Button
          variant="primary"
          onClick={() => setShowAddNoteForm(!showAddNoteForm)}
          className={styles.addNoteButton}
          disabled={disabled}
        >
          <FaPlus /> Add Note
        </Button>
      </div>

      {/* Add Note Form (with InteractiveTextArea) */}
      {showAddNoteForm && !disabled && (
        <div className={styles.addNoteForm}>
          <div className={styles.formHeader}>
            <h4>Add a Note</h4>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setShowAddNoteForm(false);
                setNewNoteContent('');
                setNewNoteVisibility('public');
              }}
              className={styles.closeFormButton}
            >
              <FaTimes />
            </Button>
          </div>

          <InteractiveTextArea
            value={newNoteContent}
            onChange={setNewNoteContent}
            visibility={newNoteVisibility}
            onVisibilityChange={setNewNoteVisibility}
            availableEntities={availableEntities}
            entityData={entityData}
            placeholder="Type your note... Use @ to mention users, destinations, or experiences"
            rows={4}
            disabled={isAdding}
          />

          <div className={styles.formActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddNoteForm(false);
                setNewNoteContent('');
                setNewNoteVisibility('public');
              }}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || isAdding}
            >
              <FaPaperPlane /> {isAdding ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>
      )}

      {/* Chat messages area */}
      <div className={styles.chatMessages}>
        {filteredNotes.length === 0 ? (
          <div className={styles.emptyState}>
            {searchQuery ? (
              <p>No notes match your search.</p>
            ) : (
              <p>No notes yet. Click "Add Note" above to get started.</p>
            )}
          </div>
        ) : (
          paginatedNotes.map((note) => {
            const isAuthor = isNoteAuthor(note);
            const isEditing = editingNoteId === note._id;

            return (
              <div
                key={note._id}
                style={{
                  display: 'flex',
                  justifyContent: isAuthor ? 'flex-end' : 'flex-start',
                  marginBottom: 'var(--space-4)',
                  gap: 'var(--space-2)'
                }}
              >
                {/* Avatar for received messages */}
                {!isAuthor && (
                  <UserAvatar
                    user={note.user}
                    size="md"
                    linkToProfile={true}
                  />
                )}

                {/* Message bubble */}
                <div style={{ maxWidth: '70%', minWidth: '120px' }}>
                  {/* User name header (for received messages) */}
                  {!isAuthor && (
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-muted)',
                      marginBottom: 'var(--space-1)',
                      paddingLeft: 'var(--space-3)'
                    }}>
                      {note.user?.name || 'Unknown User'}
                    </div>
                  )}

                  {isEditing ? (
                    // Edit mode with InteractiveTextArea
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-xl)',
                      padding: 'var(--space-3)',
                    }}>
                      <InteractiveTextArea
                        value={editContent}
                        onChange={setEditContent}
                        visibility={editVisibility}
                        onVisibilityChange={setEditVisibility}
                        availableEntities={availableEntities}
                        entityData={entityData}
                        placeholder="Edit your note..."
                        rows={3}
                      />
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSaveEdit(note._id)}
                          disabled={!editContent.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode with entity resolution
                    <NoteMessage
                      note={note}
                      entityData={entityData}
                      isAuthor={isAuthor}
                      onStartEdit={handleStartEdit}
                      onDelete={handleDeleteNote}
                      formatDate={formatDate}
                    />
                  )}
                </div>

                {/* Avatar for sent messages */}
                {isAuthor && (
                  <UserAvatar
                    user={currentUser}
                    size="md"
                    linkToProfile={true}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredNotes.length > notesPerPage && (
        <div className={styles.paginationControls}>
          <div className={styles.paginationInfo}>
            Showing {((currentPage - 1) * notesPerPage) + 1} - {Math.min(currentPage * notesPerPage, filteredNotes.length)} of {filteredNotes.length} notes
          </div>
          <div className={styles.paginationButtons}>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className={styles.pageIndicator}>
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={cancelDeleteNote}
        onConfirm={confirmDeleteNote}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        cancelText="Cancel"
      />
    </div>
  );
}
