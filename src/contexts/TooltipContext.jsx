/**
 * TooltipContext
 *
 * Manages global tooltip state to ensure only one tooltip is visible at a time.
 * Components register their tooltip with a unique ID and the context handles
 * closing other tooltips when a new one opens.
 */

import { createContext, useContext, useState, useCallback } from 'react';

const TooltipContext = createContext(null);

export function TooltipProvider({ children }) {
  const [activeTooltipId, setActiveTooltipId] = useState(null);

  // Open a tooltip (closes any other open tooltip)
  const openTooltip = useCallback((id) => {
    setActiveTooltipId(id);
  }, []);

  // Close the currently active tooltip
  const closeTooltip = useCallback((id) => {
    setActiveTooltipId(prev => prev === id ? null : prev);
  }, []);

  // Toggle a tooltip
  const toggleTooltip = useCallback((id) => {
    setActiveTooltipId(prev => prev === id ? null : id);
  }, []);

  // Check if a specific tooltip is active
  const isTooltipActive = useCallback((id) => {
    return activeTooltipId === id;
  }, [activeTooltipId]);

  return (
    <TooltipContext.Provider value={{
      activeTooltipId,
      openTooltip,
      closeTooltip,
      toggleTooltip,
      isTooltipActive
    }}>
      {children}
    </TooltipContext.Provider>
  );
}

export function useTooltipContext() {
  const context = useContext(TooltipContext);
  if (!context) {
    // Return a fallback for components used outside TooltipProvider
    return {
      activeTooltipId: null,
      openTooltip: () => {},
      closeTooltip: () => {},
      toggleTooltip: () => {},
      isTooltipActive: () => false
    };
  }
  return context;
}

export default TooltipContext;
