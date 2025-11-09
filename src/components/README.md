# Design System Components

This document provides usage examples for all the React components built from the Storybook elements.

## Overview

The following components have been created from the Storybook utilities:

- **Button** - Gradient, outline, and Bootstrap button variants
- **Pill** - Badge/status indicators with color variants
- **SkeletonLoader** - Loading state placeholders
- **Form** - Unified form styling with sub-components
- **Table** - Responsive tables with hover states
- **Layout** - Flexbox and spacing utilities
- **Text** - Typography with effects and truncation
- **Animation** - Entrance animations and effects
- **Responsive** - Screen size visibility controls

## Import Examples

```javascript
// Individual component imports
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { SkeletonLoader } from '../components/SkeletonLoader';

// Form components
import { Form, FormGroup, FormLabel, FormControl, FormCheck, FormText } from '../components/Form';

// Table components
import { Table, TableHead, TableBody, TableRow, TableCell } from '../components/Table';

// Layout components
import { FlexBetween, FlexCenter, SpaceY, Container, Stack } from '../components/Layout';

// Text components
import { Text, Heading, Paragraph } from '../components/Text';

// Animation components
import { FadeIn, SlideUp, ScaleIn, Staggered } from '../components/Animation';

// Responsive components
import { Show, Hide, Mobile, Desktop } from '../components/Responsive';

// Or import everything from design-system.js
import {
  Button, Pill, SkeletonLoader,
  Form, FormGroup, FormLabel, FormControl, FormCheck, FormText,
  Table, TableHead, TableBody, TableRow, TableCell,
  FlexBetween, FlexCenter, SpaceY, Container, Stack,
  Text, Heading, Paragraph,
  FadeIn, SlideUp, ScaleIn, Staggered,
  Show, Hide, Mobile, Desktop
} from '../components/design-system';
```

## Button Component

```javascript
// Basic gradient button
<Button>Primary Action</Button>

// Outline button
<Button variant="outline">Secondary Action</Button>

// Bootstrap button
<Button variant="bootstrap" bootstrapVariant="success">Success</Button>

// With size and effects
<Button size="lg" rounded shadow>Call to Action</Button>

// Disabled state
<Button disabled>Unavailable</Button>
```

## Pill Component

```javascript
// Basic pill
<Pill>Tag</Pill>

// Color variants
<Pill variant="primary">Primary</Pill>
<Pill variant="success">Success</Pill>
<Pill variant="warning">Warning</Pill>
<Pill variant="danger">Danger</Pill>
<Pill variant="info">Info</Pill>
<Pill variant="neutral">Neutral</Pill>

// Size variants
<Pill size="sm">Small</Pill>
<Pill size="lg">Large</Pill>

// Outline style
<Pill variant="primary" outline>Outlined</Pill>

// Rounded
<Pill rounded>Fully Rounded</Pill>
```

## SkeletonLoader Component

```javascript
// Text skeleton
<SkeletonLoader variant="text" width="200px" />

// Circle skeleton
<SkeletonLoader variant="circle" width="60px" height="60px" />

// Rectangle skeleton
<SkeletonLoader variant="rectangle" width="300px" height="200px" />

// Multiple text lines
<SkeletonLoader variant="text" lines={3} />

// With animation
<SkeletonLoader variant="text" animate={true} />
```

## Form Components

```javascript
<Form onSubmit={handleSubmit}>
  <FormGroup>
    <FormLabel htmlFor="name" required>Name</FormLabel>
    <FormControl
      type="text"
      id="name"
      placeholder="Enter your name"
    />
    <FormText>This field is required</FormText>
  </FormGroup>

  <FormGroup>
    <FormLabel htmlFor="email">Email</FormLabel>
    <FormControl
      as="input"
      type="email"
      id="email"
      placeholder="your.email@example.com"
    />
  </FormGroup>

  <FormGroup>
    <FormLabel htmlFor="category">Category</FormLabel>
    <FormControl as="select" id="category">
      <option>Select a category...</option>
      <option>Option 1</option>
      <option>Option 2</option>
    </FormControl>
  </FormGroup>

  <FormCheck
    type="checkbox"
    id="agree"
  >
    I agree to the terms
  </FormCheck>

  <FlexBetween>
    <Button variant="outline" type="button">Cancel</Button>
    <Button type="submit">Submit</Button>
  </FlexBetween>
</Form>
```

## Table Components

```javascript
<Table hover striped responsive>
  <TableHead>
    <TableRow>
      <TableCell header>Name</TableCell>
      <TableCell header>Email</TableCell>
      <TableCell header>Status</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
      <TableCell><Pill variant="success">Active</Pill></TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Jane Smith</TableCell>
      <TableCell>jane@example.com</TableCell>
      <TableCell><Pill variant="warning">Pending</Pill></TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Layout Components

```javascript
// Flex between
<FlexBetween>
  <span>Left content</span>
  <span>Right content</span>
</FlexBetween>

// Flex center
<FlexCenter>
  <span>Centered content</span>
</FlexCenter>

// Vertical spacing
<SpaceY size="4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</SpaceY>

// Container
<Container size="lg" center>
  <div>Centered content with max width</div>
</Container>

// Stack
<Stack spacing="md" align="center">
  <div>Stacked item 1</div>
  <div>Stacked item 2</div>
  <div>Stacked item 3</div>
</Stack>
```

## Text Components

```javascript
// Basic text
<Text>Regular text content</Text>

// Typography variants
<Text variant="lead">Lead text with larger size</Text>
<Text variant="caption">Small caption text</Text>

// Size variants
<Text size="lg">Large text</Text>
<Text size="xl">Extra large text</Text>

// Weight variants
<Text weight="bold">Bold text</Text>
<Text weight="light">Light text</Text>

// Effects
<Text gradient>Gradient text effect</Text>
<Text shadow>Text with shadow</Text>

// Truncation
<Text truncate={1}>This text will be truncated to one line with ellipsis</Text>
<Text truncate={2}>This text will be truncated to two lines with ellipsis</Text>

// Alignment
<Text align="center">Centered text</Text>

// Semantic components
<Heading level={1}>Page Title</Heading>
<Heading level={2}>Section Title</Heading>
<Paragraph>This is a paragraph with proper semantic markup</Paragraph>
```

## Animation Components

```javascript
// Basic animations
<FadeIn>
  <div>Content that fades in</div>
</FadeIn>

<SlideUp>
  <div>Content that slides up</div>
</SlideUp>

<ScaleIn>
  <div>Content that scales in</div>
</ScaleIn>

// With timing controls
<FadeIn duration="slow" delay="medium">
  <div>Slow fade with medium delay</div>
</FadeIn>

// Staggered animations
<Staggered staggerDelay={100}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Staggered>
```

## Responsive Components

```javascript
// Show/hide based on screen size
<Show on="mobile">
  <div>Mobile only content</div>
</Show>

<Hide on="desktop">
  <div>Hidden on desktop</div>
</Hide>

// Convenience components
<Mobile>
  <div>Mobile specific content</div>
</Mobile>

<Desktop>
  <div>Desktop specific content</div>
</Desktop>

<HiddenOnMobile>
  <div>Hidden on mobile devices</div>
</HiddenOnMobile>
```

## Complete Example

```javascript
import React, { useState, useEffect } from 'react';
import {
  Container, SpaceY, FlexBetween, Button, Pill,
  Table, TableHead, TableBody, TableRow, TableCell,
  FadeIn, SkeletonLoader, Mobile, Desktop
} from '../components/design-system';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setUsers([
        { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'pending' },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Container size="xl">
      <SpaceY size="6">
        <FadeIn>
          <FlexBetween>
            <div>
              <h1>User Management</h1>
              <p>Manage system users and their permissions</p>
            </div>
            <Button size="lg" rounded>Add User</Button>
          </FlexBetween>
        </FadeIn>

        <FadeIn delay="short">
          {loading ? (
            <div>
              <SkeletonLoader variant="text" width="200px" />
              <SpaceY size="2">
                {Array.from({ length: 3 }, (_, i) => (
                  <SkeletonLoader key={i} variant="rectangle" height="60px" />
                ))}
              </SpaceY>
            </div>
          ) : (
            <Table hover responsive>
              <TableHead>
                <TableRow>
                  <TableCell header>Name</TableCell>
                  <TableCell header>Email</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>
                    <Desktop>Actions</Desktop>
                    <Mobile>⋮</Mobile>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Pill
                        variant={user.status === 'active' ? 'success' : 'warning'}
                      >
                        {user.status}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <FlexBetween>
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="bootstrap" bootstrapVariant="danger" size="sm">
                          Delete
                        </Button>
                      </FlexBetween>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </FadeIn>
      </SpaceY>
    </Container>
  );
}

export default UserManagement;
```

## Migration from Utility Classes

If you're migrating from using utility classes directly to components:

```javascript
// Before (utility classes)
<button className="btn-gradient">Click me</button>
<span className="pill pill-variant-primary">Tag</span>

// After (components)
<Button>Click me</Button>
<Pill variant="primary">Tag</Pill>
```

## Accessibility Notes

- All components include proper ARIA attributes where needed
- Focus management is handled automatically
- Screen reader support is built-in
- Color contrast meets WCAG guidelines
- Keyboard navigation is supported

## Dark Mode Support

All components automatically support dark mode through CSS custom properties. No additional configuration needed.

## Performance

- Components are tree-shakeable
- Minimal re-renders with proper memoization
- CSS is optimized and compressed
- No external dependencies beyond React and PropTypes