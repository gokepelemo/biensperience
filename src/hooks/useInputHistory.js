import { useRef, useCallback } from 'react';

/**
 * useInputHistory — manages ArrowUp/ArrowDown shell-style history recall for a textarea.
 *
 * On ArrowUp from an empty textarea, walks backward through the provided history (newest-first),
 * snapshotting any in-progress draft so it can be restored when the user walks back to the present
 * via ArrowDown.
 *
 * Returns a `handleHistoryKey(e, history)` function that the parent can call from its own
 * `onKeyDown` handler. Returns `true` if the event was handled (preventDefault was called),
 * `false` otherwise — so the parent can chain other key handling (e.g. Enter-to-send) without
 * conflicting.
 *
 * @param {Object} params
 * @param {React.RefObject<HTMLTextAreaElement>} params.inputRef
 * @param {() => void} [params.onValueChange] - Optional callback after the value mutates (e.g. resize).
 *   Called after `inputRef.current.value` is updated — the callback can read the new value
 *   from `inputRef.current.value` if it needs to sync auxiliary state.
 * @returns {{ handleHistoryKey: (e: KeyboardEvent, history: string[]) => boolean, resetHistory: () => void }}
 */
export function useInputHistory({ inputRef, onValueChange } = {}) {
  // -1 = not in history mode; >= 0 = index into history (newest-first)
  const indexRef = useRef(-1);
  // Snapshot of the user's draft before they entered history mode
  const draftRef = useRef('');

  const setValue = useCallback((value) => {
    if (!inputRef?.current) return;
    inputRef.current.value = value;
    inputRef.current.setSelectionRange(value.length, value.length);
    if (onValueChange) onValueChange();
  }, [inputRef, onValueChange]);

  const handleHistoryKey = useCallback((e, history) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
    if (!history || history.length === 0) return false;

    if (e.key === 'ArrowUp') {
      const currentValue = inputRef?.current?.value ?? '';
      // Only enter history mode from an empty textarea
      if (indexRef.current === -1 && currentValue.trim() !== '') return false;

      const nextIndex = indexRef.current + 1;
      if (nextIndex >= history.length) return false; // already at oldest entry

      e.preventDefault();
      if (indexRef.current === -1) {
        draftRef.current = currentValue; // snapshot draft before first recall
      }
      indexRef.current = nextIndex;
      setValue(history[nextIndex]);
      return true;
    }

    // ArrowDown — only active while in history mode
    if (indexRef.current === -1) return false;

    e.preventDefault();
    const nextIndex = indexRef.current - 1;
    indexRef.current = nextIndex;

    if (nextIndex === -1) {
      setValue(draftRef.current);
    } else {
      setValue(history[nextIndex]);
    }
    return true;
  }, [inputRef, setValue]);

  const resetHistory = useCallback(() => {
    indexRef.current = -1;
    draftRef.current = '';
  }, []);

  return { handleHistoryKey, resetHistory };
}
