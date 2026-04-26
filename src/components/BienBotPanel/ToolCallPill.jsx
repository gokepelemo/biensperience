import React from 'react';
import PropTypes from 'prop-types';
import { HStack, Text, Spinner, Box } from '@chakra-ui/react';

/**
 * ToolCallPill — small status pill rendered inline with assistant messages
 * to surface in-flight read-only tool calls (T16).
 *
 * Three states:
 *   - pending  → spinner + neutral border
 *   - success  → green dot + green border
 *   - error    → red dot + red border
 *
 * Wired by useBienBot in T17 and rendered by the message UI in T18.
 */
const ToolCallPill = ({ label, status = 'pending' }) => {
  const borderColor =
    status === 'error' ? 'red.300' :
    status === 'success' ? 'green.300' :
    'var(--color-border, gray.200)';

  return (
    <HStack
      data-status={status}
      gap={2}
      px={3}
      py={1.5}
      borderRadius="full"
      bg="var(--color-bg-subtle, gray.50)"
      borderWidth="1px"
      borderColor={borderColor}
      maxW="fit-content"
    >
      {status === 'pending' && <Spinner size="xs" />}
      {status === 'error' && (
        <Box w={2} h={2} borderRadius="full" bg="red.500" aria-label="failed" />
      )}
      {status === 'success' && (
        <Box w={2} h={2} borderRadius="full" bg="green.500" aria-label="done" />
      )}
      <Text fontSize="sm" color="var(--color-text-secondary, gray.600)">{label}</Text>
    </HStack>
  );
};

ToolCallPill.propTypes = {
  label: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['pending', 'success', 'error']),
};

export default ToolCallPill;
