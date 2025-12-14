/**
 * PlanTabsNavigation Component
 * Displays tab navigation for Experience Plan vs My Plan with dropdown for multiple plans
 * Design inspired by GitHub-style tab navigation
 */

import { useState, useEffect, useRef } from 'react';
import { FaListAlt, FaUser, FaChevronDown, FaChevronUp, FaCheck } from 'react-icons/fa';
import Loading from '../../../components/Loading/Loading';
import debug from '../../../utilities/debug';
import styles from './PlanTabsNavigation.module.scss';

export default function PlanTabsNavigation({
  // Tab state
  activeTab,
  setActiveTab,

  // User data
  user,
  idEquals,

  // Plan data
  sharedPlans,
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
    <div className={styles.planTabsNav} role="tablist" aria-label="Plan tabs">
      {/* The Plan Tab - Always visible */}
      <button
        type="button"
        className={`${styles.tabItem} ${activeTab === "experience" ? styles.tabItemActive : ""}`}
        onClick={() => setActiveTab("experience")}
        aria-selected={activeTab === "experience"}
        role="tab"
        tabIndex={activeTab === "experience" ? 0 : -1}
      >
        <span className={styles.tabIcon}><FaListAlt /></span>
        <span className={styles.tabLabel}>{lang.current.heading.thePlan}</span>
      </button>

      {/* My Plan Tab(s) - Loading or Dropdown/Button */}
      {plansLoading ? (
        // Show loading state for plan tabs
        <button type="button" className={styles.tabItem} disabled>
          <Loading size="sm" variant="inline" showMessage={false} />
        </button>
      ) : (
        (() => {
          // Debug log
          debug.log(
            "Rendering tabs. sharedPlans:",
            sharedPlans,
            "length:",
            sharedPlans.length
          );

          // Determine how many plans belong to others (collaborator plans)
          const otherPlansCount = sharedPlans.filter((plan) => {
            const planUserId = plan.user?._id || plan.user;
            return !idEquals(planUserId, user._id);
          }).length;

          // If there are multiple plans (user + collaborators OR multiple collaborators), show a custom dropdown
          if (sharedPlans.length > 1 || otherPlansCount > 0) {
            // Get the selected plan's display name
            const selectedPlan = sharedPlans.find(p => {
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
                className={`${styles.tabDropdownContainer} ${activeTab === 'myplan' ? styles.tabDropdownActive : ''} ${dropdownOpen ? styles.tabDropdownOpen : ''}`}
              >
                {/* Tab button - switches to My Plan tab without opening dropdown */}
                <button
                  type="button"
                  className={`${styles.tabItem} ${styles.tabItemWithDropdown} ${activeTab === "myplan" ? styles.tabItemActive : ""}`}
                  onClick={() => {
                    setActiveTab("myplan");
                    setDropdownOpen(false); // Close dropdown when switching tabs
                  }}
                  aria-selected={activeTab === "myplan"}
                  role="tab"
                  tabIndex={activeTab === "myplan" ? 0 : -1}
                >
                  <span className={styles.tabIcon}><FaUser /></span>
                  <span className={styles.tabLabel}>{selectedDisplayName}</span>
                </button>

                {/* Caret button - toggles dropdown */}
                <button
                  type="button"
                  className={styles.tabCaretButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  aria-label="Toggle plans dropdown"
                  aria-expanded={dropdownOpen}
                >
                  {dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
                </button>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <div className={styles.tabDropdownMenu}>
                    {sharedPlans.map((plan, ci) => {
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
                          type="button"
                          className={`${styles.tabDropdownItem} ${isSelected ? styles.tabDropdownItemSelected : ''}`}
                          onClick={() => {
                            handlePlanChange(planId);
                            setActiveTab("myplan");
                            setDropdownOpen(false);
                          }}
                        >
                          <span>{displayName}</span>
                          {isSelected && <FaCheck className={styles.checkmark} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Otherwise, render a simple button for the (single) user's plan
          if (sharedPlans.length === 1) {
            const onlyPlan = sharedPlans[0];
            const planUserId = onlyPlan.user?._id || onlyPlan.user;
            const isOwnPlan = idEquals(planUserId, user._id);
            // Only show the button if it's the user's own plan
            if (isOwnPlan) {
              return (
                <button
                  type="button"
                  className={`${styles.tabItem} ${activeTab === "myplan" ? styles.tabItemActive : ""}`}
                  onClick={() => {
                    const planId = onlyPlan._id && onlyPlan._id.toString ? onlyPlan._id.toString() : onlyPlan._id;
                    setSelectedPlanId(planId);
                    handlePlanChange(planId); // Ensure plan is set before switching tabs
                    setActiveTab("myplan");
                  }}
                  aria-selected={activeTab === "myplan"}
                  role="tab"
                  tabIndex={activeTab === "myplan" ? 0 : -1}
                >
                  <span className={styles.tabIcon}><FaUser /></span>
                  <span className={styles.tabLabel}>My Plan</span>
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
