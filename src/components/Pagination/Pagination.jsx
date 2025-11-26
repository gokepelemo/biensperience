import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../components/design-system';
import styles from './Pagination.module.scss';

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

export default function Pagination({ page, currentPage, totalPages, onPageChange, className, variant = 'numbers', totalResults, resultsPerPage = 100 }) {
  const active = typeof page === 'number' ? page : (typeof currentPage === 'number' ? currentPage : 1);
  const onChange = onPageChange || (() => {});
  if (!totalPages || totalPages <= 1) return null;

  // treat legacy 'text' variant as numbered
  const v = variant === 'text' ? 'numbers' : variant;

  if (v === 'dots') {
    return (
      <div className={`${styles.pagination} ${styles.paginationDots} ${className || ''}`}>
        <button
          className={styles.paginationArrow}
          onClick={() => onChange(Math.max(1, active - 1))}
          disabled={active === 1}
          aria-label="Previous page"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={styles.paginationDotsContainer}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`${styles.paginationDot} ${i + 1 === active ? styles.active : ''}`}
              onClick={() => onChange(i + 1)}
              aria-label={`Page ${i + 1}`}
              aria-current={i + 1 === active ? 'page' : undefined}
            />
          ))}
        </div>

        <button
          className={styles.paginationArrow}
          onClick={() => onChange(Math.min(totalPages, active + 1))}
          disabled={active === totalPages}
          aria-label="Next page"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

      </div>
    );
  }

  const pages = buildPages(active, totalPages);

  return (
    <nav aria-label="Pagination" className={`${styles.paginationWrap} ${className || ''}`}>
      <ul className={`pagination justify-content-center ${styles.paginationList}`}>
        <li className="page-item">
          <Button variant="link" size="sm" onClick={() => onChange(1)} disabled={active === 1}>First</Button>
        </li>
        {pages.map((it, idx) => (
          typeof it === 'number' ? (
            <li key={it} className={`page-item ${it === active ? 'active' : ''}`}>
              <Button
                variant={it === active ? 'primary' : 'link'}
                size="sm"
                onClick={() => onChange(it)}
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
          <Button variant="link" size="sm" onClick={() => onChange(totalPages)} disabled={active === totalPages}>Last</Button>
        </li>
      </ul>
      {typeof totalResults === 'number' && (
        <div className={styles.paginationInfo}>
          Showing {resultsPerPage} of {totalResults.toLocaleString()} results
        </div>
      )}
    </nav>
  );
}

Pagination.propTypes = {
  page: PropTypes.number,
  currentPage: PropTypes.number,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['numbers', 'dots', 'text']),
  totalResults: PropTypes.number,
  resultsPerPage: PropTypes.number,
};
