/**
 * Integration tests for UpdateDestination component (refactored version)
 * Tests the complete workflow with hooks integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import UpdateDestination from '../UpdateDestination';
import { UserProvider } from '../../../contexts/UserContext';
import { DataProvider } from '../../../contexts/DataContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { updateDestination, showDestination } from '../../../utilities/destinations-api';

// Increase timeout for async tests
jest.setTimeout(30000);

// Mock modules
jest.mock('../../../utilities/destinations-api');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ destinationId: 'dest123' })
}));

// Mock user and data contexts
const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user'
};

const mockDestination = {
  _id: 'dest123',
  name: 'Paris',
  state: 'Île-de-France',
  country: 'France',
  travel_tips: ['Visit in spring', 'Use the Metro'],
  photos: [],
  permissions: [
    { entity: 'user', type: 'owner', _id: 'user123' }
  ]
};

const renderWithProviders = (component) => {
  return render(
    <MemoryRouter initialEntries={['/destinations/dest123/edit']}>
      <ToastProvider>
        <UserProvider value={{ user: mockUser }}>
          <DataProvider value={{
            destinations: [mockDestination],
            updateDestination: jest.fn()
          }}>
            {component}
          </DataProvider>
        </UserProvider>
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('UpdateDestination Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock showDestination to return immediately
    showDestination.mockImplementation(() => Promise.resolve(mockDestination));
    // Mock updateDestination
    updateDestination.mockImplementation((id, data) => Promise.resolve({
      ...mockDestination,
      ...data,
      name: data.name || 'Updated Paris'
    }));
  });

  describe('Form Loading and Rendering', () => {
    it('should show loading state initially', () => {
      renderWithProviders(<UpdateDestination />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should load and render destination data', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for form fields to render (implicitly waits for loading to complete)
      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toHaveValue('Paris');
      }, { timeout: 15000 });

      expect(screen.getByLabelText(/State \/ Province/i)).toHaveValue('Île-de-France');
      expect(screen.getByLabelText(/Country/i)).toHaveValue('France');
      expect(showDestination).toHaveBeenCalledWith('dest123');
    }, 30000);

    it('should render travel tips from loaded data', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      // Wait for travel tips to render
      await waitFor(() => {
        expect(screen.getByText('Visit in spring')).toBeInTheDocument();
        expect(screen.getByText('Use the Metro')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should show error if user is not authorized', async () => {
      const unauthorizedDest = {
        ...mockDestination,
        permissions: [{ entity: 'user', type: 'owner', _id: 'otheruser' }]
      };
      showDestination.mockResolvedValue(unauthorizedDest);

      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear and error to appear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('useChangeTrackingHandler Integration', () => {
    it('should track form input changes', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const nameInput = screen.getByLabelText(/City Name/i);
      fireEvent.change(nameInput, { target: { value: 'Lyon' } });

      expect(nameInput.value).toBe('Lyon');

      // Changes detected alert should appear
      await waitFor(() => {
        expect(screen.getByText(/Changes detected:/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should enable update button when changes detected', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const updateButton = screen.getByText(/Confirm Update/i);
      expect(updateButton).toBeDisabled();

      const nameInput = screen.getByLabelText(/City Name/i);
      fireEvent.change(nameInput, { target: { value: 'Lyon' } });

      await waitFor(() => {
        expect(updateButton).not.toBeDisabled();
      }, { timeout: 10000 });
    });

    it('should display changes in alert', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const nameInput = screen.getByLabelText(/City Name/i);
      fireEvent.change(nameInput, { target: { value: 'Lyon' } });

      await waitFor(() => {
        expect(screen.getByText(/Changes detected:/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('useTravelTipsManager Integration', () => {
    it('should add a travel tip', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share an insider tip/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      const addButton = screen.getByText('Add Tip');

      fireEvent.change(tipInput, { target: { value: 'Best croissants at corner bakery' } });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Best croissants at corner bakery')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should delete a travel tip', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByText('Visit in spring')).toBeInTheDocument();
      }, { timeout: 10000 });

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Visit in spring')).not.toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should track travel tips changes', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share an insider tip/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      fireEvent.change(tipInput, { target: { value: 'New tip' } });
      fireEvent.click(screen.getByText('Add Tip'));

      await waitFor(() => {
        expect(screen.getByText(/Changes detected:/i)).toBeInTheDocument();
      });
    });

    it('should handle Enter key to add tip', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Share an insider tip/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      fireEvent.change(tipInput, { target: { value: 'Press enter to add' } });
      fireEvent.keyPress(tipInput, { key: 'Enter', code: 13, charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText('Press enter to add')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('useFormErrorHandling Integration', () => {
    it('should handle email not verified error', async () => {
      updateDestination.mockRejectedValue({
        response: {
          data: {
            code: 'EMAIL_NOT_VERIFIED',
            error: 'Please verify your email'
          }
        }
      });

      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Make a change
      fireEvent.change(screen.getByLabelText(/City Name/i), {
        target: { value: 'Lyon' }
      });

      // Submit
      await waitFor(() => {
        expect(screen.getByText(/Confirm Update/i)).not.toBeDisabled();
      }, { timeout: 10000 });

      fireEvent.click(screen.getByText(/Confirm Update/i));

      // Confirm in modal
      await waitFor(() => {
        expect(screen.getByText(/Confirm Destination Update/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      const submitButton = screen.getByText(/Update Destination/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please verify your email')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle duplicate destination error', async () => {
      updateDestination.mockRejectedValue({
        message: 'Destination already exists',
        response: { status: 409 }
      });

      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.change(screen.getByLabelText(/City Name/i), {
        target: { value: 'London' }
      });

      fireEvent.click(screen.getByText(/Confirm Update/i));

      await waitFor(() => {
        expect(screen.getByText(/Update Destination/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.click(screen.getByText(/Update Destination/i));

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle generic error', async () => {
      updateDestination.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.change(screen.getByLabelText(/City Name/i), {
        target: { value: 'Berlin' }
      });

      fireEvent.click(screen.getByText(/Confirm Update/i));

      await waitFor(() => {
        expect(screen.getByText(/Update Destination/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.click(screen.getByText(/Update Destination/i));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Complete Update Workflow', () => {
    it('should successfully update destination with all changes', async () => {
      const mockUpdateDestination = jest.fn();

      render(
        <MemoryRouter initialEntries={['/destinations/dest123/edit']}>
          <ToastProvider>
            <UserProvider value={{ user: mockUser }}>
              <DataProvider value={{
                destinations: [mockDestination],
                updateDestination: mockUpdateDestination
              }}>
                <UpdateDestination />
              </DataProvider>
            </UserProvider>
          </ToastProvider>
        </MemoryRouter>
      );

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Make changes
      fireEvent.change(screen.getByLabelText(/City Name/i), {
        target: { value: 'Lyon' }
      });
      fireEvent.change(screen.getByLabelText(/Country/i), {
        target: { value: 'France Updated' }
      });

      // Add travel tip
      const tipInput = screen.getByPlaceholderText(/Share an insider tip/i);
      fireEvent.change(tipInput, { target: { value: 'Try local wine' } });
      fireEvent.click(screen.getByText('Add Tip'));

      // Submit
      fireEvent.click(screen.getByText(/Confirm Update/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Destination Update/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.click(screen.getByText(/Update Destination/i));

      await waitFor(() => {
        expect(updateDestination).toHaveBeenCalledWith(
          'dest123',
          expect.objectContaining({
            name: 'Lyon',
            country: 'France Updated',
            travel_tips: expect.arrayContaining(['Try local wine'])
          })
        );
      }, { timeout: 10000 });
    });

    it('should show confirmation modal with changes summary', async () => {
      renderWithProviders(<UpdateDestination />);

      // Wait for loading state to clear
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText(/City Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      fireEvent.change(screen.getByLabelText(/City Name/i), {
        target: { value: 'Lyon' }
      });

      fireEvent.click(screen.getByText(/Confirm Update/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Destination Update/i)).toBeInTheDocument();
        expect(screen.getByText(/Please review your changes/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Code Elimination Verification', () => {
    it('should have eliminated manual handleChange implementation', () => {
      const component = UpdateDestination.toString();
      expect(component).not.toContain('function handleChange(e)');
    });

    it('should have eliminated manual travel tips management', () => {
      const component = UpdateDestination.toString();
      expect(component).not.toContain('function addTravelTip(text)');
      expect(component).not.toContain('function deleteTravelTip(id)');
      expect(component).not.toContain('function handleTravelTipChange');
    });

    it('should have eliminated manual error handling', () => {
      const component = UpdateDestination.toString();
      expect(component).not.toContain('if (err.response?.data?.code === "EMAIL_NOT_VERIFIED")');
      expect(component).not.toContain('else if (err.message && err.message.includes');
    });
  });
});
