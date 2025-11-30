import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../components/design-system';
import styles from './Pagination.module.scss';

/**
 * Build page numbers with ellipsis for large page counts
 */
function buildPages(page, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  if (page > 4) pages.push('left-ellipsis');

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 3) pages.push('right-ellipsis');
  pages.push(totalPages);
  return pages;
}

/**
 * Calculate dot size based on record count relative to max
 * Returns a size class: 'xs', 'sm', 'md', 'lg'
 *
 * As shown in the screenshot, dots vary in size to represent
 * the number of records on each page.
 */
function getDotSize(recordCount, maxRecords) {
  if (!recordCount || !maxRecords || maxRecords === 0) return 'sm';
  const ratio = recordCount / maxRecords;
  if (ratio >= 0.75) return 'lg';
  if (ratio >= 0.5) return 'md';
  if (ratio >= 0.25) return 'sm';
  return 'xs';
}

/**
 * Chevron Left Icon
 */
const ChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 12L6 8L10 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Chevron Right Icon
 */
const ChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 12L10 8L6 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Pagination Component
 *
 * Variants (based on design screenshot):
 * - 'default': Full row with page number, arrows, Previous/Next, results info, ellipsis
 * - 'compact': Arrows + Previous/Next only (no page numbers)
 * - 'dots': Grid of dots where dot size indicates record count per page
 * - 'numbers': Legacy variant with numbered page buttons
 *
 * States (visual only, handled via CSS):
 * - Default: Normal appearance (Row 1 in screenshot)
 * - Hover: Light background highlight (Row 2 in screenshot)
 * - Active: Primary color (Row 3 in screenshot)
 * - Disabled: Faded appearance (Row 4 in screenshot)
 */
export default function Pagination({
  page,
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  variant = 'default',
  totalResults,
  resultsPerPage = 100,
  pageRecordCounts = [],
  disabled = false,
  showResultsInfo = true
}) {
  const active = typeof page === 'number' ? page : (typeof currentPage === 'number' ? currentPage : 1);
  const onChange = onPageChange || (() => {});

  // Don't render if only one page or no pages
  if (!totalPages || totalPages <= 1) return null;

  // Normalize variant (treat legacy 'text' as 'default')
  const normalizedVariant = variant === 'text' ? 'default' : variant;

  // Calculate max record count for dot sizing
  const maxRecordCount = pageRecordCounts.length > 0
    ? Math.max(...pageRecordCounts)
    : resultsPerPage;

  // Get current page's displayed results count
  const currentPageResults = pageRecordCounts[active - 1] || Math.min(
    resultsPerPage,
    totalResults ? Math.max(0, totalResults - (active - 1) * resultsPerPage) : resultsPerPage
  );

  // Ensure currentPageResults doesn't exceed resultsPerPage
  const displayedResults = Math.min(currentPageResults, resultsPerPage);

  // Is first/last page
  const isFirst = active === 1;
  const isLast = active === totalPages;

  // Results info text
  const resultsInfoText = typeof totalResults === 'number'
    ? `Showing ${displayedResults.toLocaleString()} of ${totalResults.toLocaleString()} results`
    : null;

  // Common click handlers
  const handlePrev = () => {
    if (!disabled && !isFirst) onChange(active - 1);
  };
  const handleNext = () => {
    if (!disabled && !isLast) onChange(active + 1);
  };
  const handlePage = (p) => {
    if (!disabled) onChange(p);
  };

  // Render dots variant (dot size = record count)
  if (normalizedVariant === 'dots') {
    return (
      <div className={`${styles.paginationDotsGrid} ${disabled ? styles.disabled : ''} ${className}`}>
        {Array.from({ length: totalPages }, (_, i) => {
          const pageNum = i + 1;
          const isActive = pageNum === active;
          const recordCount = pageRecordCounts[i] || resultsPerPage;
          const sizeClass = getDotSize(recordCount, maxRecordCount);

          return (
            <button
              key={pageNum}
              className={`${styles.dot} ${styles[`dot${sizeClass.charAt(0).toUpperCase() + sizeClass.slice(1)}`]} ${isActive ? styles.dotActive : ''}`}
              onClick={() => handlePage(pageNum)}
              disabled={disabled}
              aria-label={`Page ${pageNum}${pageRecordCounts[i] ? ` (${pageRecordCounts[i]} items)` : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={`Page ${pageNum}${pageRecordCounts[i] ? ` (${pageRecordCounts[i]} items)` : ''}`}
            />
          );
        })}
      </div>
    );
  }

  // Render compact variant
  if (normalizedVariant === 'compact') {
    return (
      <div className={`${styles.paginationRow} ${disabled ? styles.disabled : ''} ${className}`}>
        {/* Previous text button */}
        <button
          className={`${styles.textButton} ${isFirst ? styles.disabled : ''}`}
          onClick={handlePrev}
          disabled={disabled || isFirst}
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        {/* Page info */}
        <span className={styles.pageInfo}>
          Page {active} of {totalPages}
        </span>

        {/* Next text button */}
        <button
          className={`${styles.textButton} ${isLast ? styles.disabled : ''}`}
          onClick={handleNext}
          disabled={disabled || isLast}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  // Render default variant (full row as shown in screenshot)
  if (normalizedVariant === 'default') {
    return (
      <div className={`${styles.paginationRow} ${disabled ? styles.disabled : ''} ${className}`}>
        {/* Page number indicator */}
        <span className={styles.pageIndicator}>{active}</span>

        {/* Arrow buttons (circular) */}
        <button
          className={`${styles.arrowButton} ${isFirst ? styles.disabled : ''}`}
          onClick={handlePrev}
          disabled={disabled || isFirst}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className={`${styles.arrowButton} ${isLast ? styles.disabled : ''}`}
          onClick={handleNext}
          disabled={disabled || isLast}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>

        {/* Previous text button */}
        <button
          className={`${styles.textButton} ${isFirst ? styles.disabled : ''}`}
          onClick={handlePrev}
          disabled={disabled || isFirst}
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        {/* Next text button */}
        <button
          className={`${styles.textButton} ${isLast ? styles.disabled : ''}`}
          onClick={handleNext}
          disabled={disabled || isLast}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>

        {/* Results info */}
        {showResultsInfo && resultsInfoText && (
          <span className={styles.resultsInfo}>{resultsInfoText}</span>
        )}

        {/* More indicator */}
        <button className={`${styles.moreButton} ${styles.disabled}`} disabled aria-label="More options">
          <span>...</span>
        </button>
      </div>
    );
  }

  // Render numbers variant (legacy with page numbers)
  const pages = buildPages(active, totalPages);

  return (
    <nav aria-label="Pagination" className={`${styles.paginationWrap} ${disabled ? styles.disabled : ''} ${className}`}>
      <ul className={`pagination justify-content-center ${styles.paginationList}`}>
        <li className="page-item">
          <Button variant="link" size="sm" onClick={() => handlePage(1)} disabled={disabled || isFirst} aria-label="First page">First</Button>
        </li>
        <li className="page-item">
          <Button variant="link" size="sm" onClick={handlePrev} disabled={disabled || isFirst} aria-label="Previous page">Previous</Button>
        </li>
        {pages.map((it, idx) => (
          typeof it === 'number' ? (
            <li key={it} className={`page-item ${it === active ? 'active' : ''}`}>
              <Button
                variant={it === active ? 'primary' : 'link'}
                size="sm"
                onClick={() => handlePage(it)}
                disabled={disabled}
                aria-current={it === active ? 'page' : undefined}
              >
                {it}
              </Button>
            </li>
          ) : (
            <li key={`ellipsis-${idx}`} className="page-item disabled"><span className="page-link">…</span></li>
          )
        ))}
        <li className="page-item">
          <Button variant="link" size="sm" onClick={handleNext} disabled={disabled || isLast} aria-label="Next page">Next</Button>
        </li>
        <li className="page-item">
          <Button variant="link" size="sm" onClick={() => handlePage(totalPages)} disabled={disabled || isLast} aria-label="Last page">Last</Button>
        </li>
      </ul>
      {showResultsInfo && resultsInfoText && (
        <div className={styles.paginationInfo}>
          {resultsInfoText}
        </div>
      )}
    </nav>
  );
}

Pagination.propTypes = {
  /** Current page number (1-indexed) */
  page: PropTypes.number,
  /** Alias for page (legacy support) */
  currentPage: PropTypes.number,
  /** Total number of pages */
  totalPages: PropTypes.number.isRequired,
  /** Callback when page changes */
  onPageChange: PropTypes.func,
  /** Additional CSS classes */
  className: PropTypes.string,
  /** Visual variant */
  variant: PropTypes.oneOf(['default', 'compact', 'dots', 'numbers', 'text']),
  /** Total count of results */
  totalResults: PropTypes.number,
  /** Results shown per page */
  resultsPerPage: PropTypes.number,
  /** Array of record counts per page (for dots variant sizing) */
  pageRecordCounts: PropTypes.arrayOf(PropTypes.number),
  /** Disable all controls */
  disabled: PropTypes.bool,
  /** Show "Showing X of Y results" text */
  showResultsInfo: PropTypes.bool,
};
