import React, { useState } from 'react';
import { Container, Row, Col, Card } from '../components/design-system';
import Autocomplete from '../components/Autocomplete/Autocomplete';

export default {
  title: 'Components/Forms/Autocomplete',
  component: Autocomplete,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Unified autocomplete component supporting multiple entity types: users, destinations, experiences, countries, and categories. Features keyboard navigation, loading states, and full accessibility support.',
      },
    },
  },
  argTypes: {
    entityType: {
      control: 'select',
      options: ['user', 'destination', 'experience', 'country', 'category'],
      description: 'Type of entity to display',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    showAvatar: {
      control: 'boolean',
      description: 'Show avatar for user type',
    },
    showStatus: {
      control: 'boolean',
      description: 'Show online status for user type',
    },
    showMeta: {
      control: 'boolean',
      description: 'Show metadata (badges, locations, etc.)',
    },
  },
};

// Sample data
const sampleUsers = [
  { id: 1, name: 'Alice Smith', username: 'alicesmith', email: 'alice@example.com', avatar: 'https://i.pravatar.cc/150?img=1', isOnline: true },
  { id: 2, name: 'Bob Johnson', username: 'bobjohnson', email: 'bob@example.com', avatar: 'https://i.pravatar.cc/150?img=2', isOnline: true },
  { id: 3, name: 'Clara Garcia', username: 'claragarcia', email: 'clara@example.com', avatar: 'https://i.pravatar.cc/150?img=3', isOnline: false },
  { id: 4, name: 'David Brown', username: 'davidbrown', email: 'david@example.com', avatar: 'https://i.pravatar.cc/150?img=4', isOnline: true },
  { id: 5, name: 'Emma Lee', username: 'emmalee', email: 'emma@example.com', avatar: 'https://i.pravatar.cc/150?img=5', isOnline: false },
  { id: 6, name: 'Frank Wong', username: 'frankwong', email: 'frank@example.com', avatar: 'https://i.pravatar.cc/150?img=6', isOnline: true, role: 'super_admin' },
  { id: 7, name: 'Grace Taylor', username: 'gracetaylor', email: 'grace@example.com', avatar: 'https://i.pravatar.cc/150?img=7', isOnline: true },
  { id: 8, name: 'Henry Martinez', username: 'henrymartinez', email: 'henry@example.com', avatar: 'https://i.pravatar.cc/150?img=8', isOnline: false },
  { id: 9, name: 'Isabella Clark', username: 'isabellaclark', email: 'isabella@example.com', avatar: 'https://i.pravatar.cc/150?img=9', isOnline: true },
  { id: 10, name: 'Jack Nguyen', username: 'jacknguyen', email: 'jack@example.com', avatar: 'https://i.pravatar.cc/150?img=10', isOnline: false },
];

const sampleDestinations = [
  { id: 1, name: 'Tokyo', country: 'Japan', flag: '🇯🇵', experienceCount: 234 },
  { id: 2, name: 'Paris', country: 'France', flag: '🇫🇷', experienceCount: 189 },
  { id: 3, name: 'New York', country: 'United States', flag: '🇺🇸', experienceCount: 312 },
  { id: 4, name: 'London', country: 'United Kingdom', flag: '🇬🇧', experienceCount: 245 },
  { id: 5, name: 'Sydney', country: 'Australia', flag: '🇦🇺', experienceCount: 156 },
  { id: 6, name: 'Barcelona', country: 'Spain', flag: '🇪🇸', experienceCount: 178 },
  { id: 7, name: 'Dubai', country: 'United Arab Emirates', flag: '🇦🇪', experienceCount: 134 },
  { id: 8, name: 'Rome', country: 'Italy', flag: '🇮🇹', experienceCount: 201 },
];

const sampleExperiences = [
  { id: 1, name: 'Cherry Blossom Viewing', destination: 'Tokyo, Japan', rating: 4.8, category: 'Nature' },
  { id: 2, name: 'Eiffel Tower at Sunset', destination: 'Paris, France', rating: 4.9, category: 'Culture' },
  { id: 3, name: 'Broadway Show', destination: 'New York, USA', rating: 4.7, category: 'Entertainment' },
  { id: 4, name: 'British Museum Tour', destination: 'London, UK', rating: 4.6, category: 'Culture' },
  { id: 5, name: 'Bondi Beach Surfing', destination: 'Sydney, Australia', rating: 4.8, category: 'Adventure' },
  { id: 6, name: 'Sagrada Familia Visit', destination: 'Barcelona, Spain', rating: 4.9, category: 'Architecture' },
];

const sampleCountries = [
  { id: 1, name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { id: 2, name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { id: 3, name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { id: 4, name: 'China', code: 'CN', flag: '🇨🇳' },
  { id: 5, name: 'France', code: 'FR', flag: '🇫🇷' },
  { id: 6, name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { id: 7, name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { id: 8, name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { id: 9, name: 'United Kingdom', code: 'UK', flag: '🇬🇧' },
  { id: 10, name: 'United States', code: 'US', flag: '🇺🇸' },
];

const sampleCategories = [
  { id: 1, name: 'Apparel', icon: '👔' },
  { id: 2, name: 'Accessories', icon: '👜' },
  { id: 3, name: 'Art', icon: '🎨' },
  { id: 4, name: 'Beauty', icon: '💄' },
  { id: 5, name: 'Books', icon: '📚' },
  { id: 6, name: 'Computers', icon: '💻' },
  { id: 7, name: 'Electronics', icon: '📱' },
  { id: 8, name: 'Furniture', icon: '🛋️' },
  { id: 9, name: 'Jewelry', icon: '💍' },
  { id: 10, name: 'Kitchenware', icon: '🍳' },
];

// Interactive Playground
export const Playground = {
  args: {
    placeholder: 'Search users...',
    entityType: 'user',
    showAvatar: true,
    showStatus: true,
    showMeta: true,
    size: 'md',
    loading: false,
    emptyMessage: 'No results found',
  },
  render: (args) => <AutocompletePlayground {...args} />,
};

function AutocompletePlayground(args) {
  const [selectedItem, setSelectedItem] = useState(null);

  const getItems = () => {
    switch (args.entityType) {
      case 'user': return sampleUsers;
      case 'destination': return sampleDestinations;
      case 'experience': return sampleExperiences;
      case 'country': return sampleCountries;
      case 'category': return sampleCategories;
      default: return sampleUsers;
    }
  };

  return (
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
              Search {args.entityType}s
            </h3>
            <Autocomplete
              {...args}
              items={getItems()}
              onSelect={setSelectedItem}
            />
            {selectedItem && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <strong>Selected:</strong> {selectedItem.name}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// User Search (Manage Collaborators)
export const UserSearch = {
  name: 'User Search',
  render: () => <UserSearchDemo />,
};

function UserSearchDemo() {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <Container>
      <Row>
        <Col md={8} className="mx-auto">
          <Card style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <h3 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
              Manage Collaborators
            </h3>
            <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
              Search and add users to collaborate on this experience
            </p>
            <Autocomplete
              placeholder="Search users by name or email..."
              entityType="user"
              items={sampleUsers}
              onSelect={setSelectedUser}
              showAvatar={true}
              showStatus={true}
              showMeta={true}
            />
            {selectedUser && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-success-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-success)',
              }}>
                ✓ {selectedUser.name} (@{selectedUser.username}) added as collaborator
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// Destination Search
export const DestinationSearch = {
  name: 'Destination Search',
  render: () => <DestinationSearchDemo />,
};

function DestinationSearchDemo() {
  const [selectedDestination, setSelectedDestination] = useState(null);

  return (
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
              Select Destination
            </h3>
            <Autocomplete
              placeholder="Search destinations..."
              entityType="destination"
              items={sampleDestinations}
              onSelect={setSelectedDestination}
              showMeta={true}
            />
            {selectedDestination && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <strong>Selected:</strong> {selectedDestination.name}, {selectedDestination.country}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// Experience Search
export const ExperienceSearch = {
  name: 'Experience Search',
  render: () => <ExperienceSearchDemo />,
};

function ExperienceSearchDemo() {
  const [selectedExperience, setSelectedExperience] = useState(null);

  return (
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
              Search Experiences
            </h3>
            <Autocomplete
              placeholder="Search experiences..."
              entityType="experience"
              items={sampleExperiences}
              onSelect={setSelectedExperience}
              showMeta={true}
            />
            {selectedExperience && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <strong>Selected:</strong> {selectedExperience.name} - {selectedExperience.destination}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// Country Selector
export const CountrySelector = {
  name: 'Country Selector',
  render: () => <CountrySelectorDemo />,
};

function CountrySelectorDemo() {
  const [selectedCountry, setSelectedCountry] = useState(null);

  return (
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
              Select Country
            </h3>
            <Autocomplete
              placeholder="Search countries..."
              entityType="country"
              items={sampleCountries}
              onSelect={setSelectedCountry}
            />
            {selectedCountry && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <strong>Selected:</strong> {selectedCountry.flag} {selectedCountry.name}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// Category Selector
export const CategorySelector = {
  name: 'Category Selector',
  render: () => <CategorySelectorDemo />,
};

function CategorySelectorDemo() {
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
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
              Select Category
            </h3>
            <Autocomplete
              placeholder="Search categories..."
              entityType="category"
              items={sampleCategories}
              onSelect={setSelectedCategory}
            />
            {selectedCategory && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <strong>Selected:</strong> {selectedCategory.icon} {selectedCategory.name}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

// Size Variants
export const SizeVariants = {
  name: 'Size Variants',
  render: () => (
  <Container>
    <Row className="g-4">
      <Col md={12}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
          Small
        </h4>
        <Autocomplete
          placeholder="Small size..."
          entityType="user"
          items={sampleUsers}
          size="sm"
        />
      </Col>
      <Col md={12}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
          Medium (Default)
        </h4>
        <Autocomplete
          placeholder="Medium size..."
          entityType="user"
          items={sampleUsers}
          size="md"
        />
      </Col>
      <Col md={12}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
          Large
        </h4>
        <Autocomplete
          placeholder="Large size..."
          entityType="user"
          items={sampleUsers}
          size="lg"
        />
      </Col>
    </Row>
  </Container>
  ),
};

// Loading State
export const LoadingState = {
  name: 'Loading State',
  render: () => (
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
            Loading State
          </h3>
          <Autocomplete
            placeholder="Search..."
            entityType="user"
            items={[]}
            loading={true}
          />
        </Card>
      </Col>
    </Row>
  </Container>
  ),
};

// Empty State
export const EmptyState = {
  name: 'Empty State',
  render: () => (
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
            Empty State
          </h3>
          <Autocomplete
            placeholder="Search for something that doesn't exist..."
            entityType="user"
            items={[]}
            emptyMessage="No users found. Try a different search term."
          />
        </Card>
      </Col>
    </Row>
  </Container>
  ),
};

// All Entity Types Comparison
export const AllEntityTypes = {
  name: 'All Entity Types',
  render: () => (
  <Container>
    <Row className="g-4">
      <Col md={6}>
        <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>Users</h4>
        <Autocomplete
          placeholder="Search users..."
          entityType="user"
          items={sampleUsers.slice(0, 5)}
        />
      </Col>
      <Col md={6}>
        <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>Destinations</h4>
        <Autocomplete
          placeholder="Search destinations..."
          entityType="destination"
          items={sampleDestinations.slice(0, 5)}
        />
      </Col>
      <Col md={6}>
        <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>Experiences</h4>
        <Autocomplete
          placeholder="Search experiences..."
          entityType="experience"
          items={sampleExperiences.slice(0, 5)}
        />
      </Col>
      <Col md={6}>
        <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>Countries</h4>
        <Autocomplete
          placeholder="Search countries..."
          entityType="country"
          items={sampleCountries.slice(0, 5)}
        />
      </Col>
      <Col md={12}>
        <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>Categories</h4>
        <Autocomplete
          placeholder="Search categories..."
          entityType="category"
          items={sampleCategories.slice(0, 5)}
        />
      </Col>
    </Row>
  </Container>
  ),
};
