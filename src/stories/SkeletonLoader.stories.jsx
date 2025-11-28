import SkeletonLoader from '../components/SkeletonLoader/SkeletonLoader';

export default {
  title: 'Components/Feedback/Skeleton Loaders',
  component: SkeletonLoader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Skeleton loaders for displaying loading states. Includes basic variants (text, circle, rectangle) and composite card skeletons for destinations and experiences. All skeletons have a smooth shimmer animation and support dark mode.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'circle', 'rectangle'],
      description: 'The shape variant of the skeleton',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant for text skeleton: sm (small), md (default), lg (large)',
    },
    width: {
      control: 'text',
      description: 'Width (CSS value or number for pixels)',
    },
    height: {
      control: 'text',
      description: 'Height (CSS value or number for pixels)',
    },
    lines: {
      control: 'number',
      description: 'Number of text lines (only for text variant)',
    },
    animate: {
      control: 'boolean',
      description: 'Whether to show shimmer animation',
    },
  },
};

// Basic Variants
export const BasicVariants = {
  name: 'Basic Variants',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Basic Skeleton Variants
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* Text variant */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Text Skeleton
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '400px' }}>
            <SkeletonLoader variant="text" width="100%" height={16} />
            <SkeletonLoader variant="text" width="80%" height={16} />
            <SkeletonLoader variant="text" width="60%" height={16} />
          </div>
        </div>

        {/* Circle variant */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Circle Skeleton (Avatars)
          </h4>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <SkeletonLoader variant="circle" width={32} height={32} />
            <SkeletonLoader variant="circle" width={48} height={48} />
            <SkeletonLoader variant="circle" width={64} height={64} />
            <SkeletonLoader variant="circle" width={96} height={96} />
          </div>
        </div>

        {/* Rectangle variant */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Rectangle Skeleton (Images)
          </h4>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <SkeletonLoader variant="rectangle" width={100} height={100} />
            <SkeletonLoader variant="rectangle" width={150} height={100} />
            <SkeletonLoader variant="rectangle" width={200} height={120} />
          </div>
        </div>
      </div>
    </div>
  ),
};

// Text Size Variants
export const TextSizeVariants = {
  name: 'Text Size Variants',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Text Size Variants
      </h3>
      <p style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Use the `size` prop to change the height of text skeletons: sm (small), md (default), lg (large)
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: '400px' }}>
        {/* Small */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Small (size="sm")
          </h4>
          <p style={{
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)'
          }}>
            Uses $font-size-sm height - ideal for metadata, captions, timestamps
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <SkeletonLoader variant="text" size="sm" width="100%" />
            <SkeletonLoader variant="text" size="sm" width="80%" />
            <SkeletonLoader variant="text" size="sm" width="60%" />
          </div>
        </div>

        {/* Medium (Default) */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Medium (size="md" - default)
          </h4>
          <p style={{
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)'
          }}>
            Uses $font-size-base height - standard body text
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <SkeletonLoader variant="text" size="md" width="100%" />
            <SkeletonLoader variant="text" size="md" width="80%" />
            <SkeletonLoader variant="text" size="md" width="60%" />
          </div>
        </div>

        {/* Large */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Large (size="lg")
          </h4>
          <p style={{
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)'
          }}>
            Uses $font-size-lg height - ideal for titles, headings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <SkeletonLoader variant="text" size="lg" width="100%" />
            <SkeletonLoader variant="text" size="lg" width="80%" />
            <SkeletonLoader variant="text" size="lg" width="60%" />
          </div>
        </div>

        {/* Side by side comparison */}
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Side-by-Side Comparison
          </h4>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <SkeletonLoader variant="text" size="sm" width="100%" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>sm</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <SkeletonLoader variant="text" size="md" width="100%" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>md</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <SkeletonLoader variant="text" size="lg" width="100%" />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>lg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

// Multi-line text
export const MultiLineText = {
  name: 'Multi-Line Text',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Multi-Line Text Skeleton
      </h3>

      <div style={{ maxWidth: '500px' }}>
        <p style={{
          marginBottom: 'var(--space-4)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)'
        }}>
          Use the `lines` prop to render multiple text lines with the last line shorter
        </p>
        <SkeletonLoader variant="text" lines={4} />
      </div>
    </div>
  ),
};

// Destination Card Skeleton (Matches actual DestinationCard: 12rem × 8rem)
export const DestinationCardSkeleton = {
  name: 'Destination Card Skeleton',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-secondary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Destination Card Skeleton
      </h3>
      <p style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Matches actual DestinationCard layout: 12rem × 8rem with CENTERED blurred title overlay
      </p>

      {/* Two rows of destination cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        alignItems: 'center'
      }}>
        {/* Row 1 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          justifyContent: 'center'
        }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`row1-${i}`}
              style={{
                width: '12rem',
                height: '8rem',
                borderRadius: 'var(--radius-2xl)',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-3)'
              }}
            >
              {/* Centered blurred title overlay - mirrors destinationCardTitle */}
              <div style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                minWidth: '60%',
                maxWidth: '90%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SkeletonLoader variant="text" width={`${65 + (i % 4) * 8}%`} height={20} />
              </div>
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          justifyContent: 'center'
        }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`row2-${i}`}
              style={{
                width: '12rem',
                height: '8rem',
                borderRadius: 'var(--radius-2xl)',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-3)'
              }}
            >
              <div style={{
                padding: 'var(--space-2) var(--space-3)',
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                minWidth: '60%',
                maxWidth: '90%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <SkeletonLoader variant="text" width={`${70 + (i % 3) * 8}%`} height={20} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

// Experience Card Skeleton (Matches actual ExperienceCard: 20rem × 12rem)
export const ExperienceCardSkeleton = {
  name: 'Experience Card Skeleton',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-secondary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Experience Card Skeleton
      </h3>
      <p style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Matches actual ExperienceCard layout: 20rem × 12rem with CENTERED title and bottom action button
      </p>

      {/* Two rows of experience cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        alignItems: 'center'
      }}>
        {/* Row 1 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          justifyContent: 'center'
        }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`row1-${i}`}
              style={{
                width: '20rem',
                minHeight: '12rem',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)'
              }}
            >
              {/* Title area - centered (mirrors experienceCardTitle) */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%'
              }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  minWidth: '70%',
                  maxWidth: '95%'
                }}>
                  <SkeletonLoader variant="text" width={`${75 + (i % 3) * 8}%`} height={20} />
                  <SkeletonLoader variant="text" width={`${50 + (i % 4) * 10}%`} height={16} />
                </div>
              </div>
              {/* Action button - bottom center (mirrors experienceCardActions) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-3)',
                flexShrink: 0
              }}>
                <SkeletonLoader variant="circle" width={44} height={44} />
              </div>
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          justifyContent: 'center'
        }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`row2-${i}`}
              style={{
                width: '20rem',
                minHeight: '12rem',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)'
              }}
            >
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%'
              }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  minWidth: '70%',
                  maxWidth: '95%'
                }}>
                  <SkeletonLoader variant="text" width={`${70 + (i % 4) * 8}%`} height={20} />
                  <SkeletonLoader variant="text" width={`${55 + (i % 3) * 10}%`} height={16} />
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-3)',
                flexShrink: 0
              }}>
                <SkeletonLoader variant="circle" width={44} height={44} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

// Loading Grid (AppHome style with both sections - mirrors actual card layouts)
export const AppHomeLoadingState = {
  name: 'App Home Loading State',
  render: () => (
    <div style={{
      padding: 'var(--space-8)',
      background: 'var(--color-bg-secondary)',
      minHeight: '100vh'
    }}>
      <h2 style={{
        marginBottom: 'var(--space-2)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        AppHome Loading State
      </h2>
      <p style={{
        marginBottom: 'var(--space-8)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Complete loading state mirroring actual card layouts (DESTINATIONS_INITIAL_DISPLAY=10, EXPERIENCES_INITIAL_DISPLAY=12)
      </p>

      {/* Popular Destinations Section - mirrors DestinationCard centered title */}
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)'
      }}>
        Popular Destinations
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        justifyContent: 'center',
        marginBottom: 'var(--space-12)'
      }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={`dest-${i}`}
            style={{
              width: '12rem',
              height: '8rem',
              borderRadius: 'var(--radius-2xl)',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-3)'
            }}
          >
            {/* Centered blurred title overlay - mirrors destinationCardTitle */}
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              borderRadius: 'var(--radius-md)',
              minWidth: '60%',
              maxWidth: '90%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SkeletonLoader variant="text" width={`${65 + (i % 4) * 8}%`} height={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Curated Experiences Section - mirrors ExperienceCard centered title + bottom button */}
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)'
      }}>
        Curated Experiences
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        justifyContent: 'center'
      }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={`exp-${i}`}
            style={{
              width: '20rem',
              minHeight: '12rem',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'linear-gradient(145deg, var(--color-bg-tertiary) 0%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3)'
            }}
          >
            {/* Title area - centered (mirrors experienceCardTitle) */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%'
            }}>
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-1)',
                minWidth: '70%',
                maxWidth: '95%'
              }}>
                <SkeletonLoader variant="text" width={`${75 + (i % 3) * 8}%`} height={20} />
                <SkeletonLoader variant="text" width={`${50 + (i % 4) * 10}%`} height={16} />
              </div>
            </div>
            {/* Action button - bottom center (mirrors experienceCardActions) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-3)',
              flexShrink: 0
            }}>
              <SkeletonLoader variant="circle" width={44} height={44} />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

// Alternative Card Style (Generic Skeleton Cards)
// Retained for future use - flexible card skeletons with image + text areas
export const GenericCardSkeletons = {
  name: 'Generic Card Skeletons',
  render: () => (
    <div style={{
      padding: 'var(--space-8)',
      background: 'var(--color-bg-secondary)',
      minHeight: '100vh'
    }}>
      <h2 style={{
        marginBottom: 'var(--space-2)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Generic Card Skeletons
      </h2>
      <p style={{
        marginBottom: 'var(--space-8)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Flexible card skeletons with image area + text content. Useful for generic card layouts.
      </p>

      {/* Large Cards */}
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)'
      }}>
        Large Cards
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-8)',
        justifyContent: 'center',
        marginBottom: 'var(--space-12)'
      }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={`large-${i}`}
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              minWidth: '280px',
              maxWidth: '340px',
              flex: '1 1 280px',
              minHeight: '280px'
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height={200} />
            <div style={{ padding: 'var(--space-3)' }}>
              <SkeletonLoader variant="text" width="80%" height={24} />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <SkeletonLoader variant="text" width="60%" height={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Medium Cards */}
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)'
      }}>
        Medium Cards
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-6)',
        justifyContent: 'center',
        marginBottom: 'var(--space-12)'
      }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={`medium-${i}`}
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              width: '220px',
              minHeight: '200px'
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height={140} />
            <div style={{ padding: 'var(--space-3)' }}>
              <SkeletonLoader variant="text" width="90%" height={18} />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <SkeletonLoader variant="text" width="65%" height={14} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Small Cards */}
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)'
      }}>
        Small Cards
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        justifyContent: 'center'
      }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={`small-${i}`}
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              width: '160px',
              minHeight: '140px'
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height={90} />
            <div style={{ padding: 'var(--space-2)' }}>
              <SkeletonLoader variant="text" width="85%" height={14} />
              <div style={{ marginTop: 'var(--space-1)' }}>
                <SkeletonLoader variant="text" width="60%" height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

// User Profile Skeleton
export const UserProfileSkeleton = {
  name: 'User Profile Skeleton',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        User Profile Skeleton
      </h3>

      <div style={{
        display: 'flex',
        gap: 'var(--space-6)',
        alignItems: 'flex-start',
        maxWidth: '600px',
        padding: 'var(--space-6)',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <SkeletonLoader variant="circle" width={80} height={80} />
        <div style={{ flex: 1 }}>
          <SkeletonLoader variant="text" width="60%" height={24} />
          <div style={{ marginTop: 'var(--space-2)' }}>
            <SkeletonLoader variant="text" width="40%" height={16} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <SkeletonLoader variant="text" lines={2} />
          </div>
        </div>
      </div>
    </div>
  ),
};

// List Item Skeleton
export const ListItemSkeleton = {
  name: 'List Item Skeleton',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        List Item Skeleton
      </h3>
      <p style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Useful for plan items, search results, or any list-based content
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxWidth: '500px'
      }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              alignItems: 'center',
              padding: 'var(--space-4)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <SkeletonLoader variant="rectangle" width={60} height={60} />
            <div style={{ flex: 1 }}>
              <SkeletonLoader variant="text" width="70%" height={18} />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <SkeletonLoader variant="text" width="50%" height={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

// Without Animation
export const WithoutAnimation = {
  name: 'Without Animation',
  render: () => (
    <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
      <h3 style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)'
      }}>
        Skeleton Without Animation
      </h3>
      <p style={{
        marginBottom: 'var(--space-6)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--font-size-sm)'
      }}>
        Set `animate=false` to disable shimmer animation (useful for reduced motion preference)
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)'
          }}>
            Animated (default)
          </h4>
          <SkeletonLoader variant="rectangle" width={200} height={100} animate={true} />
        </div>
        <div>
          <h4 style={{
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)'
          }}>
            Static
          </h4>
          <SkeletonLoader variant="rectangle" width={200} height={100} animate={false} />
        </div>
      </div>
    </div>
  ),
};

// Interactive Playground
export const Playground = (args) => (
  <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
    <h3 style={{
      marginBottom: 'var(--space-6)',
      color: 'var(--color-text-primary)',
      fontSize: 'var(--font-size-xl)',
      fontWeight: 'var(--font-weight-bold)'
    }}>
      Skeleton Playground
    </h3>
    <p style={{
      marginBottom: 'var(--space-6)',
      color: 'var(--color-text-muted)',
      fontSize: 'var(--font-size-sm)'
    }}>
      Use the controls panel to customize the skeleton loader
    </p>
    <SkeletonLoader {...args} />
  </div>
);
Playground.args = {
  variant: 'rectangle',
  size: 'md',
  width: 300,
  height: 150,
  animate: true,
  lines: 1,
};
