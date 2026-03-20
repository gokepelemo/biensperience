/**
 * UploadProgressIndicator
 *
 * Thin progress bar fixed below the NavBar that shows aggregate
 * upload progress for photos and documents. Visible globally whenever
 * at least one upload is in flight.
 *
 * Uses the design-system ProgressBar (which delegates to BaseProgressBar / Chakra Progress).
 */

import { Box, Flex, Text } from '@chakra-ui/react';
import { ProgressBar } from '../design-system';
import { useUploadProgress } from '../../contexts/UploadProgressContext';

export default function UploadProgressIndicator() {
  const { hasUploads, aggregatePercent, uploads, hasFailed } = useUploadProgress();

  if (!hasUploads) return null;

  const failedCount = uploads.filter(u => u.status === 'failed').length;
  const uploadingCount = uploads.filter(u => u.status === 'uploading').length;

  // Build label
  let label = '';
  if (uploadingCount > 0) {
    const names = uploads
      .filter(u => u.status === 'uploading')
      .map(u => u.fileName)
      .slice(0, 2);
    const suffix = uploadingCount > 2 ? ` +${uploadingCount - 2} more` : '';
    label = `Uploading ${names.join(', ')}${suffix}`;
  }
  if (failedCount > 0) {
    label += `${label ? ' \u00b7 ' : ''}${failedCount} failed`;
  }

  const color = hasFailed && uploadingCount === 0 ? 'danger' : 'primary';

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label="Upload progress"
      position="fixed"
      top="68px"
      left="0"
      right="0"
      zIndex="1199"
      bg="bg"
      borderBottom="1px solid"
      borderColor="border"
      boxShadow="0 1px 4px rgba(0, 0, 0, 0.06)"
      px="3"
      py="1"
      css={{
        animation: 'slideDown 200ms ease-out',
        '@keyframes slideDown': {
          from: { opacity: 0, transform: 'translateY(-100%)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <ProgressBar
        value={uploadingCount > 0 ? aggregatePercent : 100}
        color={color}
        size="sm"
        showPercentage={uploadingCount > 0}
        animated={uploadingCount > 0}
        label={label}
      />
    </Box>
  );
}
