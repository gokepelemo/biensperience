import React from 'react';
import { Container, Badge } from 'react-bootstrap';
import { FaHome, FaChevronRight } from 'react-icons/fa';

export default {
  title: 'Design System/Navigation Components',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Navigation components including breadcrumbs, link groups, and hierarchical navigation patterns with proper spacing and borders.',
      },
    },
  },
};

// Breadcrumb Link Item Component
const BreadcrumbItem = ({ children, isActive = false, isLast = false, hasHome = false }) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    borderRadius: 'var(--radius-full)',
    textDecoration: 'none',
    transition: 'var(--transition-normal)',
    cursor: isActive ? 'default' : 'pointer',
  };

  const activeStyle = isActive ? {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: '2px solid var(--color-primary)',
  } : {
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    border: '2px solid transparent',
  };

  const hoverStyle = !isActive ? {
    ':hover': {
      backgroundColor: 'var(--color-bg-secondary)',
    }
  } : {};

  return (
    <>
      {hasHome && (
        <>
          <FaHome style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }} />
          <FaChevronRight style={{ color: 'var(--color-text-muted)', fontSize: '10px' }} />
        </>
      )}
      <span style={{ ...baseStyle, ...activeStyle }}>
        {children}
      </span>
      {!isLast && (
        <FaChevronRight style={{ 
          color: 'var(--color-text-muted)', 
          fontSize: '10px',
          margin: '0 var(--space-1)',
        }} />
      )}
    </>
  );
};

// Single Link Item Variations
export const LinkItemVariations = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
  }}>
    <Container>
      <h2 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        Link Item Variations
      </h2>

      <div style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        border: '2px dashed var(--color-border-medium)',
      }}>
        {/* Row 1 - Default States */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Destinations
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Experiences
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
        </div>

        {/* Row 2 - Hover States */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-primary)',
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-primary)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
        </div>

        {/* Row 3 - Active States */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'white',
            backgroundColor: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'white',
            backgroundColor: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            transition: 'var(--transition-normal)',
          }}>
            Link Item
          </span>
        </div>

        {/* Row 4 - Disabled States */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            border: '2px solid var(--color-border-light)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            border: '2px solid var(--color-border-light)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}>
            Link Item
          </span>
          <span style={{
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            border: '2px solid var(--color-border-light)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}>
            Link Item
          </span>
        </div>
      </div>
    </Container>
  </div>
  ),
};

// Breadcrumb Variations
export const BreadcrumbGroups = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
    minHeight: '100vh',
  }}>
    <Container>
      <h2 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        Breadcrumb Navigation Groups
      </h2>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}>
        {/* 3 variations per row */}
        {[0, 1, 2].map((rowIndex) => (
          <div key={rowIndex} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-6)',
          }}>
            {[0, 1, 2].map((colIndex) => (
              <div key={colIndex} style={{
                padding: 'var(--space-6)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                border: '2px dashed var(--color-border-medium)',
              }}>
                {/* Breadcrumb Row 1 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}>
                  <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                  <BreadcrumbItem>Link Item</BreadcrumbItem>
                  <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
                </div>

                {/* Breadcrumb Row 2 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}>
                  <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                  <BreadcrumbItem>Link Item</BreadcrumbItem>
                  <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
                </div>

                {/* Breadcrumb Row 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                  <BreadcrumbItem>Link Item</BreadcrumbItem>
                  <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Additional 3 variations */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-6)',
        }}>
          {[0, 1, 2].map((colIndex) => (
            <div key={colIndex} style={{
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              border: '2px dashed var(--color-border-medium)',
            }}>
              {/* Breadcrumb Row 1 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
              }}>
                <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                <BreadcrumbItem>Link Item</BreadcrumbItem>
                <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
              </div>

              {/* Breadcrumb Row 2 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
              }}>
                <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                <BreadcrumbItem>Link Item</BreadcrumbItem>
                <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
              </div>

              {/* Breadcrumb Row 3 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <BreadcrumbItem hasHome>Link Item</BreadcrumbItem>
                <BreadcrumbItem>Link Item</BreadcrumbItem>
                <BreadcrumbItem isActive isLast>Link Item</BreadcrumbItem>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  </div>
  ),
};
