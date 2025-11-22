/**
 * PlanItemNotes Component
 * Displays and manages notes for a plan item in a chat-style interface
 */

import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { FaPaperPlane } from 'react-icons/fa';
import { BsCheckAll } from 'react-icons/bs';
import './PlanItemNotes.css';

export default function PlanItemNotes({
  notes = [],
  currentUser,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  disabled = false
}) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsAdding(true);
    try {
      await onAddNote(newNoteContent.trim());
      setNewNoteContent('');
    } catch (error) {
      console.error('[PlanItemNotes] Failed to add note:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note._id);
    setEditContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (noteId) => {
    if (!editContent.trim()) return;

    try {
      await onUpdateNote(noteId, editContent.trim());
      setEditingNoteId(null);
      setEditContent('');
    } catch (error) {
      console.error('[PlanItemNotes] Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      await onDeleteNote(noteId);
    } catch (error) {
      console.error('[PlanItemNotes] Failed to delete note:', error);
    }
  };

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

  const getUserInitials = (user) => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="plan-item-notes-chat">
      {/* Chat messages area */}
      <div className="chat-messages">
        {notes.length === 0 ? (
          <div className="empty-state">
            <p>No notes yet. Start the conversation!</p>
          </div>
        ) : (
          notes.map((note) => {
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
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      flexShrink: 0,
                    }}
                  >
                    {getUserInitials(note.user)}
                  </div>
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
                    // Edit mode
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-xl)',
                      padding: 'var(--space-3)',
                    }}>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          fontSize: 'var(--font-size-base)',
                          resize: 'none',
                          outline: 'none',
                          boxShadow: 'none',
                          color: 'var(--color-text-primary)',
                          marginBottom: 'var(--space-2)'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleSaveEdit(note._id)}
                          disabled={!editContent.trim()}
                          type="button"
                          style={{
                            padding: 'var(--space-2) var(--space-4)',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-semibold)',
                            cursor: 'pointer',
                            opacity: !editContent.trim() ? 0.5 : 1
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          type="button"
                          style={{
                            padding: 'var(--space-2) var(--space-4)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-medium)',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: 'var(--font-size-sm)',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
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
                      {note.content}

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
                              onClick={() => handleStartEdit(note)}
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
                              onClick={() => handleDeleteNote(note._id)}
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
                  )}
                </div>

                {/* Avatar for sent messages */}
                {isAuthor && (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-message-pending)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      flexShrink: 0,
                    }}
                  >
                    {getUserInitials(currentUser)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Chat input (Storybook-inspired) */}
      {!disabled && (
        <div style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-primary)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-3)'
          }}>
            <div style={{
              flex: 1,
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-4)'
            }}>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Type a note..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newNoteContent.trim() && !isAdding) {
                      handleAddNote();
                    }
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 'var(--font-size-base)',
                  resize: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  color: 'var(--color-text-primary)'
                }}
              />
            </div>

            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || isAdding}
              type="button"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: !newNoteContent.trim() || isAdding ? 'var(--color-border-medium)' : 'var(--color-primary)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: !newNoteContent.trim() || isAdding ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-lg)',
                flexShrink: 0,
                transition: 'var(--transition-normal)'
              }}
            >
              <FaPaperPlane size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
