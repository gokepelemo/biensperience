/**
 * Custom hook for managing destination creation and selection in forms
 * Handles the "Create New Destination" workflow
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing destination selection and creation
 * @param {Array} destinations - Array of available destinations
 * @param {Object} formData - Current form data
 * @param {Function} setFormData - Form data setter
 * @param {Function} setDestinations - Destinations array setter (optional)
 * @returns {Object} Destination management utilities
 */
export function useDestinationManagement(destinations, formData, setFormData, setDestinations) {
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationInput, setDestinationInput] = useState('');
  const [prefillName, setPrefillName] = useState('');

  /**
   * Get destination options including "Create New" option
   */
  const getDestinationOptions = useCallback(() => {
    const input = destinationInput || formData.destination || '';
    const options = [...destinations];

    // Always add the create new destination option
    if (input.trim() !== '') {
      options.push({
        _id: 'create-new',
        name: `✚ Create New`,
        country: input,
        isCreateOption: true
      });
    } else {
      options.push({
        _id: 'create-new-generic',
        name: '✚ Create New Destination',
        country: '',
        isCreateOption: true
      });
    }

    return options;
  }, [destinations, destinationInput, formData.destination]);

  /**
   * Handle destination field change
   */
  const handleDestinationChange = useCallback((e) => {
    const inputValue = e.target.value;
    setDestinationInput(inputValue);

    // Update form data
    setFormData(prev => ({
      ...prev,
      destination: inputValue
    }));

    // Check if user selected create new destination option
    if (inputValue.includes('✚ Create New') ||
        inputValue === '+ Create New Destination' ||
        inputValue.startsWith('Create "')) {

      // Extract the input text if present
      const match = inputValue.match(/Create New[:\s]*(.+)/);
      if (match && match[1]) {
        setPrefillName(match[1].trim());
      } else {
        setPrefillName(destinationInput);
      }

      setShowDestinationModal(true);

      // Clear the field so the special value doesn't persist
      setFormData(prev => ({ ...prev, destination: '' }));
      setDestinationInput('');
    }
  }, [destinationInput, setFormData]);

  /**
   * Handle when a new destination is created
   */
  const handleDestinationCreated = useCallback((newDestination) => {
    // Add to destinations list if setter provided
    if (setDestinations) {
      setDestinations(prev => [...prev, newDestination]);
    }

    // Set as selected destination
    const destinationValue = `${newDestination.name}, ${newDestination.country}`;
    setFormData(prev => ({
      ...prev,
      destination: destinationValue
    }));

    // Update input tracking
    setDestinationInput(destinationValue);

    // Close modal
    setShowDestinationModal(false);
    setPrefillName('');
  }, [setFormData, setDestinations]);

  /**
   * Handle manual click on create destination button
   */
  const handleCreateDestinationClick = useCallback((e) => {
    e.preventDefault();
    // Use the current destination field value from formData, not destinationInput
    const currentDestinationValue = formData.destination || '';
    setPrefillName(currentDestinationValue);
    setShowDestinationModal(true);
  }, [formData.destination]);

  /**
   * Close destination modal
   */
  const closeDestinationModal = useCallback(() => {
    setShowDestinationModal(false);
    setPrefillName('');
  }, []);

  return {
    showDestinationModal,
    destinationInput,
    prefillName,
    getDestinationOptions,
    handleDestinationChange,
    handleDestinationCreated,
    handleCreateDestinationClick,
    closeDestinationModal,
    setShowDestinationModal
  };
}

export default useDestinationManagement;
