/**
 * Custom hook for managing travel tips in destination forms
 * Handles adding, deleting, and updating travel tips
 * Supports both simple string tips and structured tips with metadata
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing travel tips
 * @param {Array} initialTips - Initial array of travel tips (strings or objects)
 * @returns {Object} Travel tips management utilities
 */
export function useTravelTipsManager(initialTips = []) {
  const [travelTips, setTravelTips] = useState(initialTips);
  const [newTravelTip, setNewTravelTip] = useState('');

  // Tip mode: 'simple' for string tips, 'structured' for object tips
  const [tipMode, setTipMode] = useState('simple');

  // Structured tip form state
  const [structuredTip, setStructuredTip] = useState({
    type: 'Language',
    category: '',
    value: '',
    note: '',
    exchangeRate: '',
    callToAction: {
      label: '',
      url: ''
    },
    icon: ''
  });

  /**
   * Add a simple string travel tip
   */
  const addTravelTip = useCallback(() => {
    if (newTravelTip.trim()) {
      setTravelTips(prev => [...prev, newTravelTip.trim()]);
      setNewTravelTip('');
    }
  }, [newTravelTip]);

  /**
   * Add a structured travel tip
   */
  const addStructuredTip = useCallback(() => {
    if (!structuredTip.value.trim()) return;

    const tip = {
      type: structuredTip.type,
      value: structuredTip.value.trim()
    };

    // Add optional fields only if they have values
    if (structuredTip.type === 'Custom' && structuredTip.category) {
      tip.category = structuredTip.category.trim();
    }
    if (structuredTip.note) tip.note = structuredTip.note.trim();
    if (structuredTip.type === 'Currency' && structuredTip.exchangeRate) {
      tip.exchangeRate = structuredTip.exchangeRate.trim();
    }
    if (structuredTip.callToAction.label && structuredTip.callToAction.url) {
      tip.callToAction = {
        label: structuredTip.callToAction.label.trim(),
        url: structuredTip.callToAction.url.trim()
      };
    }
    if (structuredTip.icon) tip.icon = structuredTip.icon;

    setTravelTips(prev => [...prev, tip]);

    // Reset form
    setStructuredTip({
      type: 'Language',
      category: '',
      value: '',
      note: '',
      exchangeRate: '',
      callToAction: { label: '', url: '' },
      icon: ''
    });
  }, [structuredTip]);

  /**
   * Delete a travel tip by index
   */
  const deleteTravelTip = useCallback((index) => {
    setTravelTips(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Update a travel tip at specific index
   */
  const updateTravelTip = useCallback((index, value) => {
    setTravelTips(prev => prev.map((tip, i) => i === index ? value : tip));
  }, []);

  /**
   * Handle new tip input change
   */
  const handleNewTipChange = useCallback((e) => {
    setNewTravelTip(e.target.value);
  }, []);

  /**
   * Handle key press in new tip input (add on Enter)
   */
  const handleNewTipKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTravelTip();
    }
  }, [addTravelTip]);

  /**
   * Reset travel tips to new array
   */
  const resetTravelTips = useCallback((tips) => {
    setTravelTips(tips);
    setNewTravelTip('');
  }, []);

  /**
   * Update a field in the structured tip form
   */
  const updateStructuredTipField = useCallback((field, value) => {
    setStructuredTip(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Update call-to-action fields
   */
  const updateCallToAction = useCallback((field, value) => {
    setStructuredTip(prev => ({
      ...prev,
      callToAction: {
        ...prev.callToAction,
        [field]: value
      }
    }));
  }, []);

  return {
    // Simple tip management
    travelTips,
    newTravelTip,
    setTravelTips,
    addTravelTip,
    deleteTravelTip,
    updateTravelTip,
    handleNewTipChange,
    handleNewTipKeyPress,
    resetTravelTips,

    // Structured tip management
    tipMode,
    setTipMode,
    structuredTip,
    addStructuredTip,
    updateStructuredTipField,
    updateCallToAction
  };
}

export default useTravelTipsManager;
