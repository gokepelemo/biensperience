/**
 * PlanItemNotes Component
 * Displays and manages notes for a plan item
 */

import { useState } from 'react';
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

  return (
    <div className="plan-item-notes">
      {/* Notes list */}
      {notes.length > 0 && (
        <div className="notes-list">
          {notes.map((note) => {
            const isAuthor = isNoteAuthor(note);
            const isEditing = editingNoteId === note._id;

            return (
              <div key={note._id} className="note-item">
                <div className="note-header">
                  <span className="note-author">
                    {note.user?.name || 'Unknown User'}
                  </span>
                  <span className="note-timestamp">
                    {formatDate(note.createdAt || note.updatedAt)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="note-edit-form">
                    <textarea
                      className="note-edit-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="note-edit-actions">
                      <button
                        className="btn-save"
                        onClick={() => handleSaveEdit(note._id)}
                        disabled={!editContent.trim()}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={handleCancelEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-content">{note.content}</div>
                    {isAuthor && (
                      <div className="note-actions">
                        <button
                          className="btn-edit"
                          onClick={() => handleStartEdit(note)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteNote(note._id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add note form */}
      {!disabled && (
        <div className="add-note-form">
          <textarea
            className="note-textarea"
            placeholder="Add a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={3}
          />
          <button
            className="btn-add-note"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || isAdding}
            type="button"
          >
            {isAdding ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      )}
    </div>
  );
}
