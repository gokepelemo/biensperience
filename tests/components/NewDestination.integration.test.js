/**
 * Integration tests for NewDestination component (refactored version)
 * Tests the complete workflow with hooks integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NewDestination from '../../src/components/NewDestination/NewDestination';
import { createDestination } from '../../src/utilities/destinations-api';

// Increase timeout for async tests
jest.setTimeout(15000);

// Mock modules
jest.mock('../../src/utilities/destinations-api');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

let mockUserContext;
let mockDataContext;
let mockToastContext;

jest.mock('../../src/contexts/UserContext', () => ({
  useUser: () => mockUserContext
}));

jest.mock('../../src/contexts/DataContext', () => ({
  useData: () => mockDataContext
}));

jest.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockToastContext
}));

// Mock user and data contexts
const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com'
};

const mockDestinations = [
  { _id: '1', name: 'Paris', country: 'France' },
  { _id: '2', name: 'Tokyo', country: 'Japan' }
];

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NewDestination Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUserContext = { user: mockUser };
    mockDataContext = {
      destinations: mockDestinations,
      experiences: [],
      addDestination: jest.fn(),
      updateDestination: jest.fn(),
      deleteDestination: jest.fn()
    };
    mockToastContext = { success: jest.fn(), error: jest.fn() };

    createDestination.mockResolvedValue({
      _id: '3',
      name: 'London',
      country: 'UK',
      travel_tips: []
    });
  });

  describe('Form Rendering with Hooks', () => {
    it('should render all form fields', () => {
      renderWithProviders(<NewDestination />);

      expect(screen.getByLabelText(/City \/ Town/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/State \/ Province/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Country/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Overview/i)).toBeInTheDocument();
    });

    it('should render travel tips manager', () => {
      renderWithProviders(<NewDestination />);

      expect(screen.getByText(/Travel Tips/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Share an insider tip/i)).toBeInTheDocument();
      expect(screen.getByText('Add Tip')).toBeInTheDocument();
    });
  });

  describe('useFormChangeHandler Integration', () => {
    it('should handle form input changes', () => {
      renderWithProviders(<NewDestination />);

      const nameInput = screen.getByLabelText(/City \/ Town/i);
      const countryInput = screen.getByLabelText(/Country/i);

      fireEvent.change(nameInput, { target: { value: 'London' } });
      fireEvent.change(countryInput, { target: { value: 'UK' } });

      expect(nameInput.value).toBe('London');
      expect(countryInput.value).toBe('UK');
    });

    it('should handle textarea changes', () => {
      renderWithProviders(<NewDestination />);

      const overviewInput = screen.getByLabelText(/Overview/i);

      fireEvent.change(overviewInput, {
        target: { value: 'A beautiful city with rich history' }
      });

      expect(overviewInput.value).toBe('A beautiful city with rich history');
    });
  });

  describe('useTravelTipsManager Integration', () => {
    it('should add a travel tip', () => {
      renderWithProviders(<NewDestination />);

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      const addButton = screen.getByText('Add Tip');

      fireEvent.change(tipInput, {
        target: { value: 'Best time to visit is spring' }
      });
      fireEvent.click(addButton);

      expect(screen.getByText('Best time to visit is spring')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
    });

    it('should not add empty tip', () => {
      renderWithProviders(<NewDestination />);

      const addButton = screen.getByText('Add Tip');
      fireEvent.click(addButton);

      expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
    });

    it('should delete a travel tip', async () => {
      renderWithProviders(<NewDestination />);

      // Add a tip first
      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      fireEvent.change(tipInput, { target: { value: 'Test tip' } });
      fireEvent.click(screen.getByText('Add Tip'));

      // Wait for tip to appear
      await waitFor(() => {
        expect(screen.getByText('Test tip')).toBeInTheDocument();
      });

      // Click remove -> confirm modal -> delete
      fireEvent.click(screen.getByRole('button', { name: /Remove/i }));
      fireEvent.click(screen.getByRole('button', { name: /Delete Permanently/i }));

      // Wait for tip to be removed
      await waitFor(() => {
        expect(screen.queryByText('Test tip')).not.toBeInTheDocument();
      });
    });

    it('should handle Enter key to add tip', () => {
      renderWithProviders(<NewDestination />);

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);

      fireEvent.change(tipInput, {
        target: { value: 'Press enter to add' }
      });
      fireEvent.keyDown(tipInput, { key: 'Enter', code: 'Enter' });

      expect(screen.getByText('Press enter to add')).toBeInTheDocument();
    });
  });

  describe('useFormErrorHandling Integration', () => {
    it('should handle email not verified error', async () => {
      createDestination.mockRejectedValue({
        response: {
          data: {
            code: 'EMAIL_NOT_VERIFIED',
            error: 'Please verify your email'
          }
        }
      });

      renderWithProviders(<NewDestination />);

      // Fill form with proper name attributes
      const cityInput = screen.getByLabelText(/City \/ Town/i);
      const countryInput = screen.getByLabelText(/Country/i);

      fireEvent.change(cityInput, {
        target: { name: 'name', value: 'Madrid' }
      });
      fireEvent.change(countryInput, {
        target: { name: 'country', value: 'Spain' }
      });

      // Verify values
      expect(cityInput.value).toBe('Madrid');
      expect(countryInput.value).toBe('Spain');

      // Submit
      const submitButton = screen.getByText(/Create Destination/i);
      fireEvent.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        const errorElement = screen.queryByText(/verify your email/i);
        expect(errorElement).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle duplicate destination error', async () => {
      createDestination.mockRejectedValue({
        message: 'Destination already exists'
      });

      renderWithProviders(<NewDestination />);

      // Use a non-duplicate input so we exercise backend duplicate handling
      fireEvent.change(screen.getByLabelText(/City \/ Town/i), {
        target: { name: 'name', value: 'Lisbon' }
      });
      fireEvent.change(screen.getByLabelText(/Country/i), {
        target: { name: 'country', value: 'Portugal' }
      });

      fireEvent.click(screen.getByText(/Create Destination/i));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle generic error', async () => {
      createDestination.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<NewDestination />);

      fireEvent.change(screen.getByLabelText(/City \/ Town/i), {
        target: { name: 'name', value: 'Berlin' }
      });
      fireEvent.change(screen.getByLabelText(/Country/i), {
        target: { name: 'country', value: 'Germany' }
      });

      fireEvent.click(screen.getByText(/Create Destination/i));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Frontend Duplicate Check', () => {
    it('should prevent duplicate destination submission', async () => {
      renderWithProviders(<NewDestination />);

      // Wait for component to load and set destinations from context
      await waitFor(() => {
        expect(screen.getByLabelText(/City \/ Town/i)).toBeInTheDocument();
      });

      // Try to create Paris, France (already exists in mockDestinations)
      const cityInput = screen.getByLabelText(/City \/ Town/i);
      const countryInput = screen.getByLabelText(/Country/i);

      fireEvent.change(cityInput, {
        target: { name: 'name', value: 'Paris' }
      });
      fireEvent.change(countryInput, {
        target: { name: 'country', value: 'France' }
      });

      // Verify values are set
      expect(cityInput).toHaveValue('Paris');
      expect(countryInput).toHaveValue('France');

      const submitButton = screen.getByRole('button', { name: /Create Destination/i });
      fireEvent.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        const errorElement = screen.queryByText(/already exists/i);
        expect(errorElement).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should not call API
      expect(createDestination).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for duplicate check', async () => {
      renderWithProviders(<NewDestination />);

      const cityInput = screen.getByLabelText(/City \/ Town/i);
      const countryInput = screen.getByLabelText(/Country/i);

      fireEvent.change(cityInput, {
        target: { name: 'name', value: 'PARIS' }
      });
      fireEvent.change(countryInput, {
        target: { name: 'country', value: 'france' }
      });

      // Verify values are set
      expect(cityInput.value).toBe('PARIS');
      expect(countryInput.value).toBe('france');

      const submitButton = screen.getByText(/Create Destination/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorElement = screen.queryByText(/already exists/i);
        expect(errorElement).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Complete Form Submission Workflow', () => {
    it('should successfully create destination with all fields', async () => {
      mockDataContext.addDestination = jest.fn();

      renderWithProviders(<NewDestination />);

      // Fill all fields with proper name attributes
      fireEvent.change(screen.getByLabelText(/City \/ Town/i), {
        target: { name: 'name', value: 'Amsterdam' }
      });
      fireEvent.change(screen.getByLabelText(/State \/ Province/i), {
        target: { name: 'state', value: 'North Holland' }
      });
      fireEvent.change(screen.getByLabelText(/Country/i), {
        target: { name: 'country', value: 'Netherlands' }
      });
      fireEvent.change(screen.getByLabelText(/Overview/i), {
        target: { name: 'overview', value: 'Beautiful canal city' }
      });

      // Add travel tips
      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      fireEvent.change(tipInput, { target: { value: 'Rent a bike' } });
      fireEvent.click(screen.getByText('Add Tip'));

      // Submit
      fireEvent.click(screen.getByText(/Create Destination/i));

      await waitFor(() => {
        expect(createDestination).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Amsterdam',
            country: 'Netherlands',
            overview: 'Beautiful canal city'
          })
        );
      }, { timeout: 3000 });
    });

    it('should create destination with minimal fields', async () => {
      renderWithProviders(<NewDestination />);

      fireEvent.change(screen.getByLabelText(/City \/ Town/i), {
        target: { name: 'name', value: 'Berlin' }
      });
      fireEvent.change(screen.getByLabelText(/Country/i), {
        target: { name: 'country', value: 'Germany' }
      });

      fireEvent.click(screen.getByText('Create Destination'));

      await waitFor(() => {
        expect(createDestination).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Berlin',
            country: 'Germany',
            travel_tips: []
          })
        );
      });
    });
  });

  describe('TravelTipsManager Component Integration', () => {
    it('should render TravelTipsManager with custom labels', () => {
      renderWithProviders(<NewDestination />);

      expect(screen.getByText(/Travel Tips/i)).toBeInTheDocument();
      expect(screen.getByText('Add Tip')).toBeInTheDocument();
    });

    it('should show travel tips list when tips exist', () => {
      renderWithProviders(<NewDestination />);

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);

      // Add multiple tips
      fireEvent.change(tipInput, { target: { value: 'Tip 1' } });
      fireEvent.click(screen.getByText('Add Tip'));

      fireEvent.change(tipInput, { target: { value: 'Tip 2' } });
      fireEvent.click(screen.getByText('Add Tip'));

      fireEvent.change(tipInput, { target: { value: 'Tip 3' } });
      fireEvent.click(screen.getByText('Add Tip'));

      expect(screen.getByText('Tip 1')).toBeInTheDocument();
      expect(screen.getByText('Tip 2')).toBeInTheDocument();
      expect(screen.getByText('Tip 3')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Remove/i })).toHaveLength(3);
    });
  });

  describe('Code Elimination Verification', () => {
    it('should have eliminated manual handleChange implementation', () => {
      // The refactored component should use useFormChangeHandler
      // No manual handleChange function should exist in the component
      const component = NewDestination.toString();
      expect(component).not.toContain('function handleChange(e)');
    });

    it('should have eliminated manual travel tips management', () => {
      // Should use useTravelTipsManager hook instead
      const component = NewDestination.toString();
      expect(component).not.toContain('function addTravelTip(text)');
      expect(component).not.toContain('function deleteTravelTip(id)');
    });

    it('should have eliminated manual error handling', () => {
      // Should use useFormErrorHandling hook
      const component = NewDestination.toString();
      expect(component).not.toContain('if (err.response?.data?.code === "EMAIL_NOT_VERIFIED")');
    });
  });
});
