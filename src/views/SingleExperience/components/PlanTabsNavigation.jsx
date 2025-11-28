/**
 * PlanTabsNavigation Component
 * Displays tab navigation for Experience Plan vs My Plan with dropdown for multiple plans
 */

import { useState, useEffect, useRef } from 'react';
import Loading from '../../../components/Loading/Loading';
import debug from '../../../utilities/debug';

export default function PlanTabsNavigation({
  // Tab state
  activeTab,
  setActiveTab,

  // User data
  user,
  idEquals,

  // Plan data
  collaborativePlans,
  plansLoading,
  selectedPlanId,
  setSelectedPlanId,

  // Handlers
  handlePlanChange,

  // Language strings
  lang
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [dropdownOpen]);
  return (
    <div className="plan-tabs-nav mb-4">
      {/* The Plan Tab - Always visible */}
      <button
        className={`plan-tab-button ${
          activeTab === "experience" ? "active" : ""
        }`}
        onClick={() => setActiveTab("experience")}
      >
        {lang.current.heading.thePlan}
      </button>

      {/* My Plan Tab(s) - Loading or Dropdown/Button */}
      {plansLoading ? (
        // Show loading state for plan tabs
        <button className="plan-tab-button" disabled>
          <Loading size="sm" variant="inline" showMessage={false} />
        </button>
      ) : (
        (() => {
          // Debug log
          debug.log(
            "Rendering tabs. collaborativePlans:",
            collaborativePlans,
            "length:",
            collaborativePlans.length
          );

          // Determine how many plans belong to others (collaborator plans)
          const otherPlansCount = collaborativePlans.filter((plan) => {
            const planUserId = plan.user?._id || plan.user;
            return !idEquals(planUserId, user._id);
          }).length;

          // If there are multiple plans (user + collaborators OR multiple collaborators), show a custom dropdown
          if (collaborativePlans.length > 1 || otherPlansCount > 0) {
            // Get the selected plan's display name
            const selectedPlan = collaborativePlans.find(p => {
              const planId = p._id && p._id.toString ? p._id.toString() : p._id;
              return planId === selectedPlanId;
            });

            let selectedDisplayName = "Plans";
            if (selectedPlan) {
              const planUserId = selectedPlan.user?._id || selectedPlan.user;
              const isOwnPlan = idEquals(planUserId, user._id);

              if (isOwnPlan) {
                selectedDisplayName = "My Plan";
              } else if (selectedPlan.user?.name) {
                const firstName = selectedPlan.user.name.split(' ')[0];
                selectedDisplayName = `${firstName}'s Plan`;
              }
            }

            return (
              <div
                ref={dropdownRef}
                className={`plan-tab-dropdown-container ${activeTab === 'myplan' ? 'active' : ''} ${dropdownOpen ? 'dropdown-open' : ''}`}
              >
                {/* Tab button - switches to My Plan tab without opening dropdown */}
                <button
                  className={`plan-tab-button plan-tab-select ${activeTab === "myplan" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("myplan");
                    setDropdownOpen(false); // Close dropdown when switching tabs
                  }}
                  type="button"
                >
                  {selectedDisplayName}
                </button>

                {/* Caret button - toggles dropdown */}
                <button
                  className="plan-tab-caret-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  type="button"
                  aria-label="Toggle plans dropdown"
                  aria-expanded={dropdownOpen}
                >
                  <span className="plan-tab-caret" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {dropdownOpen ? (
                        // Caret up when open
                        <polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      ) : (
                        // Caret down when closed
                        <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      )}
                    </svg>
                  </span>
                </button>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <div className="plan-tab-dropdown-menu">
                    {collaborativePlans.map((plan, ci) => {
                      const planUserId = plan.user?._id || plan.user;
                      const isOwnPlan = idEquals(planUserId, user._id);
                      let displayName = "Plan";

                      if (isOwnPlan) {
                        displayName = "My Plan";
                      } else if (plan.user?.name) {
                        const firstName = plan.user.name.split(' ')[0];
                        displayName = `${firstName}'s Plan`;
                      }

                      const planId = plan._id && plan._id.toString ? plan._id.toString() : plan._id;
                      const optionKey = planId != null ? planId : `plan-${ci}`;
                      const isSelected = planId === selectedPlanId;

                      return (
                        <button
                          key={optionKey}
                          className={`plan-tab-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            handlePlanChange(planId);
                            setActiveTab("myplan");
                            setDropdownOpen(false);
                          }}
                          type="button"
                        >
                          {displayName}
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Otherwise, render a simple button for the (single) user's plan
          if (collaborativePlans.length === 1) {
            const onlyPlan = collaborativePlans[0];
            const planUserId = onlyPlan.user?._id || onlyPlan.user;
            const isOwnPlan = idEquals(planUserId, user._id);
            // Only show the button if it's the user's own plan
            if (isOwnPlan) {
              return (
                <button
                  className={`plan-tab-button ${activeTab === "myplan" ? "active" : ""}`}
                  onClick={() => {
                    const planId = onlyPlan._id && onlyPlan._id.toString ? onlyPlan._id.toString() : onlyPlan._id;
                    setSelectedPlanId(planId);
                    handlePlanChange(planId); // Ensure plan is set before switching tabs
                    setActiveTab("myplan");
                  }}
                >
                  My Plan
                </button>
              );
            }
          }

          // No plans available - render nothing
          return null;
        })()
      )}
    </div>
  );
}
