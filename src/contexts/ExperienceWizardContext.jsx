import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ExperienceWizardModal from '../components/ExperienceWizardModal';

const ExperienceWizardContext = createContext(null);

/**
 * ExperienceWizardProvider - Provides global access to the Experience Wizard Modal
 *
 * This allows any component in the app to open the wizard without needing to
 * manage its own modal state.
 *
 * Usage:
 * const { openExperienceWizard } = useExperienceWizard();
 * openExperienceWizard(); // or openExperienceWizard({ destinationId: '123' });
 */
export function ExperienceWizardProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  // Store arbitrary initial values to prefill the wizard form
  const [initialValues, setInitialValues] = useState(null);

  const openExperienceWizard = useCallback((options = {}) => {
    // Accept either a direct values object or an options object with initialValues
    const values = options.initialValues || options || null;
    setInitialValues(values);
    setIsOpen(true);
  }, []);

  const closeExperienceWizard = useCallback(() => {
    setIsOpen(false);
    setInitialValues(null);
  }, []);

  return (
    <ExperienceWizardContext.Provider value={{
      isOpen,
      openExperienceWizard,
      closeExperienceWizard
    }}>
      {children}
      <ExperienceWizardModal
        show={isOpen}
        onClose={closeExperienceWizard}
        initialValues={initialValues}
      />
    </ExperienceWizardContext.Provider>
  );
}

ExperienceWizardProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access the Experience Wizard
 * @returns {{ isOpen: boolean, openExperienceWizard: (options?: { destinationId?: string }) => void, closeExperienceWizard: () => void }}
 */
export function useExperienceWizard() {
  const context = useContext(ExperienceWizardContext);
  if (!context) {
    throw new Error('useExperienceWizard must be used within an ExperienceWizardProvider');
  }
  return context;
}

export default ExperienceWizardContext;
