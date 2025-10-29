/**
 * Tests for useFormChangeHandler hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useFormChangeHandler, useChangeTrackingHandler } from '../useFormChangeHandler';

describe('useFormChangeHandler', () => {
  it('should handle input change', () => {
    const formData = { name: '', email: '' };
    const setFormData = jest.fn();

    const { result } = renderHook(() =>
      useFormChangeHandler(formData, setFormData)
    );

    act(() => {
      result.current({
        target: { name: 'name', value: 'John Doe' }
      });
    });

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'John Doe' })
    );
  });

  it('should handle checkbox change', () => {
    const formData = { newsletter: false };
    const setFormData = jest.fn();

    const { result } = renderHook(() =>
      useFormChangeHandler(formData, setFormData)
    );

    act(() => {
      result.current({
        target: { name: 'newsletter', type: 'checkbox', checked: true }
      });
    });

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ newsletter: true })
    );
  });

  it('should call onFieldChange callback when provided', () => {
    const formData = { name: '' };
    const setFormData = jest.fn();
    const onFieldChange = jest.fn();

    const { result } = renderHook(() =>
      useFormChangeHandler(formData, setFormData, { onFieldChange })
    );

    act(() => {
      result.current({
        target: { name: 'name', value: 'Jane' }
      });
    });

    expect(onFieldChange).toHaveBeenCalledWith('name', 'Jane');
  });
});

describe('useChangeTrackingHandler', () => {
  it('should track changes from original data', () => {
    const formData = { name: 'John', email: 'john@example.com' };
    const setFormData = jest.fn();
    const originalData = { name: 'John', email: 'john@example.com' };
    const changes = {};
    const setChanges = jest.fn();

    const { result } = renderHook(() =>
      useChangeTrackingHandler(formData, setFormData, originalData, changes, setChanges)
    );

    act(() => {
      result.current({
        target: { name: 'name', value: 'Jane Doe' }
      });
    });

    expect(setFormData).toHaveBeenCalled();
    expect(setChanges).toHaveBeenCalledWith({
      name: { from: 'John', to: 'Jane Doe' }
    });
  });

  it('should remove change when value reverts to original', () => {
    const formData = { name: 'Jane' };
    const setFormData = jest.fn();
    const originalData = { name: 'John' };
    const changes = { name: { from: 'John', to: 'Jane' } };
    const setChanges = jest.fn();

    const { result } = renderHook(() =>
      useChangeTrackingHandler(formData, setFormData, originalData, changes, setChanges)
    );

    act(() => {
      result.current({
        target: { name: 'name', value: 'John' }
      });
    });

    expect(setChanges).toHaveBeenCalledWith({});
  });

  it('should handle no original data gracefully', () => {
    const formData = { name: 'John' };
    const setFormData = jest.fn();
    const changes = {};
    const setChanges = jest.fn();

    const { result } = renderHook(() =>
      useChangeTrackingHandler(formData, setFormData, null, changes, setChanges)
    );

    act(() => {
      result.current({
        target: { name: 'name', value: 'Jane' }
      });
    });

    expect(setFormData).toHaveBeenCalled();
    expect(setChanges).not.toHaveBeenCalled();
  });
});
