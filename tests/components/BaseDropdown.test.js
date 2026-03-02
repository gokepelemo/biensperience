/**
 * Tests for BaseDropdown component
 *
 * Mocks @chakra-ui/react Menu primitives and chakra factory
 * with plain HTML to avoid ChakraProvider/recipe requirements.
 */

import React from 'react';
import { render, screen, fireEvent } from '../test-utils';

// Track onSelect callback for controlled tests
let mockOnSelect = null;

// Mock Chakra Menu primitives and chakra factory
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react');
  const React = require('react');

  const Root = ({ children, className, onSelect, ...props }) => {
    mockOnSelect = onSelect;
    return React.createElement('div', {
      'data-testid': 'menu-root',
      className,
      ...props
    }, children);
  };

  const Trigger = ({ children, asChild, ...props }) => {
    // When asChild, just render the child directly
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, { 'data-testid': 'menu-trigger', ...props });
    }
    return React.createElement('div', { 'data-testid': 'menu-trigger', ...props }, children);
  };

  const Content = ({ children, className, ...props }) =>
    React.createElement('div', {
      'data-testid': 'menu-content',
      className,
      ...props
    }, children);

  const Positioner = ({ children, ...props }) =>
    React.createElement('div', { 'data-testid': 'menu-positioner', ...props }, children);

  const Item = ({ children, className, value, ...props }) =>
    React.createElement('div', {
      'data-testid': 'menu-item',
      'data-value': value,
      className,
      role: 'menuitem',
      onClick: () => {
        if (mockOnSelect) mockOnSelect({ value });
      },
      ...props
    }, children);

  const Separator = (props) =>
    React.createElement('hr', { 'data-testid': 'menu-separator', ...props });

  // Mock chakra factory to return a simple component
  const chakra = (tag) => {
    const Component = React.forwardRef((props, ref) =>
      React.createElement(tag, { ref, ...props })
    );
    Component.displayName = `chakra(${tag})`;
    return Component;
  };

  return {
    ...actual,
    Menu: { Root, Trigger, Content, Positioner, Item, Separator },
    chakra,
  };
});

import BaseDropdown, {
  BaseDropdownToggle,
  BaseDropdownMenu,
  BaseDropdownItem,
  BaseDropdownDivider
} from '../../src/components/Dropdown/BaseDropdown';

beforeEach(() => {
  mockOnSelect = null;
});

describe('BaseDropdown', () => {
  it('should render children', () => {
    render(
      <BaseDropdown>
        <span>dropdown content</span>
      </BaseDropdown>
    );
    expect(screen.getByText('dropdown content')).toBeInTheDocument();
  });

  it('should render Menu.Root', () => {
    render(
      <BaseDropdown>
        <span>content</span>
      </BaseDropdown>
    );
    expect(screen.getByTestId('menu-root')).toBeInTheDocument();
  });

  it('should pass className to root', () => {
    render(
      <BaseDropdown className="my-dropdown">
        <span>content</span>
      </BaseDropdown>
    );
    expect(screen.getByTestId('menu-root').className).toBe('my-dropdown');
  });

  it('should transform onSelect callback to extract value', () => {
    const onSelect = jest.fn();
    render(
      <BaseDropdown onSelect={onSelect}>
        <BaseDropdown.Toggle>Open</BaseDropdown.Toggle>
        <BaseDropdown.Menu>
          <BaseDropdown.Item eventKey="action-1">Action 1</BaseDropdown.Item>
        </BaseDropdown.Menu>
      </BaseDropdown>
    );

    fireEvent.click(screen.getByText('Action 1'));
    expect(onSelect).toHaveBeenCalledWith('action-1');
  });

  it('should not crash when onSelect is not provided', () => {
    render(
      <BaseDropdown>
        <BaseDropdown.Item eventKey="x">Item</BaseDropdown.Item>
      </BaseDropdown>
    );
    // Should not throw
    fireEvent.click(screen.getByText('Item'));
  });
});

describe('BaseDropdownToggle', () => {
  it('should render children', () => {
    render(
      <BaseDropdown>
        <BaseDropdownToggle>Click me</BaseDropdownToggle>
      </BaseDropdown>
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should render as a button', () => {
    render(
      <BaseDropdown>
        <BaseDropdownToggle>Toggle</BaseDropdownToggle>
      </BaseDropdown>
    );
    const trigger = screen.getByText('Toggle');
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('should pass className to button', () => {
    render(
      <BaseDropdown>
        <BaseDropdownToggle className="custom-toggle">Toggle</BaseDropdownToggle>
      </BaseDropdown>
    );
    expect(screen.getByText('Toggle').className).toContain('custom-toggle');
  });

  it('should ignore variant prop without error', () => {
    render(
      <BaseDropdown>
        <BaseDropdownToggle variant="primary">Toggle</BaseDropdownToggle>
      </BaseDropdown>
    );
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });
});

describe('BaseDropdownMenu', () => {
  it('should render Menu.Positioner and Menu.Content', () => {
    render(
      <BaseDropdown>
        <BaseDropdownMenu>
          <span>menu items</span>
        </BaseDropdownMenu>
      </BaseDropdown>
    );
    expect(screen.getByTestId('menu-positioner')).toBeInTheDocument();
    expect(screen.getByTestId('menu-content')).toBeInTheDocument();
  });

  it('should pass className to Content', () => {
    render(
      <BaseDropdown>
        <BaseDropdownMenu className="custom-menu">
          <span>items</span>
        </BaseDropdownMenu>
      </BaseDropdown>
    );
    expect(screen.getByTestId('menu-content').className).toBe('custom-menu');
  });
});

describe('BaseDropdownItem', () => {
  it('should map eventKey to value', () => {
    render(
      <BaseDropdown>
        <BaseDropdownItem eventKey="action-1">Action</BaseDropdownItem>
      </BaseDropdown>
    );
    const item = screen.getByTestId('menu-item');
    expect(item.getAttribute('data-value')).toBe('action-1');
  });

  it('should append active class when active', () => {
    render(
      <BaseDropdown>
        <BaseDropdownItem eventKey="a" active className="base">Active Item</BaseDropdownItem>
      </BaseDropdown>
    );
    const item = screen.getByTestId('menu-item');
    expect(item.className).toContain('base');
    expect(item.className).toContain('active');
  });

  it('should not append active class when not active', () => {
    render(
      <BaseDropdown>
        <BaseDropdownItem eventKey="a" className="base">Normal Item</BaseDropdownItem>
      </BaseDropdown>
    );
    const item = screen.getByTestId('menu-item');
    expect(item.className).toContain('base');
    expect(item.className).not.toContain('active');
  });
});

describe('BaseDropdownDivider', () => {
  it('should render Menu.Separator', () => {
    render(
      <BaseDropdown>
        <BaseDropdownDivider />
      </BaseDropdown>
    );
    expect(screen.getByTestId('menu-separator')).toBeInTheDocument();
  });
});

describe('Compound component pattern', () => {
  it('should have Toggle, Menu, Item, Divider as sub-components', () => {
    expect(BaseDropdown.Toggle).toBe(BaseDropdownToggle);
    expect(BaseDropdown.Menu).toBe(BaseDropdownMenu);
    expect(BaseDropdown.Item).toBe(BaseDropdownItem);
    expect(BaseDropdown.Divider).toBe(BaseDropdownDivider);
  });
});
