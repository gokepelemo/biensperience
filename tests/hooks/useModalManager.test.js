import { renderHook, act } from '@testing-library/react';
import { useModalManager, MODAL_NAMES } from '../../src/hooks/useModalManager';
import { logger } from '../../src/utilities/logger';

describe('useModalManager', () => {
  it('should initialize with no active modal', () => {
    const { result } = renderHook(() => useModalManager());
    
    expect(result.current.activeModal).toBeNull();
    expect(result.current.isModalOpen(MODAL_NAMES.DELETE_EXPERIENCE)).toBe(false);
  });

  it('should open a modal', () => {
    const { result } = renderHook(() => useModalManager());
    
    act(() => {
      result.current.openModal(MODAL_NAMES.DELETE_EXPERIENCE);
    });

    expect(result.current.activeModal).toBe(MODAL_NAMES.DELETE_EXPERIENCE);
    expect(result.current.isModalOpen(MODAL_NAMES.DELETE_EXPERIENCE)).toBe(true);
  });

  it('should close the active modal', () => {
    const { result } = renderHook(() => useModalManager());
    
    act(() => {
      result.current.openModal(MODAL_NAMES.REMOVE_PLAN);
    });

    expect(result.current.activeModal).toBe(MODAL_NAMES.REMOVE_PLAN);

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.activeModal).toBeNull();
    expect(result.current.isModalOpen(MODAL_NAMES.REMOVE_PLAN)).toBe(false);
  });

  it('should only allow one modal open at a time', () => {
    const { result } = renderHook(() => useModalManager());
    
    act(() => {
      result.current.openModal(MODAL_NAMES.DELETE_PLAN_ITEM);
    });

    expect(result.current.activeModal).toBe(MODAL_NAMES.DELETE_PLAN_ITEM);

    act(() => {
      result.current.openModal(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
    });

    // Should replace the previous modal
    expect(result.current.activeModal).toBe(MODAL_NAMES.ADD_EDIT_PLAN_ITEM);
    expect(result.current.isModalOpen(MODAL_NAMES.DELETE_PLAN_ITEM)).toBe(false);
    expect(result.current.isModalOpen(MODAL_NAMES.ADD_EDIT_PLAN_ITEM)).toBe(true);
  });

  it('should check if specific modal is open', () => {
    const { result } = renderHook(() => useModalManager());
    
    act(() => {
      result.current.openModal(MODAL_NAMES.PLAN_ITEM_DETAILS);
    });

    expect(result.current.isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS)).toBe(true);
    expect(result.current.isModalOpen(MODAL_NAMES.DELETE_EXPERIENCE)).toBe(false);
    expect(result.current.isModalOpen(MODAL_NAMES.PHOTO_VIEWER)).toBe(false);
  });

  it('should warn when opening modal with invalid name', () => {
    const { result } = renderHook(() => useModalManager());
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    
    act(() => {
      result.current.openModal(null);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[useModalManager] openModal called with invalid modal name',
      { modalName: null }
    );
    expect(result.current.activeModal).toBeNull();

    warnSpy.mockRestore();
  });

  it('should export all modal name constants', () => {
    expect(MODAL_NAMES.DELETE_EXPERIENCE).toBe('deleteExperience');
    expect(MODAL_NAMES.REMOVE_PLAN).toBe('removePlan');
    expect(MODAL_NAMES.DELETE_PLAN_ITEM).toBe('deletePlanItem');
    expect(MODAL_NAMES.DELETE_PLAN_INSTANCE_ITEM).toBe('deletePlanInstanceItem');
    expect(MODAL_NAMES.ADD_EDIT_PLAN_ITEM).toBe('addEditPlanItem');
    expect(MODAL_NAMES.PLAN_ITEM_DETAILS).toBe('planItemDetails');
    expect(MODAL_NAMES.INLINE_COST_ENTRY).toBe('inlineCostEntry');
    expect(MODAL_NAMES.PHOTO_VIEWER).toBe('photoViewer');
    expect(MODAL_NAMES.PHOTO_UPLOAD).toBe('photoUpload');
    expect(MODAL_NAMES.DATE_PICKER).toBe('datePicker');
  });
});
