import React from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { FaMapMarkerAlt, FaHeart, FaStar, FaPlane, FaClock, FaDollarSign, FaUsers, FaCamera, FaArrowRight, FaFire } from 'react-icons/fa';

// Helper function for consistent placeholder images
const getPlaceholderImage = (index, width = 800) => {
  // Use valid Unsplash photo IDs for consistent, working images
  const photoIds = [
    '1540959733332-eab4deabeeaf', // Tokyo cityscape
    '1522383225653-ed111181a951', // Sakura / cherry blossoms
    '1493976040374-85c8e12f0c0e', // Mountains
    '1506905925346-21bda4d32df4', // Beach/coast
    '1502602898657-3e91760cbb34', // Paris/France
    '1513635269975-59663e0ac1ad', // Landscape
  ];
  return `https://images.unsplash.com/photo-${photoIds[index % photoIds.length]}?w=${width}&q=80`;
};

export default {
  title: 'Components/Cards/Featured Cards',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Featured card variations for destinations and experiences with high-contrast badges and proper visibility in light/dark modes.',
      },
    },
  },
};

// Badge color palette with high contrast using design tokens
const badgeStyles = {
  nature: {
    bg: 'var(--badge-nature-bg)',
    text: 'var(--badge-nature-text)',
  },
  culture: {
    bg: 'var(--badge-culture-bg)',
    text: 'var(--badge-culture-text)',
  },
  food: {
    bg: 'var(--badge-food-bg)',
    text: 'var(--badge-food-text)',
  },
  adventure: {
    bg: 'var(--badge-adventure-bg)',
    text: 'var(--badge-adventure-text)',
  },
  relaxation: {
    bg: 'var(--badge-relaxation-bg)',
    text: 'var(--badge-relaxation-text)',
  },
  photography: {
    bg: 'var(--badge-photography-bg)',
    text: 'var(--badge-photography-text)',
  },
  seasonal: {
    bg: 'var(--badge-seasonal-bg)',
    text: 'var(--badge-seasonal-text)',
  },
  nightlife: {
    bg: 'var(--badge-nightlife-bg)',
    text: 'var(--badge-nightlife-text)',
  },
  shopping: {
    bg: 'var(--badge-shopping-bg)',
    text: 'var(--badge-shopping-text)',
  },
  historical: {
    bg: 'var(--badge-historical-bg)',
    text: 'var(--badge-historical-text)',
  },
};

const CustomBadge = ({ type, children }) => {
  const style = badgeStyles[type.toLowerCase()] || badgeStyles.culture;
  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.text,
      padding: 'var(--space-2) var(--space-3)',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 'var(--font-weight-semibold)',
      display: 'inline-block',
    }}>
      {children}
    </span>
  );
};

// Horizontal Featured Card (Full Width)
export const HorizontalFeaturedDestination = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <Card style={{
        background: 'var(--gradient-primary)',
        border: 'none',
        borderRadius: 'var(--radius-2xl)',
        overflow: 'hidden',
        color: 'white',
        boxShadow: 'var(--shadow-xl)',
      }}>
        <Row className="g-0 align-items-center">
          <Col md={6} style={{ padding: 'var(--space-12)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <CustomBadge type="culture">⭐ Featured</CustomBadge>
              <CustomBadge type="seasonal">Trending</CustomBadge>
            </div>
            <h1 style={{
              fontSize: 'var(--font-size-4xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              marginBottom: 'var(--space-4)',
              textShadow: 'var(--shadow-text-md)',
            }}>
              Tokyo, Japan
            </h1>
            <p style={{
              fontSize: 'var(--font-size-xl)',
              opacity: 0.95,
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-6)',
            }}>
              Experience the perfect blend of traditional culture and modern innovation in Japan's vibrant capital city. From ancient temples to neon-lit streets.
            </p>
            <div style={{
              display: 'flex',
              gap: 'var(--space-6)',
              marginBottom: 'var(--space-8)',
              fontSize: 'var(--font-size-lg)',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaPlane style={{ marginRight: 'var(--space-2)' }} />89 Experiences</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaHeart style={{ marginRight: 'var(--space-2)' }} />1,247 Favorites</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaUsers style={{ marginRight: 'var(--space-2)' }} />3,456 Visitors</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Button
                size="lg"
                style={{
                  backgroundColor: 'white',
                  color: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-4) var(--space-8)',
                  fontWeight: 'var(--font-weight-semibold)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                Explore Destination <FaArrowRight />
              </Button>
              <Button
                size="lg"
                style={{
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-4) var(--space-8)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                <FaHeart /> Save Destination
              </Button>
            </div>
          </Col>
          <Col md={6}>
            <img
              src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800"
              alt="Tokyo, Japan"
              style={{ width: '100%', height: '500px', objectFit: 'cover' }}
            />
          </Col>
        </Row>
      </Card>
    </Container>
  </div>
  ),
};

// Vertical Featured Card (Centered)
export const VerticalFeaturedExperience = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <Row>
        <Col lg={{ span: 8, offset: 2 }}>
          <Card style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
            border: 'none',
            borderRadius: 'var(--radius-2xl)',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <img
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800"
              alt="Cherry Blossom Experience"
              style={{
                width: '100%',
                height: '600px',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: -1,
              }}
            />
            <div style={{
              padding: 'var(--space-12)',
              paddingTop: '400px',
              color: 'white',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <CustomBadge type="nature">Nature</CustomBadge>
                <CustomBadge type="culture">Culture</CustomBadge>
                <CustomBadge type="photography">Photography</CustomBadge>
                <CustomBadge type="seasonal">Seasonal</CustomBadge>
              </div>
              <h2 style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--space-4)',
                textShadow: 'var(--shadow-text-md)',
              }}>
                Cherry Blossom Viewing in Ueno Park
              </h2>
              <p style={{
                fontSize: 'var(--font-size-lg)',
                opacity: 0.95,
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-6)',
              }}>
                Join locals for hanami (flower viewing) under the stunning cherry blossoms in one of Tokyo's most beloved parks.
              </p>
              <div style={{
                display: 'flex',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)',
                fontSize: 'var(--font-size-base)',
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaMapMarkerAlt style={{ marginRight: 'var(--space-2)' }} />Tokyo, Japan</span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaClock style={{ marginRight: 'var(--space-2)' }} />3-4 hours</span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaDollarSign style={{ marginRight: 'var(--space-2)' }} />$50</span>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaStar style={{ marginRight: 'var(--space-2)' }} />4.9 (234 reviews)</span>
              </div>
              <Button
                size="lg"
                style={{
                  width: '100%',
                  backgroundColor: 'white',
                  color: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-4)',
                  fontWeight: 'var(--font-weight-semibold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                Plan This Experience <FaArrowRight />
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  </div>
  ),
};

// Split Featured Card with Stats
export const SplitFeaturedDestination = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <Card style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-2xl)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)',
      }}>
        <Row className="g-0">
          <Col md={7}>
            <div style={{ position: 'relative', height: '100%', minHeight: '500px' }}>
              <img
                src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800"
                alt="Paris, France"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                top: 'var(--space-6)',
                left: 'var(--space-6)',
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}>
                <CustomBadge type="culture">🔥 Hot Destination</CustomBadge>
              </div>
            </div>
          </Col>
          <Col md={5} style={{ padding: 'var(--space-10)' }}>
            <h2 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              Paris, France
            </h2>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-8)',
            }}>
              The City of Light beckons with iconic landmarks, world-class museums, and unparalleled romance. Experience art, cuisine, and culture at its finest.
            </p>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-8)',
            }}>
              {[
                { icon: <FaPlane />, label: 'Experiences', value: '124' },
                { icon: <FaHeart />, label: 'Favorites', value: '2.3K' },
                { icon: <FaUsers />, label: 'Visitors', value: '5.6K' },
                { icon: <FaCamera />, label: 'Photos', value: '892' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--font-size-2xl)',
                    color: 'var(--color-primary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    {stat.icon}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Button
                size="lg"
                style={{
                  background: 'var(--gradient-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-4)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'white',
                }}
              >
                Explore Paris
              </Button>
              <Button
                variant="outline-secondary"
                size="lg"
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-4)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border-medium)',
                }}
              >
                <FaHeart /> Add to Favorites
              </Button>
            </div>
          </Col>
        </Row>
      </Card>
    </Container>
  </div>
  ),
};

// Compact Featured Grid
export const CompactFeaturedGrid = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-3xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-2)',
      }}>
        Featured Experiences
      </h1>
      <p style={{
        fontSize: 'var(--font-size-lg)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-8)',
      }}>
        Handpicked adventures from around the world
      </p>

      <Row>
        {[
          {
            title: 'Tokyo Street Food Tour',
            location: 'Tokyo, Japan',
            image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
            price: '$75',
            rating: '4.9',
            reviews: '156',
            badges: ['food', 'culture', 'nightlife'],
          },
          {
            title: 'Santorini Sunset Sailing',
            location: 'Santorini, Greece',
            image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=500',
            price: '$120',
            rating: '5.0',
            reviews: '89',
            badges: ['adventure', 'relaxation', 'photography'],
          },
          {
            title: 'Machu Picchu Trek',
            location: 'Cusco, Peru',
            image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500',
            price: '$450',
            rating: '4.8',
            reviews: '234',
            badges: ['adventure', 'nature', 'historical'],
          },
          {
            title: 'Northern Lights Experience',
            location: 'Reykjavik, Iceland',
            image: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?w=500',
            price: '$200',
            rating: '4.7',
            reviews: '178',
            badges: ['nature', 'photography', 'seasonal'],
          },
        ].map((experience, i) => (
          <Col md={6} lg={3} key={i} style={{ marginBottom: 'var(--space-6)' }}>
            <Card style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              transition: 'var(--transition-normal)',
              cursor: 'pointer',
              height: '100%',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={experience.image}
                  alt={experience.title}
                  style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                />
                <Button
                  size="sm"
                  style={{
                    position: 'absolute',
                    top: 'var(--space-3)',
                    right: 'var(--space-3)',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'white',
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <FaHeart />
                </Button>
                <div style={{
                  position: 'absolute',
                  top: 'var(--space-3)',
                  left: 'var(--space-3)',
                }}>
                  <CustomBadge type="adventure">⭐ Featured</CustomBadge>
                </div>
              </div>
              <Card.Body style={{ padding: 'var(--space-5)' }}>
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}>
                  {experience.badges.map(badge => (
                    <CustomBadge key={badge} type={badge}>
                      {badge.charAt(0).toUpperCase() + badge.slice(1)}
                    </CustomBadge>
                  ))}
                </div>
                <h4 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-2)',
                  lineHeight: 'var(--line-height-snug)',
                }}>
                  {experience.title}
                </h4>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}>
                  <FaMapMarkerAlt /> {experience.location}
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border-light)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                  }}>
                    <FaStar style={{ color: 'var(--color-star)' }} />
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                      {experience.rating}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      ({experience.reviews})
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-primary)',
                  }}>
                    {experience.price}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  </div>
  ),
};

// Hero Featured Card
export const HeroFeaturedCard = {
  render: () => (
  <div style={{
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
  }}>
    <img
      src="https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600"
      alt="London, UK"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: -2,
      }}
    />
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
      zIndex: -1,
    }} />
    <Container>
      <Row>
        <Col lg={{ span: 8, offset: 2 }}>
          <div style={{
            textAlign: 'center',
            color: 'white',
            padding: 'var(--space-12)',
          }}>
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              marginBottom: 'var(--space-6)',
              flexWrap: 'wrap',
            }}>
              <CustomBadge type="culture">🔥 Trending Now</CustomBadge>
              <CustomBadge type="historical">Most Popular</CustomBadge>
              <CustomBadge type="photography">Top Rated</CustomBadge>
            </div>
            <h1 style={{
              fontSize: 'var(--font-size-4xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              marginBottom: 'var(--space-6)',
              textShadow: '0 4px 8px rgba(0,0,0,0.5)',
            }}>
              Discover London's Hidden Gems
            </h1>
            <p style={{
              fontSize: 'var(--font-size-xl)',
              opacity: 0.95,
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-8)',
              maxWidth: '700px',
              margin: '0 auto var(--space-8)',
            }}>
              From royal palaces to underground speakeasies, explore the vibrant history and modern culture of one of the world's greatest cities.
            </p>
            <div style={{
              display: 'flex',
              gap: 'var(--space-8)',
              justifyContent: 'center',
              marginBottom: 'var(--space-10)',
              fontSize: 'var(--font-size-xl)',
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{
                  fontSize: 'var(--font-size-3xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--space-1)',
                }}>
                  156
                </div>
                <div style={{ opacity: 0.9 }}>Experiences</div>
              </div>
              <div>
                <div style={{
                  fontSize: 'var(--font-size-3xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--space-1)',
                }}>
                  4.8★
                </div>
                <div style={{ opacity: 0.9 }}>Average Rating</div>
              </div>
              <div>
                <div style={{
                  fontSize: 'var(--font-size-3xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--space-1)',
                }}>
                  8.2K
                </div>
                <div style={{ opacity: 0.9 }}>Happy Travelers</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                size="lg"
                style={{
                  backgroundColor: 'white',
                  color: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-5) var(--space-10)',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--font-size-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                Start Exploring <FaArrowRight />
              </Button>
              <Button
                size="lg"
                style={{
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-5) var(--space-10)',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--font-size-lg)',
                }}
              >
                View All Destinations
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  </div>
  ),
};
