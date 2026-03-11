/**
 * Tests for BaseAccordion component
 *
 * Mocks @chakra-ui/react Accordion primitives with plain HTML
 * to avoid ChakraProvider/recipe requirements in test environment.
 */

import React from 'react';
import { render, screen, fireEvent } from '../test-utils';

// Mock Chakra Accordion primitives with plain HTML that exposes props
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react');
  const React = require('react');

  const Root = ({ children, className, defaultValue, value, onValueChange, collapsible, variant, ...props }) =>
    React.createElement('div', {
      'data-testid': 'accordion-root',
      'data-default-value': defaultValue ? JSON.stringify(defaultValue) : undefined,
      'data-value': value ? JSON.stringify(value) : undefined,
      'data-collapsible': collapsible ? 'true' : undefined,
      'data-variant': variant,
      className,
      onClick: () => {
        // Simulate value change on click for controlled tests
        if (onValueChange) {
          Root._onValueChange = onValueChange;
        }
      },
      ...props
    }, children);

  // Store onValueChange so tests can trigger it
  Root._onValueChange = null;

  const Item = ({ children, className, value, ...props }) =>
    React.createElement('div', {
      'data-testid': 'accordion-item',
      'data-value': value,
      className,
      ...props
    }, children);

  const ItemTrigger = ({ children, className, ...props }) =>
    React.createElement('button', {
      'data-testid': 'accordion-trigger',
      className,
      ...props
    }, children);

  const ItemContent = ({ children, className, ...props }) =>
    React.createElement('div', {
      'data-testid': 'accordion-content',
      className,
      ...props
    }, children);

  const ItemBody = ({ children, className, ...props }) =>
    React.createElement('div', {
      'data-testid': 'accordion-body',
      className,
      ...props
    }, children);

  const ItemIndicator = ({ children, className, ...props }) =>
    React.createElement('span', {
      'data-testid': 'accordion-indicator',
      className,
      ...props
    }, children);

  return {
    ...actual,
    Accordion: { Root, Item, ItemTrigger, ItemContent, ItemBody, ItemIndicator },
  };
});

// Now import the component under test (after mocks are set up)
import BaseAccordion from '../../src/components/Accordion/BaseAccordion';

describe('BaseAccordion helper functions', () => {
  // We test the helper functions indirectly through the component's prop conversion

  describe('toChakraValue (via defaultActiveKey prop)', () => {
    it('should convert string key to item-prefixed value', () => {
      render(
        <BaseAccordion defaultActiveKey="0">
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-default-value')).toBe('["item-0"]');
    });

    it('should pass through already prefixed keys', () => {
      render(
        <BaseAccordion defaultActiveKey="item-0">
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-default-value')).toBe('["item-0"]');
    });
  });

  describe('defaultIndex prop conversion', () => {
    it('should convert numeric defaultIndex to Chakra value', () => {
      render(
        <BaseAccordion defaultIndex={2}>
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-default-value')).toBe('["item-2"]');
    });

    it('should convert array defaultIndex to Chakra values', () => {
      render(
        <BaseAccordion defaultIndex={[0, 2]}>
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-default-value')).toBe('["item-0","item-2"]');
    });
  });

  describe('activeKey controlled mode', () => {
    it('should convert activeKey to controlled value array', () => {
      render(
        <BaseAccordion activeKey="1">
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-value')).toBe('["item-1"]');
    });

    it('should produce empty array when activeKey is null', () => {
      render(
        <BaseAccordion activeKey={null}>
          <div>child</div>
        </BaseAccordion>
      );
      const root = screen.getByTestId('accordion-root');
      expect(root.getAttribute('data-value')).toBe('[]');
    });
  });
});

describe('BaseAccordion rendering', () => {
  it('should render without extra className when none provided', () => {
    render(
      <BaseAccordion>
        <div>content</div>
      </BaseAccordion>
    );
    const root = screen.getByTestId('accordion-root');
    // No className added when none provided (Chakra recipe handles styling)
    expect(root.className).toBeFalsy();
  });

  it('should pass className to Root', () => {
    render(
      <BaseAccordion className="my-custom-class">
        <div>content</div>
      </BaseAccordion>
    );
    const root = screen.getByTestId('accordion-root');
    expect(root.className).toBe('my-custom-class');
  });

  it('should pass collapsible to Root', () => {
    render(
      <BaseAccordion>
        <div>content</div>
      </BaseAccordion>
    );
    const root = screen.getByTestId('accordion-root');
    expect(root.getAttribute('data-collapsible')).toBe('true');
  });

  it('should not set variant (uses default Chakra recipe)', () => {
    render(
      <BaseAccordion>
        <div>content</div>
      </BaseAccordion>
    );
    const root = screen.getByTestId('accordion-root');
    expect(root.getAttribute('data-variant')).toBeNull();
  });
});

describe('BaseAccordionItem', () => {
  it('should map eventKey to value with item- prefix', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <div>item content</div>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const item = screen.getByTestId('accordion-item');
    expect(item.getAttribute('data-value')).toBe('item-0');
  });

  it('should pass className to item', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0" className="custom-item">
          <div>item content</div>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const item = screen.getByTestId('accordion-item');
    expect(item.className).toContain('custom-item');
  });
});

describe('BaseAccordionHeader', () => {
  it('should render children', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Header>Click me</BaseAccordion.Header>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should render an indicator with chevron icon', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Header>Header</BaseAccordion.Header>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const indicator = screen.getByTestId('accordion-indicator');
    expect(indicator).toBeInTheDocument();
    // Chevron SVG is inside the indicator
    expect(indicator.querySelector('svg')).toBeInTheDocument();
  });

  it('should pass className to trigger', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Header className="custom-header">Header</BaseAccordion.Header>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const trigger = screen.getByTestId('accordion-trigger');
    expect(trigger.className).toContain('custom-header');
  });

  it('should ignore the as prop', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Header as="div">Header</BaseAccordion.Header>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const trigger = screen.getByTestId('accordion-trigger');
    // Should render as button (from ItemTrigger), not div
    expect(trigger.tagName).toBe('BUTTON');
  });
});

describe('BaseAccordionBody', () => {
  it('should render children', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Body>Body content</BaseAccordion.Body>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('should render ItemBody inside ItemContent', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Body>Body</BaseAccordion.Body>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const content = screen.getByTestId('accordion-content');
    const body = screen.getByTestId('accordion-body');
    expect(content).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(body.textContent).toBe('Body');
  });

  it('should pass className to ItemContent', () => {
    render(
      <BaseAccordion>
        <BaseAccordion.Item eventKey="0">
          <BaseAccordion.Body className="custom-body">Body</BaseAccordion.Body>
        </BaseAccordion.Item>
      </BaseAccordion>
    );
    const content = screen.getByTestId('accordion-content');
    expect(content.className).toContain('custom-body');
  });
});

describe('Compound component pattern', () => {
  it('should have Item, Header, Body as sub-components', () => {
    expect(BaseAccordion.Item).toBeDefined();
    expect(BaseAccordion.Header).toBeDefined();
    expect(BaseAccordion.Body).toBeDefined();
  });
});
