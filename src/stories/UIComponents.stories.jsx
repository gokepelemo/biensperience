import { useState } from 'react';
import Stepper from '../components/Stepper/Stepper';
import Pagination from '../components/Pagination/Pagination';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import Tooltip from '../components/Tooltip/Tooltip';
import { Button } from 'react-bootstrap';

export default {
  title: 'Components/UI Components',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Reusable UI components for travel planning and user interactions. Includes Stepper for multi-step processes, Pagination for content navigation, ProgressBar for tracking completion, and Tooltip for contextual help. All components are fully responsive, accessible, and follow the design system tokens.',
      },
    },
  },
  tags: ['autodocs'],
};

// Stepper Stories
export const StepperVariations = {
  render: () => {
    const travelSteps = [
      { 
        title: 'Book Flight', 
        description: 'Tokyo to Kyoto', 
        status: 'completed' 
      },
      { 
        title: 'Reserve Hotel', 
        description: 'Ryokan in Gion District', 
        status: 'completed' 
      },
      { 
        title: 'Plan Itinerary', 
        description: 'Day trips and experiences', 
        status: 'active' 
      },
      { 
        title: 'Pack Bags', 
        description: 'Travel essentials', 
        status: 'pending' 
      },
    ];

    const adventureSteps = [
      { 
        title: 'Research Destination', 
        description: 'Bali adventure spots', 
        status: 'completed' 
      },
      { 
        title: 'Book Activities', 
        description: 'Surfing and diving', 
        status: 'error' 
      },
      { 
        title: 'Arrange Transport', 
        description: 'Scooter rental', 
        status: 'pending' 
      },
      { 
        title: 'Travel Insurance', 
        description: 'Coverage for activities', 
        status: 'pending' 
      },
    ];

    return (
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
        <h3 style={{ 
          marginBottom: 'var(--space-6)', 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Travel Planning Stepper
        </h3>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Gabriel Planner's Japan Trip
          </h4>
          <Stepper steps={travelSteps} color="primary" />
        </div>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Flora Adrenaline-Junkie's Bali Adventure (with error)
          </h4>
          <Stepper steps={adventureSteps} color="danger" />
        </div>

        <div>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Kelly Traveler's European Tour (Success)
          </h4>
          <Stepper 
            steps={[
              { title: 'Paris', description: 'Eiffel Tower visit', status: 'completed' },
              { title: 'Amsterdam', description: 'Canal cruise', status: 'completed' },
              { title: 'Berlin', description: 'Historical sites', status: 'completed' },
              { title: 'Prague', description: 'Old Town Square', status: 'completed' },
            ]} 
            color="success" 
          />
        </div>
      </div>
    );
  },
};

export const CompactStepper = {
  render: () => {
    const steps = [
      { title: 'Destination Research', status: 'completed' },
      { title: 'Budget Planning', status: 'completed' },
      { title: 'Booking Flights', status: 'active' },
      { title: 'Travel Insurance', status: 'pending' },
      { title: 'Pack & Prepare', status: 'pending' },
    ];

    return (
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
        <h3 style={{ 
          marginBottom: 'var(--space-6)', 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Compact Travel Checklist
        </h3>

        <Stepper steps={steps} variant="compact" color="primary" />
      </div>
    );
  },
};

// Pagination Stories
export const PaginationVariations = {
  render: () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [dotsPage, setDotsPage] = useState(1);

    return (
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
        <h3 style={{ 
          marginBottom: 'var(--space-6)', 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Destination Browser Pagination
        </h3>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Text Pagination - Browsing 1,000 destinations
          </h4>
          <Pagination 
            currentPage={currentPage}
            totalPages={99}
            onPageChange={setCurrentPage}
            variant="text"
            totalResults={1000}
            resultsPerPage={100}
          />
        </div>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Dots Pagination - Photo Gallery
          </h4>
          <Pagination 
            currentPage={dotsPage}
            totalPages={7}
            onPageChange={setDotsPage}
            variant="dots"
          />
          <div style={{ 
            textAlign: 'center', 
            marginTop: 'var(--space-4)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)'
          }}>
            Viewing Rachel Pleasure-Seeker's Santorini photos ({dotsPage} of 7)
          </div>
        </div>

        <div>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Simple Navigation - Jane Organizer's Travel Blog
          </h4>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-lg)'
          }}>
            <button style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-medium)',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}>
              Page 1 of 10
            </button>
          </div>
        </div>
      </div>
    );
  },
};

// Progress Bar Stories
export const ProgressBarVariations = {
  render: () => {
    return (
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-primary)' }}>
        <h3 style={{ 
          marginBottom: 'var(--space-6)', 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Trip Planning Progress
        </h3>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 'var(--space-6)',
          maxWidth: '600px'
        }}>
          <div>
            <div style={{ 
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)'
            }}>
              Gabriel Planner's Tokyo Trip
            </div>
            <ProgressBar value={80} color="primary" showPercentage />
          </div>

          <div>
            <div style={{ 
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)'
            }}>
              Kelly Traveler's Budget Tracking
            </div>
            <ProgressBar value={40} color="warning" showPercentage />
          </div>

          <div>
            <div style={{ 
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)'
            }}>
              Jane Organizer's Itinerary Complete
            </div>
            <ProgressBar value={100} color="success" showPercentage />
          </div>

          <div>
            <div style={{ 
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)'
            }}>
              Rachel Pleasure-Seeker's Spa Bookings
            </div>
            <ProgressBar value={20} color="danger" showPercentage />
          </div>

          <div>
            <div style={{ 
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)'
            }}>
              Flora Adrenaline-Junkie's Adventure Gear
            </div>
            <ProgressBar value={60} color="primary" showPercentage animated />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-8)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Size Variations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ 
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)'
              }}>
                Small - Quick glance
              </div>
              <ProgressBar value={75} color="primary" size="sm" />
            </div>

            <div>
              <div style={{ 
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)'
              }}>
                Medium - Standard view
              </div>
              <ProgressBar value={75} color="primary" size="md" />
            </div>

            <div>
              <div style={{ 
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-muted)'
              }}>
                Large - Prominent display
              </div>
              <ProgressBar value={75} color="primary" size="lg" />
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Tooltip Stories
export const TooltipVariations = {
  render: () => {
    return (
      <div style={{ padding: 'var(--space-8)', background: 'var(--color-bg-primary)' }}>
        <h3 style={{ 
          marginBottom: 'var(--space-6)', 
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)'
        }}>
          Travel Tips & Information Tooltips
        </h3>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-8)',
          marginTop: 'var(--space-8)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Tooltip content="Best time to visit: March-May for cherry blossoms" position="top" variant="dark">
              <Button variant="primary">Tokyo, Japan</Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip content="Budget: $50-80/day including accommodations" position="right" variant="primary">
              <Button variant="outline-primary">Bali, Indonesia</Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip content="Visa required for stays over 90 days" position="bottom" variant="warning">
              <Button variant="warning">Paris, France</Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip content="Peak season: June-August (book early!)" position="left" variant="danger">
              <Button variant="danger">Santorini, Greece</Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip content="English widely spoken in tourist areas" position="top" variant="success">
              <Button variant="success">Amsterdam, Netherlands</Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip content="Currency: USD recommended, cards accepted everywhere" position="bottom" variant="light">
              <Button variant="light">New York, USA</Button>
            </Tooltip>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-12)' }}>
          <h4 style={{ 
            marginBottom: 'var(--space-4)', 
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-lg)'
          }}>
            Traveler Tips from Marcus Explorer
          </h4>
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 'var(--space-6)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-lg)'
          }}>
            <Tooltip content="Pack light! Most destinations have laundry services" position="top">
              <span style={{ 
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-primary-subtle)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}>
                🎒 Packing
              </span>
            </Tooltip>

            <Tooltip content="Download offline maps before your trip" position="top">
              <span style={{ 
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-success-subtle)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}>
                🗺️ Navigation
              </span>
            </Tooltip>

            <Tooltip content="Learn basic phrases in the local language" position="top">
              <span style={{ 
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-warning-subtle)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}>
                💬 Communication
              </span>
            </Tooltip>

            <Tooltip content="Always have travel insurance for emergencies" position="top">
              <span style={{ 
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-danger-subtle)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}>
                🏥 Insurance
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  },
};

// Combined Interactive Demo
export const TravelPlanningDashboard = {
  render: () => {
    const [tripProgress, setTripProgress] = useState(65);
    const [currentPage, setCurrentPage] = useState(1);

    const steps = [
      { title: 'Choose Destination', description: 'Santorini selected', status: 'completed' },
      { title: 'Book Flights', description: 'Round trip confirmed', status: 'completed' },
      { title: 'Reserve Hotel', description: 'Cave hotel in Oia', status: 'active' },
      { title: 'Plan Activities', description: 'Boat tours & sunset viewing', status: 'pending' },
    ];

    return (
      <div style={{ 
        padding: 'var(--space-8)', 
        background: 'var(--color-bg-secondary)',
        minHeight: '100vh'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h2 style={{ 
            marginBottom: 'var(--space-2)', 
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)'
          }}>
            Marcus Explorer's Greece Adventure
          </h2>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-base)',
            marginBottom: 'var(--space-8)'
          }}>
            Planning the perfect Mediterranean escape
          </p>

          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-xl)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ 
              marginBottom: 'var(--space-4)', 
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}>
              Trip Planning Progress
            </h3>
            <ProgressBar value={tripProgress} color="primary" showPercentage animated />

            <div style={{ marginTop: 'var(--space-6)' }}>
              <Stepper steps={steps} color="primary" />
            </div>
          </div>

          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-xl)',
            padding: 'var(--space-6)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ 
              marginBottom: 'var(--space-4)', 
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}>
              Browse Greek Islands
            </h3>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-6)'
            }}>
              {['Santorini', 'Mykonos', 'Crete', 'Rhodes'].map((island) => (
                <Tooltip key={island} content={`Click to view ${island} experiences`} position="top">
                  <div style={{
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-lg)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-standard)'
                  }}>
                    <h4 style={{ 
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-2)'
                    }}>
                      {island}
                    </h4>
                    <ProgressBar value={Math.random() * 100} color="success" size="sm" />
                  </div>
                </Tooltip>
              ))}
            </div>

            <Pagination 
              currentPage={currentPage}
              totalPages={10}
              onPageChange={setCurrentPage}
              variant="text"
              totalResults={250}
              resultsPerPage={25}
            />
          </div>
        </div>
      </div>
    );
  },
};
