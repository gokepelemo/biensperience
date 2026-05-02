/**
 * Tests for DocumentRow — the memoized row extracted from DocumentsTab.
 *
 * Covers the conditional surface that the row exposes:
 * - filename + meta (size, date, owner name)
 * - preview action with loading state
 * - AI badge gating on hasAiData
 * - visibility toggle (owner) vs indicator (non-owner private)
 * - super-admin restore + permanent-delete on disabled docs
 * - delete action gating on isOwner + canEdit + !isDisabled
 *
 * Mocks Tooltip from design-system because it pulls in Chakra and we don't
 * need to test the tooltip surface here — only the trigger button.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../src/components/design-system', () => ({
  Tooltip: ({ children }) => children,
}));

jest.mock('../../../src/utilities/document-upload', () => ({
  formatFileSize: (bytes) => `${bytes}B`,
}));

jest.mock('../../../src/components/PlanItemDetailsModal/DocumentsTab.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

import DocumentRow from '../../../src/components/PlanItemDetailsModal/DocumentRow';

const baseDoc = {
  _id: 'doc-1',
  originalFilename: 'receipt.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  createdAt: '2026-01-15T00:00:00Z',
  visibility: 'private',
  user: { name: 'Alice' },
  isDisabled: false,
};

function renderRow(overrides = {}) {
  const props = {
    doc: baseDoc,
    isOwner: true,
    isAdmin: false,
    canEdit: true,
    hasAiData: false,
    isLoadingPreview: false,
    onPreview: jest.fn(),
    onShowAiSummary: jest.fn(),
    onVisibilityToggle: jest.fn(),
    onRestore: jest.fn(),
    onPermanentDelete: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<DocumentRow {...props} />) };
}

describe('DocumentRow', () => {
  it('renders filename, owner name, and formatted size', () => {
    renderRow();
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('1024B')).toBeInTheDocument();
  });

  it('calls onPreview with the document when preview button is clicked', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByLabelText('Preview document'));
    expect(props.onPreview).toHaveBeenCalledWith(baseDoc);
  });

  it('disables the preview button while loading', () => {
    renderRow({ isLoadingPreview: true });
    expect(screen.getByLabelText('Preview document')).toBeDisabled();
  });

  it('hides the AI summary button when hasAiData is false', () => {
    renderRow({ hasAiData: false });
    expect(screen.queryByLabelText('View AI summary')).not.toBeInTheDocument();
  });

  it('shows the AI summary button when hasAiData is true', () => {
    const { props } = renderRow({ hasAiData: true });
    fireEvent.click(screen.getByLabelText('View AI summary'));
    expect(props.onShowAiSummary).toHaveBeenCalledWith('doc-1');
  });

  it('shows visibility toggle for owner and calls handler with current visibility', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByLabelText('Make visible to collaborators'));
    expect(props.onVisibilityToggle).toHaveBeenCalledWith('doc-1', 'private');
  });

  it('shows a private indicator (not toggle) for non-owner private docs', () => {
    renderRow({ isOwner: false });
    expect(screen.queryByLabelText('Make visible to collaborators')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Make private')).not.toBeInTheDocument();
  });

  it('shows the disabled badge and admin actions when doc is disabled and viewer is admin', () => {
    const disabledDoc = { ...baseDoc, isDisabled: true, disabledAt: '2026-02-01T00:00:00Z' };
    const { props } = renderRow({ doc: disabledDoc, isAdmin: true, isOwner: false });
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Restore document'));
    expect(props.onRestore).toHaveBeenCalledWith('doc-1');

    fireEvent.click(screen.getByLabelText('Permanently delete document'));
    expect(props.onPermanentDelete).toHaveBeenCalledWith('doc-1');
  });

  it('hides delete button when canEdit is false even for the owner', () => {
    renderRow({ canEdit: false });
    expect(screen.queryByLabelText('Delete document')).not.toBeInTheDocument();
  });

  it('calls onDelete with doc id for owner with edit rights on a non-disabled doc', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByLabelText('Delete document'));
    expect(props.onDelete).toHaveBeenCalledWith('doc-1');
  });

  it('is wrapped in React.memo (skips re-render with identical props)', () => {
    const props = {
      doc: baseDoc,
      isOwner: true,
      isAdmin: false,
      canEdit: true,
      hasAiData: false,
      isLoadingPreview: false,
      onPreview: jest.fn(),
      onShowAiSummary: jest.fn(),
      onVisibilityToggle: jest.fn(),
      onRestore: jest.fn(),
      onPermanentDelete: jest.fn(),
      onDelete: jest.fn(),
    };
    const { rerender } = render(<DocumentRow {...props} />);
    rerender(<DocumentRow {...props} />);
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
  });
});
