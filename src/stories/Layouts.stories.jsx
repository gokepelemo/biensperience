import React from 'react';
import { Container, Row, Col, Card, Button, Badge, Image } from 'react-bootstrap';
import { FaMapMarkerAlt, FaHeart, FaShare, FaUser, FaEnvelope, FaGlobe, FaCamera, FaPlane, FaCheckCircle } from 'react-icons/fa';

// Helper function for consistent placeholder images
const getPlaceholderImage = (index, width = 800) => {
  // Use valid Unsplash photo IDs for consistent, working images
  const photoIds = [
    '1540959733332-eab4deabeeaf', // Tokyo cityscape
    '1522383225653-ed111181a951', // Sakura / cherry blossoms
    '1493976040374-85c8e12f0c0e', // Mountains
    '1506905925346-21bda4d32df4', // Beach/coast
    '1524850011-4b6b6d24b5b7', // City street
    '1476514525535-07fb3b4ae5f1', // Architecture
  ];
  return `https://images.unsplash.com/photo-${photoIds[index % photoIds.length]}?w=${width}&q=80`;
};

export default {
  title: 'Patterns/Page Layouts',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Common layout patterns used throughout the Biensperience application. Each pattern demonstrates responsive design, dark mode support, and proper use of design tokens.',
      },
    },
  },
};

// Sample data
const sampleDestination = {
  name: 'Tokyo, Japan',
  country: 'Japan',
  description: 'Experience the perfect blend of traditional culture and modern innovation in Japan\'s vibrant capital city.',
  image: getPlaceholderImage(0, 800),
  favoriteCount: 1247,
  experienceCount: 89,
};

const sampleExperience = {
  name: 'Cherry Blossom Viewing in Ueno Park',
  destination: 'Tokyo, Japan',
  description: 'Join locals for hanami (flower viewing) under the stunning cherry blossoms in one of Tokyo\'s most beloved parks.',
  image: getPlaceholderImage(1, 800),
  difficulty: 'Easy',
  estimatedCost: '$50',
  duration: '3-4 hours',
  tags: ['Nature', 'Culture', 'Photography', 'Seasonal'],
};

const sampleUser = {
  name: 'Sarah Chen',
  email: 'sarah.chen@example.com',
  bio: 'Adventure seeker and travel photographer. Always looking for the next great experience to capture and share.',
  avatar: 'https://i.pravatar.cc/150?img=47',
  location: 'San Francisco, CA',
  experiencesCount: 45,
  destinationsCount: 23,
  planCount: 12,
};

// Hero Section Pattern
export const HeroSection = () => (
  <div style={{
    background: 'var(--gradient-primary)',
    color: 'white',
    padding: 'var(--space-24) var(--space-8)',
    textAlign: 'center',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 'var(--font-weight-extrabold)',
        marginBottom: 'var(--space-6)',
        textShadow: 'var(--shadow-text-md)',
      }}>
        Discover Your Next Adventure
      </h1>
      <p style={{
        fontSize: 'var(--font-size-xl)',
        marginBottom: 'var(--space-8)',
        maxWidth: '800px',
        margin: '0 auto var(--space-8)',
        opacity: 0.95,
      }}>
        Plan unforgettable experiences and share your travel stories with a community of explorers
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button size="lg" variant="light" style={{
          padding: 'var(--space-4) var(--space-8)',
          fontWeight: 'var(--font-weight-semibold)',
          borderRadius: 'var(--radius-full)',
        }}>
          Start Planning
        </Button>
        <Button size="lg" variant="outline-light" style={{
          padding: 'var(--space-4) var(--space-8)',
          fontWeight: 'var(--font-weight-semibold)',
          borderRadius: 'var(--radius-full)',
        }}>
          Browse Experiences
        </Button>
      </div>
    </Container>
  </div>
);

// Destination Detail View Pattern
export const DestinationDetailView = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      {/* Hero Image */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        marginBottom: 'var(--space-8)',
        height: '400px',
        position: 'relative',
      }}>
        <img 
          src={sampleDestination.image}
          alt={sampleDestination.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          padding: 'var(--space-8)',
          color: 'white',
        }}>
          <h1 style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--space-2)',
          }}>
            {sampleDestination.name}
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
            <span><FaMapMarkerAlt /> {sampleDestination.country}</span>
            <span><FaHeart /> {sampleDestination.favoriteCount} favorites</span>
            <span><FaPlane /> {sampleDestination.experienceCount} experiences</span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <Row>
        <Col lg={8}>
          <Card style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-6)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Card.Body style={{ padding: 'var(--space-6)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                About This Destination
              </h2>
              <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-relaxed)',
              }}>
                {sampleDestination.description}
              </p>
            </Card.Body>
          </Card>

          {/* Experience Cards Grid */}
          <h3 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-4)',
          }}>
            Popular Experiences
          </h3>
          <Row>
            {[1, 2, 3].map(i => (
              <Col md={6} key={i} style={{ marginBottom: 'var(--space-4)' }}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  transition: 'var(--transition-normal)',
                  cursor: 'pointer',
                  height: '100%',
                }}>
                  <div style={{ height: '200px', overflow: 'hidden' }}>
                    <img 
                      src={getPlaceholderImage(i, 400)}
                      alt={`Experience ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <Card.Body>
                    <h4 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Experience Title {i}
                    </h4>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-muted)',
                    }}>
                      A brief description of this amazing experience...
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>

        {/* Sidebar */}
        <Col lg={4}>
          <Card style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            position: 'sticky',
            top: 'var(--space-6)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Button variant="primary" style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                <FaHeart /> Add to Favorites
              </Button>
              <Button variant="outline-secondary" style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--font-weight-medium)',
              }}>
                <FaShare /> Share Destination
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  </div>
);

// Experience Detail View Pattern
export const ExperienceDetailView = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <Row>
        <Col lg={8}>
          {/* Main Image */}
          <div style={{
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            marginBottom: 'var(--space-6)',
            height: '450px',
          }}>
            <img 
              src={sampleExperience.image}
              alt={sampleExperience.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Title and Meta */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              {sampleExperience.tags.map(tag => (
                <Badge key={tag} bg="secondary" style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              {sampleExperience.name}
            </h1>
            <p style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <FaMapMarkerAlt /> {sampleExperience.destination}
            </p>
          </div>

          {/* Description */}
          <Card style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-6)',
          }}>
            <Card.Body style={{ padding: 'var(--space-6)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                Experience Overview
              </h2>
              <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-relaxed)',
              }}>
                {sampleExperience.description}
              </p>
            </Card.Body>
          </Card>

          {/* Plan Items Section */}
          <Card style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <Card.Body style={{ padding: 'var(--space-6)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                What You'll Do
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {[
                  'Arrive at Ueno Park early morning for best viewing',
                  'Walk along the main pathway lined with cherry trees',
                  'Visit Shinobazu Pond for reflection views',
                  'Enjoy a traditional bento lunch under the blossoms',
                ].map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <FaCheckCircle style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ color: 'var(--color-text-primary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Info Sidebar */}
        <Col lg={4}>
          <Card style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            position: 'sticky',
            top: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Experience Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                  Difficulty
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {sampleExperience.difficulty}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                  Estimated Cost
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {sampleExperience.estimatedCost}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                  Duration
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {sampleExperience.duration}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Button variant="primary" size="lg" style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Plan This Experience
              </Button>
              <Button variant="outline-secondary" style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--font-weight-medium)',
              }}>
                <FaShare /> Share
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  </div>
);

// Profile View Pattern
export const ProfileView = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      {/* Profile Header */}
      <Card style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: 'var(--space-8)',
        overflow: 'hidden',
      }}>
        {/* Cover Image */}
        <div style={{
          height: '200px',
          background: 'var(--gradient-primary)',
        }} />
        
        <Card.Body style={{ padding: 'var(--space-6)', marginTop: '-80px' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <img 
              src={sampleUser.avatar}
              alt={sampleUser.name}
              style={{
                width: '150px',
                height: '150px',
                borderRadius: 'var(--radius-full)',
                border: '5px solid var(--color-bg-primary)',
                boxShadow: 'var(--shadow-lg)',
              }}
            />
            
            {/* Info */}
            <div style={{ flex: 1, minWidth: '250px' }}>
              <h1 style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
                marginTop: '70px',
              }}>
                {sampleUser.name}
              </h1>
              <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <FaMapMarkerAlt /> {sampleUser.location}
              </p>
              <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-4)',
              }}>
                {sampleUser.bio}
              </p>
              
              {/* Stats */}
              <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                    {sampleUser.experiencesCount}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    Experiences
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                    {sampleUser.destinationsCount}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    Destinations
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                    {sampleUser.planCount}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    Plans
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', marginTop: '70px' }}>
              <Button variant="outline-secondary" style={{
                borderRadius: 'var(--radius-full)',
              }}>
                <FaEnvelope /> Message
              </Button>
              <Button variant="primary" style={{
                borderRadius: 'var(--radius-full)',
              }}>
                Follow
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Content Tabs */}
      <Row>
        <Col lg={12}>
          <div style={{
            display: 'flex',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            borderBottom: '2px solid var(--color-border-light)',
            paddingBottom: 'var(--space-2)',
          }}>
            {['Experiences', 'Plans', 'Favorites'].map(tab => (
              <button
                key={tab}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 'var(--space-3) 0',
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: tab === 'Experiences' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: tab === 'Experiences' ? '3px solid var(--color-primary)' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content Grid */}
          <Row>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Col md={4} key={i} style={{ marginBottom: 'var(--space-6)' }}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  transition: 'var(--transition-normal)',
                  cursor: 'pointer',
                  height: '100%',
                }}>
                  <div style={{ height: '200px', overflow: 'hidden' }}>
                    <img 
                      src={getPlaceholderImage(i, 400)}
                      alt={`Content ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <Card.Body>
                    <h4 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Experience Title {i}
                    </h4>
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-muted)',
                    }}>
                      Destination Name
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </Container>
  </div>
);

// User Grid Pattern (All Users View)
export const UserGridView = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-3)',
        }}>
          Community
        </h1>
        <p style={{
          fontSize: 'var(--font-size-lg)',
          color: 'var(--color-text-secondary)',
        }}>
          Connect with fellow travelers and experience creators
        </p>
      </div>

      <Row>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Col md={6} lg={3} key={i} style={{ marginBottom: 'var(--space-6)' }}>
            <Card style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              transition: 'var(--transition-normal)',
              cursor: 'pointer',
              height: '100%',
            }}>
              <img 
                src={`https://i.pravatar.cc/150?img=${i + 10}`}
                alt="User"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: 'var(--radius-full)',
                  margin: '0 auto var(--space-4)',
                  border: '3px solid var(--color-border-medium)',
                }}
              />
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                User Name {i}
              </h3>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-4)',
              }}>
                <FaMapMarkerAlt /> City, Country
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) 0',
                borderTop: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
              }}>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                    {12 + i}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Plans
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                    {23 + i * 2}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Experiences
                  </div>
                </div>
              </div>
              <Button variant="primary" size="sm" style={{
                borderRadius: 'var(--radius-full)',
                width: '100%',
                fontWeight: 'var(--font-weight-medium)',
              }}>
                View Profile
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  </div>
);

// Application Home Pattern
export const ApplicationHome = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
  }}>
    {/* Hero */}
    <div style={{
      background: 'var(--gradient-primary)',
      color: 'white',
      padding: 'var(--space-16) var(--space-8)',
      textAlign: 'center',
    }}>
      <Container>
        <h1 style={{
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-extrabold)',
          marginBottom: 'var(--space-4)',
        }}>
          Welcome to Biensperience
        </h1>
        <p style={{
          fontSize: 'var(--font-size-xl)',
          opacity: 0.95,
          maxWidth: '700px',
          margin: '0 auto',
        }}>
          Your journey to unforgettable experiences starts here
        </p>
      </Container>
    </div>

    <Container style={{ marginTop: '-60px', paddingBottom: 'var(--space-12)' }}>
      {/* Quick Stats Cards */}
      <Row style={{ marginBottom: 'var(--space-12)' }}>
        {[
          { label: 'Destinations', value: '247', icon: <FaMapMarkerAlt /> },
          { label: 'Experiences', value: '1,234', icon: <FaPlane /> },
          { label: 'Community', value: '12,456', icon: <FaUser /> },
          { label: 'Photos', value: '45,678', icon: <FaCamera /> },
        ].map((stat, i) => (
          <Col md={6} lg={3} key={i}>
            <Card style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              boxShadow: 'var(--shadow-md)',
              height: '100%',
            }}>
              <div style={{
                fontSize: 'var(--font-size-3xl)',
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                {stat.icon}
              </div>
              <div style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-muted)',
              }}>
                {stat.label}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Featured Content */}
      <div style={{ marginBottom: 'var(--space-12)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-6)',
        }}>
          Featured Destinations
        </h2>
        <Row>
          {[1, 2, 3, 4].map(i => (
            <Col md={6} lg={3} key={i}>
              <Card style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
                height: '100%',
              }}>
                <div style={{ height: '200px', overflow: 'hidden' }}>
                  <img 
                    src={getPlaceholderImage(i, 400)}
                    alt={`Destination ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <Card.Body>
                  <h4 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                  }}>
                    City Name {i}
                  </h4>
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                  }}>
                    {23 + i * 5} experiences
                  </p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* CTA Section */}
      <Card style={{
        background: 'var(--gradient-primary)',
        color: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-12)',
        textAlign: 'center',
        border: 'none',
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-4)',
        }}>
          Ready to Start Your Journey?
        </h2>
        <p style={{
          fontSize: 'var(--font-size-lg)',
          marginBottom: 'var(--space-8)',
          opacity: 0.95,
        }}>
          Join thousands of travelers creating and sharing amazing experiences
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button size="lg" variant="light" style={{
            padding: 'var(--space-4) var(--space-8)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Create Account
          </Button>
          <Button size="lg" variant="outline-light" style={{
            padding: 'var(--space-4) var(--space-8)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Browse Experiences
          </Button>
        </div>
      </Card>
    </Container>
  </div>
);
