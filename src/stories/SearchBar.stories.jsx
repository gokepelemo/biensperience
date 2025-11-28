import { Container, Row, Col, Card } from 'react-bootstrap';
import SearchBar from '../components/SearchBar/SearchBar';

export default {
  title: 'Components/Forms/Search Bar',
  component: SearchBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Global search component using the unified Autocomplete component. Searches across destinations, experiences, users, and plans with real-time results.',
      },
    },
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Search input placeholder text',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
  },
};

// Default story
export const Default = {
  args: {
    placeholder: 'Search destinations, experiences, users...',
    size: 'md',
  },
  render: (args) => (
    <Container>
      <Row>
        <Col md={8} className="mx-auto">
          <Card style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
              Global Search
            </h3>
            <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
              Search across all destinations, experiences, and users. Type at least 2 characters to see results.
            </p>
            <SearchBar {...args} />
          </Card>
        </Col>
      </Row>
    </Container>
  ),
};

// Small size
export const SmallSize = {
  args: {
    placeholder: 'Quick search...',
    size: 'sm',
  },
  render: (args) => (
    <Container>
      <Row>
        <Col md={6} className="mx-auto">
          <Card style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <SearchBar {...args} />
          </Card>
        </Col>
      </Row>
    </Container>
  ),
};

// Large size
export const LargeSize = {
  args: {
    placeholder: 'Search destinations, experiences, users...',
    size: 'lg',
  },
  render: (args) => (
    <Container>
      <Row>
        <Col md={10} className="mx-auto">
          <Card style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <SearchBar {...args} />
          </Card>
        </Col>
      </Row>
    </Container>
  ),
};

// In navigation bar context
export const InNavbar = {
  args: {
    placeholder: 'Search...',
    size: 'md',
  },
  render: (args) => (
    <div style={{
      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: 'var(--font-size-xl)' }}>
          Biensperience
        </div>
        <div style={{ flex: 1, maxWidth: '500px' }}>
          <SearchBar {...args} className="navbar-search" />
        </div>
        <div style={{ color: 'white' }}>
          Menu
        </div>
      </div>
    </div>
  ),
};

// Usage notes
export const UsageNotes = {
  render: () => (
    <Container>
      <Row>
        <Col md={10} className="mx-auto">
          <Card style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
              SearchBar Component Usage
            </h3>
            
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Features</h4>
              <ul style={{ color: 'var(--color-text-secondary)' }}>
                <li>Global search across destinations, experiences, users, and plans</li>
                <li>Real-time search with 300ms debouncing</li>
                <li>Keyboard navigation (Arrow Up/Down, Enter, Escape)</li>
                <li>Loading states with spinner</li>
                <li>Empty state messages</li>
                <li>Automatic navigation on result selection</li>
              </ul>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Props</h4>
              <ul style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.9em' }}>
                <li><strong>placeholder</strong>: string - Input placeholder text</li>
                <li><strong>className</strong>: string - Additional CSS classes</li>
                <li><strong>size</strong>: 'sm' | 'md' | 'lg' - Size variant (default: 'md')</li>
              </ul>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Search Behavior</h4>
              <ul style={{ color: 'var(--color-text-secondary)' }}>
                <li>Minimum 2 characters required to trigger search</li>
                <li>300ms debounce delay to reduce API calls</li>
                <li>Automatically transforms results to match entity display formats</li>
                <li>Supports mixed result types (destinations, experiences, users, plans)</li>
              </ul>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Navigation</h4>
              <ul style={{ color: 'var(--color-text-secondary)' }}>
                <li>Destinations → /destinations/:id</li>
                <li>Experiences → /experiences/:id</li>
                <li>Users → /profile/:id</li>
                <li>Plans → /experiences/:experienceId</li>
              </ul>
            </div>

            <div>
              <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Example Usage</h4>
              <pre style={{
                backgroundColor: 'var(--color-bg-secondary)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                overflow: 'auto',
                fontSize: '0.85em',
              }}>
{`import SearchBar from '../components/SearchBar/SearchBar';

function MyComponent() {
  return (
    <SearchBar
      placeholder="Search destinations, experiences, users..."
      size="md"
      className="my-search"
    />
  );
}`}
              </pre>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  ),
};
