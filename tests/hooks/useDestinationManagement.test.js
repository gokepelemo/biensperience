/**
 * Tests for useDestinationManagement hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useDestinationManagement } from '../../src/hooks/useDestinationManagement';

describe('useDestinationManagement', () => {
  const mockDestinations = [
    { _id: '1', name: 'Paris', country: 'France' },
    { _id: '2', name: 'Tokyo', country: 'Japan' }
  ];

  const formData = { destination: '' };
  const setFormData = jest.fn();
  const setDestinations = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with closed modal', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    expect(result.current.showDestinationModal).toBe(false);
    expect(result.current.destinationInput).toBe('');
    expect(result.current.prefillName).toBe('');
  });

  it('should generate destination options with create option', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    const options = result.current.getDestinationOptions();

    expect(options.length).toBe(3); // 2 destinations + 1 create option
    expect(options[2].name).toBe('✚ Create New Destination');
    expect(options[2].isCreateOption).toBe(true);
  });

  it('should add create option with user input', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    act(() => {
      result.current.handleDestinationChange({
        target: { value: 'London' }
      });
    });

    const options = result.current.getDestinationOptions();

    expect(options[2].name).toBe('✚ Create New');
    expect(options[2].country).toBe('London');
  });

  it('should open modal when create option selected', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    act(() => {
      result.current.handleDestinationChange({
        target: { value: '✚ Create New: Berlin' }
      });
    });

    expect(result.current.showDestinationModal).toBe(true);

    // Hook uses functional setState (called multiple times); ensure one call clears destination.
    const updaterCalls = setFormData.mock.calls.map((c) => c[0]).filter((v) => typeof v === 'function');
    expect(updaterCalls.length).toBeGreaterThan(0);
    const cleared = updaterCalls.some((fn) => fn({ destination: 'Berlin' }).destination === '');
    expect(cleared).toBe(true);
  });

  it('should handle destination created', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    const newDestination = {
      _id: '3',
      name: 'Berlin',
      country: 'Germany'
    };

    act(() => {
      result.current.handleDestinationCreated(newDestination);
    });

    expect(setDestinations).toHaveBeenCalledWith(expect.any(Function));

    const updater = setFormData.mock.calls[0][0];
    expect(typeof updater).toBe('function');
    expect(updater({ destination: '' })).toEqual(
      expect.objectContaining({ destination: 'Berlin, Germany' })
    );
    expect(result.current.showDestinationModal).toBe(false);
  });

  it('should open modal on button click', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    const mockEvent = { preventDefault: jest.fn() };

    act(() => {
      result.current.handleCreateDestinationClick(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.showDestinationModal).toBe(true);
  });

  it('should prefill destination field content when Create New button is clicked', () => {
    const formDataWithDestination = { destination: 'Barcelona' };
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formDataWithDestination, setFormData, setDestinations)
    );

    const mockEvent = { preventDefault: jest.fn() };

    act(() => {
      result.current.handleCreateDestinationClick(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.showDestinationModal).toBe(true);
    expect(result.current.prefillName).toBe('Barcelona');
  });

  it('should close modal', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    // Open modal first
    act(() => {
      result.current.setShowDestinationModal(true);
    });

    expect(result.current.showDestinationModal).toBe(true);

    // Close modal
    act(() => {
      result.current.closeDestinationModal();
    });

    expect(result.current.showDestinationModal).toBe(false);
    expect(result.current.prefillName).toBe('');
  });

  it('should extract text from create option for prefill', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    act(() => {
      result.current.handleDestinationChange({
        target: { value: '✚ Create New: Amsterdam' }
      });
    });

    expect(result.current.prefillName).toBe('Amsterdam');
  });

  it('should handle create option without text', () => {
    const { result } = renderHook(() =>
      useDestinationManagement(mockDestinations, formData, setFormData, setDestinations)
    );

    act(() => {
      result.current.handleDestinationChange({
        target: { value: '+ Create New Destination' }
      });
    });

    expect(result.current.showDestinationModal).toBe(true);
  });
});
