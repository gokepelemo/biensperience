import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSimpleFilter } from '../utilities/trie';

export default function useAssignmentEditor({
  collaborators,
  canEdit,
  onAssign,
  onUnassign,
}) {
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [filteredCollaborators, setFilteredCollaborators] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const assignmentInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const collaboratorTrieFilter = useMemo(() => {
    if (!collaborators || collaborators.length === 0) return null;
    const normalizedCollabs = collaborators.map((collab) => ({
      ...collab,
      name: collab.name || collab.user?.name || '',
    }));
    return createSimpleFilter(['name']).buildIndex(normalizedCollabs);
  }, [collaborators]);

  useEffect(() => {
    if (assignmentSearch.trim() === '') {
      setFilteredCollaborators(collaborators || []);
    } else if (collaboratorTrieFilter) {
      const filtered = collaboratorTrieFilter.filter(assignmentSearch, {
        rankResults: true,
      });
      setFilteredCollaborators(filtered);
    } else {
      const searchLower = assignmentSearch.toLowerCase();
      const filtered = (collaborators || []).filter((collab) => {
        const name = collab.name || collab.user?.name || '';
        return name.toLowerCase().includes(searchLower);
      });
      setFilteredCollaborators(filtered);
    }
    setHighlightedIndex(0);
  }, [assignmentSearch, collaborators, collaboratorTrieFilter]);

  useEffect(() => {
    if (!isEditingAssignment || !assignmentInputRef.current) return undefined;
    assignmentInputRef.current.focus();

    const positionDropdown = () => {
      if (dropdownRef.current && assignmentInputRef.current) {
        const inputRect = assignmentInputRef.current.getBoundingClientRect();
        const dropdownHeight = dropdownRef.current.offsetHeight || 200;
        const spaceBelow = window.innerHeight - inputRect.bottom - 4;
        const spaceAbove = inputRect.top - 4;

        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          dropdownRef.current.style.top = `${inputRect.top - dropdownHeight - 4}px`;
        } else {
          dropdownRef.current.style.top = `${inputRect.bottom + 4}px`;
        }
        dropdownRef.current.style.left = `${inputRect.left}px`;
        dropdownRef.current.style.width = `${inputRect.width}px`;
      }
    };

    requestAnimationFrame(positionDropdown);
    window.addEventListener('scroll', positionDropdown, true);
    window.addEventListener('resize', positionDropdown);

    // Modal-body scroll on mobile (allowBodyScroll) doesn't always bubble in
    // a way the capture-phase window listener catches reliably. Walk the DOM
    // to find scrollable ancestors of the input and attach to each of those.
    const scrollableAncestors = [];
    let node = assignmentInputRef.current.parentElement;
    while (node && node !== document.body) {
      const cs = window.getComputedStyle(node);
      const overflowY = cs.overflowY;
      const overflowX = cs.overflowX;
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowX === 'auto' ||
        overflowX === 'scroll'
      ) {
        scrollableAncestors.push(node);
      }
      node = node.parentElement;
    }
    scrollableAncestors.forEach((n) =>
      n.addEventListener('scroll', positionDropdown)
    );

    return () => {
      window.removeEventListener('scroll', positionDropdown, true);
      window.removeEventListener('resize', positionDropdown);
      scrollableAncestors.forEach((n) =>
        n.removeEventListener('scroll', positionDropdown)
      );
    };
  }, [isEditingAssignment]);

  useEffect(() => {
    if (!isEditingAssignment) return undefined;
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        assignmentInputRef.current &&
        !assignmentInputRef.current.contains(event.target)
      ) {
        setIsEditingAssignment(false);
        setAssignmentSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingAssignment]);

  const handleAssignmentClick = useCallback(() => {
    if (canEdit) {
      setIsEditingAssignment(true);
      setAssignmentSearch('');
    }
  }, [canEdit]);

  const handleSelectCollaborator = useCallback(
    async (collaborator) => {
      const userId = collaborator._id || collaborator.user?._id;
      setIsEditingAssignment(false);
      setAssignmentSearch('');
      if (userId) {
        await onAssign(userId);
      }
    },
    [onAssign]
  );

  const handleUnassign = useCallback(async () => {
    setIsEditingAssignment(false);
    setAssignmentSearch('');
    await onUnassign();
  }, [onUnassign]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!filteredCollaborators.length && highlightedIndex !== 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredCollaborators.length ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Tab':
          // Trap Tab inside the open dropdown: forward = next option,
          // back = previous. Esc or selection still exits.
          e.preventDefault();
          if (e.shiftKey) {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredCollaborators.length ? prev + 1 : prev
            );
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex === 0) {
            handleUnassign();
          } else if (highlightedIndex <= filteredCollaborators.length) {
            handleSelectCollaborator(filteredCollaborators[highlightedIndex - 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsEditingAssignment(false);
          setAssignmentSearch('');
          break;
        default:
          break;
      }
    },
    [filteredCollaborators, highlightedIndex, handleSelectCollaborator, handleUnassign]
  );

  return {
    isEditingAssignment,
    setIsEditingAssignment,
    assignmentSearch,
    setAssignmentSearch,
    filteredCollaborators,
    highlightedIndex,
    setHighlightedIndex,
    assignmentInputRef,
    dropdownRef,
    handleAssignmentClick,
    handleSelectCollaborator,
    handleUnassign,
    handleAssignmentKeyDown: handleKeyDown,
  };
}
