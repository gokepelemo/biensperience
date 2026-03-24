/**
 * useConfirmDialog — Replaces window.confirm() with a design-system Modal.
 *
 * Returns a `confirm()` function that opens a Chakra-based dialog and resolves
 * a promise when the user confirms or cancels. Also returns a React element
 * (`ConfirmDialog`) that must be rendered in the component tree.
 *
 * Usage:
 * ```jsx
 * const { confirm, ConfirmDialog } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: 'Delete item?',
 *     message: 'This cannot be undone.',
 *     confirmText: 'Delete',
 *     confirmVariant: 'danger'
 *   });
 *   if (!ok) return;
 *   // proceed
 * };
 *
 * return <>{ConfirmDialog}<OtherContent /></>;
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { Modal } from '../components/design-system';
import { Text } from '../components/design-system';

export function useConfirmDialog() {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, message, confirmText = 'Confirm', confirmVariant = 'danger' } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ title, message, confirmText, confirmVariant });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef.current) resolveRef.current(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) resolveRef.current(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ConfirmDialog = state ? (
    <Modal
      show
      onClose={handleClose}
      onSubmit={handleConfirm}
      title={state.title || 'Confirm'}
      submitText={state.confirmText}
      submitVariant={state.confirmVariant}
      cancelText="Cancel"
      size="sm"
      centered
    >
      <Text fontSize="var(--font-size-sm)">{state.message}</Text>
    </Modal>
  ) : null;

  return { confirm, ConfirmDialog };
}
