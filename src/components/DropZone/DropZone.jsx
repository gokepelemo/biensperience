import { useState, useCallback, useRef } from 'react';
import styles from './DropZone.module.scss';
import { FaCloudUploadAlt } from 'react-icons/fa';

/**
 * Reusable drop zone component for drag-and-drop file uploads
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render inside the drop zone
 * @param {Function} props.onDrop - Callback when files are dropped: (files: FileList) => void
 * @param {string} props.accept - Accepted file types (e.g., "image/*", ".pdf,.doc")
 * @param {boolean} props.multiple - Allow multiple files (default: true)
 * @param {boolean} props.disabled - Disable the drop zone
 * @param {string} props.dropMessage - Message to show when dragging (default: "Drop files here")
 * @param {string} props.className - Additional CSS class
 */
export default function DropZone({
  children,
  onDrop,
  accept,
  multiple = true,
  disabled = false,
  dropMessage = 'Drop files here',
  className = ''
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Validate file type against accept prop
  const isValidFileType = useCallback((file) => {
    if (!accept) return true;

    const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
    const fileType = file.type.toLowerCase();
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    return acceptedTypes.some(type => {
      // Match MIME type (e.g., "image/*", "application/pdf")
      if (type.includes('/')) {
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.slice(0, -1));
        }
        return fileType === type;
      }
      // Match extension (e.g., ".pdf", ".jpg")
      if (type.startsWith('.')) {
        return fileExtension === type;
      }
      return false;
    });
  }, [accept]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    dragCounter.current = 0;

    if (disabled) return;

    const { files } = e.dataTransfer;

    if (files && files.length > 0) {
      // Filter valid files
      const validFiles = Array.from(files).filter(isValidFileType);

      if (validFiles.length === 0) {
        return;
      }

      // Create a FileList-like object
      const dt = new DataTransfer();
      const filesToAdd = multiple ? validFiles : [validFiles[0]];
      filesToAdd.forEach(file => dt.items.add(file));

      if (onDrop) {
        onDrop(dt.files);
      }
    }
  }, [disabled, isValidFileType, multiple, onDrop]);

  return (
    <div
      className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragContent}>
            <FaCloudUploadAlt className={styles.dragIcon} />
            <span className={styles.dragMessage}>{dropMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
