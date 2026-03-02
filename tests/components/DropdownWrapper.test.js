/**
 * Tests for DropdownWrapper component
 *
 * DropdownWrapper is a thin abstraction layer that delegates to BaseDropdown.
 * Tests verify passthrough behavior, compound component attachment, and displayNames.
 */

import React from 'react';
import { render, screen } from '../test-utils';

// Mock BaseDropdown to verify passthrough
const mockBaseDropdown = jest.fn(({ children, ...props }) => (
  <div data-testid="base-dropdown" {...props}>{children}</div>
));
const mockBaseDropdownToggle = jest.fn(({ children, ...props }) => (
  <button data-testid="base-dropdown-toggle" {...props}>{children}</button>
));
const mockBaseDropdownMenu = jest.fn(({ children, ...props }) => (
  <div data-testid="base-dropdown-menu" {...props}>{children}</div>
));
const mockBaseDropdownItem = jest.fn(({ children, ...props }) => (
  <div data-testid="base-dropdown-item" {...props}>{children}</div>
));
const mockBaseDropdownDivider = jest.fn((props) => (
  <hr data-testid="base-dropdown-divider" {...props} />
));

jest.mock('../../src/components/Dropdown/BaseDropdown', () => {
  const actual = {
    __esModule: true,
    default: (...args) => mockBaseDropdown(...args),
    BaseDropdownToggle: (...args) => mockBaseDropdownToggle(...args),
    BaseDropdownMenu: (...args) => mockBaseDropdownMenu(...args),
    BaseDropdownItem: (...args) => mockBaseDropdownItem(...args),
    BaseDropdownDivider: (...args) => mockBaseDropdownDivider(...args),
  };
  return actual;
});

import DropdownWrapper, {
  DropdownToggleWrapper,
  DropdownMenuWrapper,
  DropdownItemWrapper,
  DropdownDividerWrapper
} from '../../src/components/DropdownWrapper/DropdownWrapper';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DropdownWrapper', () => {
  it('should render BaseDropdown', () => {
    render(
      <DropdownWrapper>
        <span>content</span>
      </DropdownWrapper>
    );
    expect(screen.getByTestId('base-dropdown')).toBeInTheDocument();
  });

  it('should pass props through to BaseDropdown', () => {
    const onSelect = jest.fn();
    render(
      <DropdownWrapper className="my-dropdown" onSelect={onSelect}>
        <span>content</span>
      </DropdownWrapper>
    );
    expect(mockBaseDropdown).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'my-dropdown',
        onSelect,
      }),
      expect.anything()
    );
  });

  it('should have displayName "Dropdown"', () => {
    expect(DropdownWrapper.displayName).toBe('Dropdown');
  });
});

describe('DropdownToggleWrapper', () => {
  it('should render BaseDropdownToggle', () => {
    render(<DropdownToggleWrapper>Toggle</DropdownToggleWrapper>);
    expect(screen.getByTestId('base-dropdown-toggle')).toBeInTheDocument();
  });

  it('should pass props through', () => {
    render(
      <DropdownToggleWrapper className="custom" variant="primary">
        Toggle
      </DropdownToggleWrapper>
    );
    expect(mockBaseDropdownToggle).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'custom',
        variant: 'primary',
      }),
      expect.anything()
    );
  });

  it('should have displayName "Dropdown.Toggle"', () => {
    expect(DropdownToggleWrapper.displayName).toBe('Dropdown.Toggle');
  });
});

describe('DropdownMenuWrapper', () => {
  it('should render BaseDropdownMenu', () => {
    render(
      <DropdownMenuWrapper>
        <span>items</span>
      </DropdownMenuWrapper>
    );
    expect(screen.getByTestId('base-dropdown-menu')).toBeInTheDocument();
  });

  it('should pass props through', () => {
    render(
      <DropdownMenuWrapper className="custom-menu" renderOnMount>
        <span>items</span>
      </DropdownMenuWrapper>
    );
    expect(mockBaseDropdownMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'custom-menu',
        renderOnMount: true,
      }),
      expect.anything()
    );
  });

  it('should have displayName "Dropdown.Menu"', () => {
    expect(DropdownMenuWrapper.displayName).toBe('Dropdown.Menu');
  });
});

describe('DropdownItemWrapper', () => {
  it('should render BaseDropdownItem', () => {
    render(<DropdownItemWrapper>Action</DropdownItemWrapper>);
    expect(screen.getByTestId('base-dropdown-item')).toBeInTheDocument();
  });

  it('should pass props through', () => {
    const onClick = jest.fn();
    render(
      <DropdownItemWrapper eventKey="action-1" active className="item" onClick={onClick}>
        Action
      </DropdownItemWrapper>
    );
    expect(mockBaseDropdownItem).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'action-1',
        active: true,
        className: 'item',
        onClick,
      }),
      expect.anything()
    );
  });

  it('should have displayName "Dropdown.Item"', () => {
    expect(DropdownItemWrapper.displayName).toBe('Dropdown.Item');
  });
});

describe('DropdownDividerWrapper', () => {
  it('should render BaseDropdownDivider', () => {
    render(<DropdownDividerWrapper />);
    expect(screen.getByTestId('base-dropdown-divider')).toBeInTheDocument();
  });

  it('should pass props through', () => {
    render(<DropdownDividerWrapper className="custom-divider" />);
    expect(mockBaseDropdownDivider).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'custom-divider' }),
      expect.anything()
    );
  });

  it('should have displayName "Dropdown.Divider"', () => {
    expect(DropdownDividerWrapper.displayName).toBe('Dropdown.Divider');
  });
});

describe('Compound component pattern', () => {
  it('should attach Toggle as sub-component', () => {
    expect(DropdownWrapper.Toggle).toBe(DropdownToggleWrapper);
  });

  it('should attach Menu as sub-component', () => {
    expect(DropdownWrapper.Menu).toBe(DropdownMenuWrapper);
  });

  it('should attach Item as sub-component', () => {
    expect(DropdownWrapper.Item).toBe(DropdownItemWrapper);
  });

  it('should attach Divider as sub-component', () => {
    expect(DropdownWrapper.Divider).toBe(DropdownDividerWrapper);
  });
});
