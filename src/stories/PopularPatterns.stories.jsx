import React from 'react';
import { Container, Row, Col, Card, Button, Badge, Form, InputGroup } from 'react-bootstrap';
import { FaSearch, FaFilter, FaStar, FaHeart, FaMapMarkerAlt, FaClock, FaDollarSign, FaUser, FaCalendar, FaTh, FaList, FaChevronRight } from 'react-icons/fa';

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
  title: 'Design System/Popular Patterns',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Popular layout patterns from modern web applications including search, filtering, cards, and more. All patterns use design tokens and support dark mode.',
      },
    },
  },
};

// Search & Filter Layout
export const SearchAndFilter = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-3)',
        }}>
          Discover Experiences
        </h1>
        <p style={{
          fontSize: 'var(--font-size-lg)',
          color: 'var(--color-text-secondary)',
        }}>
          Browse 1,234 curated travel experiences
        </p>
      </div>

      {/* Search Bar */}
      <Card style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <Row className="g-3">
          <Col lg={6}>
            <InputGroup>
              <InputGroup.Text style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-medium)',
                borderRight: 'none',
              }}>
                <FaSearch style={{ color: 'var(--color-text-muted)' }} />
              </InputGroup.Text>
              <Form.Control
                placeholder="Search experiences..."
                style={{
                  border: '1px solid var(--color-border-medium)',
                  borderLeft: 'none',
                  fontSize: 'var(--font-size-base)',
                }}
              />
            </InputGroup>
          </Col>
          <Col lg={3}>
            <Form.Select style={{
              border: '1px solid var(--color-border-medium)',
              borderRadius: 'var(--radius-md)',
            }}>
              <option>All Destinations</option>
              <option>Tokyo, Japan</option>
              <option>Paris, France</option>
              <option>New York, USA</option>
            </Form.Select>
          </Col>
          <Col lg={3}>
            <Button variant="primary" style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-semibold)',
            }}>
              <FaSearch /> Search
            </Button>
          </Col>
        </Row>
      </Card>

      <Row>
        {/* Filters Sidebar */}
        <Col lg={3}>
          <Card style={{
            backgroundColor: 'var(--color-bg-primary)',
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
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <FaFilter /> Filters
            </h3>

            {/* Price Range */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Price Range
              </h4>
              <Form.Check 
                type="checkbox"
                label="Free"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="$ - Under $50"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="$$ - $50 - $100"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="$$$ - Over $100"
              />
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Duration
              </h4>
              <Form.Check 
                type="checkbox"
                label="< 2 hours"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="2-4 hours"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="Half day"
                style={{ marginBottom: 'var(--space-2)' }}
              />
              <Form.Check 
                type="checkbox"
                label="Full day"
              />
            </div>

            {/* Categories */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Categories
              </h4>
              {['Nature', 'Culture', 'Food & Drink', 'Adventure', 'Relaxation'].map(cat => (
                <Form.Check 
                  key={cat}
                  type="checkbox"
                  label={cat}
                  style={{ marginBottom: 'var(--space-2)' }}
                />
              ))}
            </div>

            <Button variant="outline-secondary" style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
            }}>
              Clear All Filters
            </Button>
          </Card>
        </Col>

        {/* Results */}
        <Col lg={9}>
          {/* Results Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-6)',
          }}>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}>
              Showing 1-12 of 1,234 results
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <Form.Select style={{
                width: 'auto',
                border: '1px solid var(--color-border-medium)',
                borderRadius: 'var(--radius-md)',
              }}>
                <option>Sort: Popular</option>
                <option>Sort: Newest</option>
                <option>Sort: Price Low-High</option>
                <option>Sort: Price High-Low</option>
              </Form.Select>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="outline-secondary" size="sm" style={{ padding: 'var(--space-2)' }}>
                  <FaTh />
                </Button>
                <Button variant="primary" size="sm" style={{ padding: 'var(--space-2)' }}>
                  <FaList />
                </Button>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <Row>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Col md={6} key={i} style={{ marginBottom: 'var(--space-6)' }}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  transition: 'var(--transition-normal)',
                  cursor: 'pointer',
                  height: '100%',
                }}>
                  <div style={{ height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <img 
                      src={getPlaceholderImage(i - 1, 500)}
                      alt={`Experience ${i}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Button
                      variant="light"
                      size="sm"
                      style={{
                        position: 'absolute',
                        top: 'var(--space-3)',
                        right: 'var(--space-3)',
                        borderRadius: 'var(--radius-full)',
                        padding: 'var(--space-2)',
                        width: '36px',
                        height: '36px',
                      }}
                    >
                      <FaHeart />
                    </Button>
                  </div>
                  <Card.Body>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Badge bg="secondary" style={{
                        padding: 'var(--space-1) var(--space-2)',
                        fontSize: 'var(--font-size-xs)',
                      }}>
                        Culture
                      </Badge>
                      <Badge bg="secondary" style={{
                        padding: 'var(--space-1) var(--space-2)',
                        fontSize: 'var(--font-size-xs)',
                      }}>
                        Nature
                      </Badge>
                    </div>
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
                      marginBottom: 'var(--space-3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}>
                      <FaMapMarkerAlt /> Tokyo, Japan
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
                        color: 'var(--color-text-muted)',
                      }}>
                        <FaStar style={{ color: 'var(--color-warning)' }} />
                        <span>4.{8 + i}</span>
                        <span>(23{i} reviews)</span>
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-primary)',
                      }}>
                        ${30 + i * 10}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Pagination */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-8)',
          }}>
            {[1, 2, 3, 4, 5].map(page => (
              <Button
                key={page}
                variant={page === 1 ? 'primary' : 'outline-secondary'}
                style={{
                  width: '40px',
                  height: '40px',
                  padding: 0,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {page}
              </Button>
            ))}
          </div>
        </Col>
      </Row>
    </Container>
  </div>
);

// Dashboard Layout
export const DashboardLayout = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container fluid>
      <Row>
        {/* Sidebar */}
        <Col lg={2} style={{
          backgroundColor: 'var(--color-bg-secondary)',
          minHeight: '100vh',
          padding: 'var(--space-6)',
          borderRight: '1px solid var(--color-border-light)',
        }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-8)',
          }}>
            Dashboard
          </h2>
          <nav>
            {[
              { label: 'Overview', active: true },
              { label: 'My Experiences' },
              { label: 'My Plans' },
              { label: 'Favorites' },
              { label: 'Settings' },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: item.active ? 'var(--color-primary)' : 'transparent',
                  color: item.active ? 'white' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontWeight: item.active ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                }}
              >
                {item.label}
              </div>
            ))}
          </nav>
        </Col>

        {/* Main Content */}
        <Col lg={10} style={{ padding: 'var(--space-8)' }}>
          {/* Welcome Header */}
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Welcome back, Sarah! 👋
            </h1>
            <p style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
            }}>
              Here's what's happening with your travel plans
            </p>
          </div>

          {/* Stats Cards */}
          <Row style={{ marginBottom: 'var(--space-8)' }}>
            {[
              { label: 'Active Plans', value: '8', color: 'var(--color-primary)', icon: <FaCalendar /> },
              { label: 'Experiences', value: '23', color: 'var(--color-success)', icon: <FaStar /> },
              { label: 'Destinations', value: '15', color: 'var(--color-warning)', icon: <FaMapMarkerAlt /> },
              { label: 'Total Spent', value: '$1,234', color: 'var(--color-info)', icon: <FaDollarSign /> },
            ].map(stat => (
              <Col md={6} lg={3} key={stat.label} style={{ marginBottom: 'var(--space-4)' }}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                  height: '100%',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <div>
                      <div style={{
                        fontSize: 'var(--font-size-3xl)',
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
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: `${stat.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--font-size-xl)',
                      color: stat.color,
                    }}>
                      {stat.icon}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row>
            {/* Recent Activity */}
            <Col lg={8} style={{ marginBottom: 'var(--space-6)' }}>
              <Card style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}>
                <h3 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-6)',
                }}>
                  Recent Activity
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {[
                    { action: 'Created new plan', item: 'Cherry Blossom Tour', time: '2 hours ago' },
                    { action: 'Favorited', item: 'Tokyo Street Food Experience', time: '5 hours ago' },
                    { action: 'Completed', item: 'Sushi Making Class', time: '1 day ago' },
                    { action: 'Added destination', item: 'Kyoto, Japan', time: '2 days ago' },
                  ].map((activity, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div style={{
                          fontSize: 'var(--font-size-base)',
                          color: 'var(--color-text-primary)',
                          marginBottom: 'var(--space-1)',
                        }}>
                          {activity.action} <strong>{activity.item}</strong>
                        </div>
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-muted)',
                        }}>
                          <FaClock style={{ marginRight: 'var(--space-1)' }} />
                          {activity.time}
                        </div>
                      </div>
                      <Button variant="outline-secondary" size="sm" style={{
                        borderRadius: 'var(--radius-md)',
                      }}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>

            {/* Quick Actions */}
            <Col lg={4}>
              <Card style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
              }}>
                <h3 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-6)',
                }}>
                  Quick Actions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <Button variant="primary" style={{
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}>
                    Create New Experience
                  </Button>
                  <Button variant="outline-secondary" style={{
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}>
                    Add Destination
                  </Button>
                  <Button variant="outline-secondary" style={{
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}>
                    Browse Experiences
                  </Button>
                </div>
              </Card>

              {/* Upcoming Plans */}
              <Card style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                marginTop: 'var(--space-6)',
              }}>
                <h3 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-6)',
                }}>
                  Upcoming Plans
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {[
                    { title: 'Cherry Blossom Tour', date: 'Apr 15, 2025' },
                    { title: 'Temple Visit', date: 'Apr 18, 2025' },
                    { title: 'Food Market Tour', date: 'Apr 20, 2025' },
                  ].map((plan, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--space-1)',
                      }}>
                        {plan.title}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-muted)',
                      }}>
                        <FaCalendar style={{ marginRight: 'var(--space-1)' }} />
                        {plan.date}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  </div>
);

// Card Variations
export const CardVariations = () => (
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
        marginBottom: 'var(--space-8)',
      }}>
        Card Variations
      </h1>

      {/* Horizontal Card */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          Horizontal Card
        </h2>
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <Row className="g-0">
            <Col md={4}>
              <img 
                src={getPlaceholderImage(1, 400)}
                alt="Cherry Blossom Experience"
                style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '250px' }}
              />
            </Col>
            <Col md={8}>
              <Card.Body style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <Badge bg="secondary">Culture</Badge>
                  <Badge bg="secondary">Nature</Badge>
                </div>
                <h3 style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-3)',
                }}>
                  Cherry Blossom Viewing in Ueno Park
                </h3>
                <p style={{
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 'var(--line-height-relaxed)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Join locals for hanami (flower viewing) under the stunning cherry blossoms in one of Tokyo's most beloved parks.
                </p>
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-6)',
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-muted)',
                }}>
                  <span><FaMapMarkerAlt /> Tokyo, Japan</span>
                  <span><FaClock /> 3-4 hours</span>
                  <span><FaDollarSign /> $50</span>
                </div>
                <Button variant="primary" style={{
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-6)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}>
                  View Details <FaChevronRight />
                </Button>
              </Card.Body>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Compact Card */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          Compact Cards
        </h2>
        <Row>
          {[1, 2, 3, 4].map(i => (
            <Col sm={6} lg={3} key={i} style={{ marginBottom: 'var(--space-4)' }}>
              <Card style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
                height: '100%',
              }}>
                <div style={{ height: '120px', overflow: 'hidden' }}>
                  <img 
                    src={getPlaceholderImage(i + 1, 300)}
                    alt={`Compact ${i}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <Card.Body style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Compact Item {i}
                  </h4>
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                    margin: 0,
                  }}>
                    Brief description
                  </p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Featured Card */}
      <div>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          Featured Card
        </h2>
        <Card style={{
          background: 'var(--gradient-primary)',
          border: 'none',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          color: 'white',
        }}>
          <Row className="g-0 align-items-center">
            <Col md={6} style={{ padding: 'var(--space-8)' }}>
              <Badge bg="light" text="dark" style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
              }}>
                ⭐ Featured Experience
              </Badge>
              <h2 style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--space-4)',
              }}>
                Explore Tokyo Like a Local
              </h2>
              <p style={{
                fontSize: 'var(--font-size-lg)',
                opacity: 0.95,
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-6)',
              }}>
                Discover hidden gems and authentic experiences with our curated Tokyo adventure guide.
              </p>
              <Button variant="light" size="lg" style={{
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4) var(--space-8)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Learn More
              </Button>
            </Col>
            <Col md={6}>
              <img 
                src={getPlaceholderImage(0, 800)}
                alt="Featured Tokyo Experience"
                style={{ width: '100%', height: '400px', objectFit: 'cover' }}
              />
            </Col>
          </Row>
        </Card>
      </div>
    </Container>
  </div>
);

// Empty State
export const EmptyState = () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    minHeight: '100vh',
    padding: 'var(--space-8) 0',
  }}>
    <Container>
      <Row>
        <Col lg={{ span: 6, offset: 3 }}>
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-6)',
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              fontSize: 'var(--font-size-4xl)',
            }}>
              📭
            </div>
            <h2 style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              No Plans Yet
            </h2>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-6)',
              maxWidth: '500px',
              margin: '0 auto var(--space-6)',
            }}>
              Start planning your next adventure! Browse our curated experiences or create your own custom plan.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" style={{
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4) var(--space-8)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Browse Experiences
              </Button>
              <Button variant="outline-secondary" size="lg" style={{
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4) var(--space-8)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Create Custom Plan
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  </div>
);
