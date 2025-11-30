import React, { useState } from 'react';
import Pagination from './Pagination';
import styles from './Pagination.module.scss';
import '../../styles/design-tokens.css';
import '../../styles/utilities.scss';

export default {
  title: 'Components/Navigation/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
## Pagination Component

A flexible pagination component supporting multiple variants and states.

### Design Tokens Used
- \`--pagination-bg\`: Background color
- \`--pagination-bg-hover\`: Hover background
- \`--pagination-bg-active\`: Active/selected state
- \`--pagination-border\`: Border color
- \`--pagination-text\`: Text color
- \`--pagination-dot-xs/sm/md/lg\`: Dot sizes for record count visualization

### Variants
- **default**: Full row with page number, arrows, Previous/Next buttons, results info
- **compact**: Minimal with just Previous/Next
- **dots**: Grid of dots where size indicates records per page
- **numbers**: Legacy numbered page buttons

### States
- **Default**: Normal appearance
- **Hover**: Light background highlight
- **Active**: Primary color for current page
- **Disabled**: Faded, non-interactive

### Accessibility
- Keyboard navigable with focus rings
- ARIA labels on all buttons
- \`aria-current="page"\` on active page
- Minimum 44x44px touch targets
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'compact', 'dots', 'numbers'],
    },
    totalPages: {
      control: { type: 'number', min: 1, max: 100 },
    },
    page: {
      control: { type: 'number', min: 1 },
    },
    totalResults: {
      control: { type: 'number', min: 0 },
    },
    resultsPerPage: {
      control: { type: 'number', min: 1 },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    showResultsInfo: {
      control: { type: 'boolean' },
    },
  },
};

// Default variant
export const Default = {
  args: {
    variant: 'default',
    page: 9,
    totalPages: 10,
    totalResults: 1000,
    resultsPerPage: 100,
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.page);
    return (
      <Pagination
        {...args}
        page={currentPage}
        onPageChange={setCurrentPage}
      />
    );
  },
};

// All States Showcase (matches screenshot)
export const AllStates = {
  name: 'All States',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%' }}>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Row 1: Default State
        </h4>
        <Pagination
          variant="default"
          page={9}
          totalPages={10}
          totalResults={1000}
          resultsPerPage={100}
          onPageChange={() => {}}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Row 2: Hover State
        </h4>
        <div className={`${styles.paginationRow} ${styles.stateHover}`}>
          <span className={styles.pageIndicator}>9</span>
          <button className={styles.arrowButton} aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.arrowButton} aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.textButton}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Previous</span>
          </button>
          <button className={styles.textButton}>
            <span>Next</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className={styles.resultsInfo}>Showing 100 of 1,000 results</span>
          <button className={`${styles.moreButton} ${styles.disabled}`} disabled>
            <span>...</span>
          </button>
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Row 3: Active State
        </h4>
        <div className={`${styles.paginationRow} ${styles.stateActive}`}>
          <span className={styles.pageIndicator}>9</span>
          <button className={styles.arrowButton} aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.arrowButton} aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.textButton}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Previous</span>
          </button>
          <button className={styles.textButton}>
            <span>Next</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className={styles.resultsInfo}>Showing 100 of 1,000 results</span>
          <button className={`${styles.moreButton} ${styles.disabled}`} disabled>
            <span>...</span>
          </button>
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Row 4: Disabled State
        </h4>
        <Pagination
          variant="default"
          page={9}
          totalPages={10}
          totalResults={1000}
          resultsPerPage={100}
          onPageChange={() => {}}
          disabled
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcases all four states as shown in the design: Default, Hover, Active, and Disabled.',
      },
    },
  },
};

// Dots with Size Visualization
export const DotsWithRecordCounts = {
  name: 'Dots with Record Counts',
  render: () => {
    const [currentPage, setCurrentPage] = useState(3);
    // Simulate varying record counts per page
    const pageRecordCounts = [100, 100, 45, 80, 100, 20];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        <div>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Dot size represents records per page
          </h4>
          <Pagination
            variant="dots"
            page={currentPage}
            totalPages={6}
            pageRecordCounts={pageRecordCounts}
            onPageChange={setCurrentPage}
          />
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          <p>Page {currentPage} selected • {pageRecordCounts[currentPage - 1]} records</p>
          <p style={{ marginTop: '0.5rem' }}>
            Sizes: XS (≤25%), SM (≤50%), MD (≤75%), LG (≥75%)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div className={`${styles.dot} ${styles.dotXs}`} style={{ margin: '0 auto' }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>XS</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className={`${styles.dot} ${styles.dotSm}`} style={{ margin: '0 auto' }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>SM</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className={`${styles.dot} ${styles.dotMd}`} style={{ margin: '0 auto' }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>MD</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className={`${styles.dot} ${styles.dotLg}`} style={{ margin: '0 auto' }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>LG</span>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
The dots variant visualizes record density per page through dot size:
- **XS (8px)**: ≤25% of max records
- **SM (12px)**: 26-50% of max records
- **MD (16px)**: 51-75% of max records
- **LG (20px)**: ≥75% of max records

This helps users understand data distribution at a glance.
        `,
      },
    },
  },
};

// Compact Variant
export const Compact = {
  args: {
    variant: 'compact',
    page: 5,
    totalPages: 10,
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.page);
    return (
      <Pagination
        {...args}
        page={currentPage}
        onPageChange={setCurrentPage}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal pagination with just Previous/Next buttons and page info. Ideal for space-constrained layouts.',
      },
    },
  },
};

// Numbers (Legacy) Variant
export const Numbers = {
  args: {
    variant: 'numbers',
    page: 5,
    totalPages: 20,
    totalResults: 2000,
    resultsPerPage: 100,
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.page);
    return (
      <Pagination
        {...args}
        page={currentPage}
        onPageChange={setCurrentPage}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional numbered pagination with First, Previous, page numbers, Next, and Last buttons.',
      },
    },
  },
};

// Interactive Demo
export const Interactive = {
  name: 'Interactive Demo',
  render: () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [variant, setVariant] = useState('default');
    const totalPages = 10;
    const totalResults = 487;
    const resultsPerPage = 50;

    // Generate realistic record counts (last page may have fewer)
    const pageRecordCounts = Array.from({ length: totalPages }, (_, i) => {
      if (i === totalPages - 1) {
        return totalResults % resultsPerPage || resultsPerPage;
      }
      return resultsPerPage;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: '600px' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {['default', 'compact', 'dots', 'numbers'].map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              style={{
                padding: '0.5rem 1rem',
                background: variant === v ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                color: variant === v ? 'white' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border-medium)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            variant={variant}
            page={currentPage}
            totalPages={totalPages}
            totalResults={totalResults}
            resultsPerPage={resultsPerPage}
            pageRecordCounts={pageRecordCounts}
            onPageChange={setCurrentPage}
          />
        </div>

        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Current page: <strong>{currentPage}</strong> / {totalPages}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo allowing you to switch between variants and navigate pages.',
      },
    },
  },
};

// Dark Mode Preview
export const DarkMode = {
  name: 'Dark Mode',
  render: () => (
    <div
      data-theme="dark"
      style={{
        padding: '2rem',
        background: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1rem' }}>
        Dark Mode Preview
      </h3>

      <div>
        <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          Default Variant
        </h4>
        <Pagination
          variant="default"
          page={5}
          totalPages={10}
          totalResults={500}
          resultsPerPage={50}
          onPageChange={() => {}}
        />
      </div>

      <div>
        <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          Dots Variant
        </h4>
        <Pagination
          variant="dots"
          page={3}
          totalPages={6}
          pageRecordCounts={[50, 50, 30, 50, 50, 20]}
          onPageChange={() => {}}
        />
      </div>

      <div>
        <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          Numbers Variant
        </h4>
        <Pagination
          variant="numbers"
          page={3}
          totalPages={10}
          totalResults={500}
          resultsPerPage={50}
          onPageChange={() => {}}
        />
      </div>
    </div>
  ),
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'All pagination variants automatically adapt to dark mode using design tokens.',
      },
    },
  },
};

// Responsive Behavior
export const Responsive = {
  name: 'Responsive',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Desktop (full width)
        </h4>
        <Pagination
          variant="default"
          page={5}
          totalPages={10}
          totalResults={1000}
          resultsPerPage={100}
          onPageChange={() => {}}
        />
      </div>

      <div style={{ maxWidth: '400px' }}>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Mobile (constrained)
        </h4>
        <Pagination
          variant="default"
          page={5}
          totalPages={10}
          totalResults={1000}
          resultsPerPage={100}
          onPageChange={() => {}}
        />
      </div>

      <div style={{ maxWidth: '300px' }}>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Compact for small spaces
        </h4>
        <Pagination
          variant="compact"
          page={5}
          totalPages={10}
          onPageChange={() => {}}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Pagination responsively adjusts to available space. Use compact variant for very small containers.',
      },
    },
  },
};

// Without Results Info
export const WithoutResultsInfo = {
  name: 'Without Results Info',
  args: {
    variant: 'default',
    page: 5,
    totalPages: 10,
    showResultsInfo: false,
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.page);
    return (
      <Pagination
        {...args}
        page={currentPage}
        onPageChange={setCurrentPage}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Default variant without the "Showing X of Y results" text. Useful when total count is unknown.',
      },
    },
  },
};
