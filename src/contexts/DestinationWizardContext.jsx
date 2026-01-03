import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import DestinationWizardModal from '../components/DestinationWizardModal';

const DestinationWizardContext = createContext(null);

/**
 * DestinationWizardProvider - Provides global access to the Destination Wizard Modal
 *
 * This allows any component in the app to open the wizard without needing to
 * manage its own modal state.
 *
 * Usage:
 * const { openDestinationWizard } = useDestinationWizard();
 * openDestinationWizard(); // or openDestinationWizard({ prefillName: 'Paris' });
 */
export function DestinationWizardProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  // Store arbitrary initial values to prefill the wizard form
  const [initialValues, setInitialValues] = useState(null);

  const openDestinationWizard = useCallback((options = {}) => {
    // Accept either a direct values object or an options object with initialValues
    const values = options.initialValues || options || null;
    setInitialValues(values);
    setIsOpen(true);
  }, []);

  const closeDestinationWizard = useCallback(() => {
    setIsOpen(false);
    setInitialValues(null);
  }, []);

  return (
    <DestinationWizardContext.Provider value={{
      isOpen,
      openDestinationWizard,
      closeDestinationWizard
    }}>
      {children}
      <DestinationWizardModal
        show={isOpen}
        onClose={closeDestinationWizard}
        initialValues={initialValues}
      />
    </DestinationWizardContext.Provider>
  );
}

DestinationWizardProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access the Destination Wizard
 * @returns {{ isOpen: boolean, openDestinationWizard: (options?: { prefillName?: string }) => void, closeDestinationWizard: () => void }}
 */
export function useDestinationWizard() {
  const context = useContext(DestinationWizardContext);
  if (!context) {
    throw new Error('useDestinationWizard must be used within a DestinationWizardProvider');
  }
  return context;
}

export default DestinationWizardContext;
