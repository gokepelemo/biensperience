/**
 * PlanTabsNavigation Component
 * Displays tab navigation for Experience Plan vs My Plan with dropdown for multiple plans
 * Design inspired by GitHub-style tab navigation
 *
 * Wrapped with React.memo to prevent unnecessary re-renders - this component
 * only needs to re-render when tab/plan selection or plans list changes.
 */

import { memo, useState, useEffect, useRef } from 'react';
import { FaListAlt, FaUser, FaChevronDown, FaChevronUp, FaCheck, FaRss } from 'react-icons/fa';
import Loading from '../../../components/Loading/Loading';
import debug from '../../../utilities/debug';
import { lang } from '../../../lang.constants';
import { idEquals, normalizeId } from '../../../utilities/id-utils';
import { Box, Flex } from '@chakra-ui/react';

function PlanTabsNavigation({
  // Tab state
  activeTab,
  setActiveTab,

  // User data
  user,

  // Plan data
  userPlan,
  sharedPlans,
  plansLoading,
  selectedPlanId,
  setSelectedPlanId,

  // Handlers
  handlePlanChange
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // sharedPlans intentionally excludes the user's own plan (userPlan is canonical)
  // For UI navigation, we need the full list of accessible plans.
  const allPlans = userPlan ? [userPlan, ...sharedPlans] : sharedPlans;

  const ensurePlanSelected = () => {
    const existing = normalizeId(selectedPlanId);
    if (existing) return existing;

    const fallbackPlan = userPlan || allPlans?.[0];
    const fallbackPlanId = normalizeId(fallbackPlan?._id);
    if (!fallbackPlanId) return null;

    setSelectedPlanId(fallbackPlanId);
    handlePlanChange(fallbackPlanId, { reason: 'tab-click/ensurePlanSelected' });
    return fallbackPlanId;
  };

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

  // Style constants for tab navigation
  const planTabsNavStyle = { display: 'flex', gap: 'var(--space-1)', overflow: 'visible', borderBottom: '1px solid var(--color-border-light)', marginBottom: 'var(--space-6)', '@media (max-width: 991px)': { justifyContent: 'center' }, '@media (max-width: 768px)': { gap: 0, justifyContent: 'center', flexWrap: 'wrap' } };
  const tabItemBase = { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color var(--transition-fast), border-color var(--transition-fast)', marginBottom: '-1px', '&:hover:not(:disabled)': { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-border-medium)' }, '&:focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px', borderRadius: 'var(--radius-sm)' }, '@media (max-width: 991px)': { fontSize: 'var(--font-size-base)' }, '@media (max-width: 768px)': { padding: 'var(--space-3)', fontSize: 'var(--font-size-base)' } };
  const tabItemActiveAdditions = { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-primary)', '&:hover:not(:disabled)': { borderBottomColor: 'var(--color-primary)' } };
  const tabItemWithDropdownAdditions = { paddingRight: 'var(--space-2)' };
  const tabIconStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', '& svg': { width: '1em', height: '1em' }, '@media (max-width: 768px)': { fontSize: '0.875rem' } };
  const tabLabelStyle = { lineHeight: 1, '@media (max-width: 991px)': { lineHeight: '1.15' } };
  const tabDropdownContainerStyle = { position: 'relative', display: 'inline-flex', alignItems: 'center' };
  const caretButtonBase = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2)', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: '-1px', transition: 'color var(--transition-fast), border-color var(--transition-fast)', '&:hover': { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-border-medium)' }, '& svg': { width: '0.75rem', height: '0.75rem' } };
  const caretButtonActiveAdditions = { color: 'var(--color-primary)', borderBottomColor: 'var(--color-primary)' };
  const tabDropdownMenuStyle = { position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)', zIndex: 100, minWidth: '160px', padding: 'var(--space-2) 0', background: 'var(--color-bg-primary, #ffffff)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' };
  const tabDropdownItemBase = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background-color var(--transition-fast), color var(--transition-fast)', '&:hover': { background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' } };
  const tabDropdownItemSelectedAdditions = { color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', '&:hover': { color: 'var(--color-primary)' } };
  const checkmarkStyle = { marginLeft: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-primary)' };

  return (
    <Flex css={planTabsNavStyle} role="tablist" aria-label={lang.current.aria.planTabs}>
      {/* Activity Tab - Always visible, shows experience activity feed */}
      <Box
        as="button"
        type="button"
        css={{ ...tabItemBase, ...(activeTab === "activity" ? tabItemActiveAdditions : {}) }}
        onClick={() => setActiveTab("activity")}
        aria-selected={activeTab === "activity"}
        role="tab"
        tabIndex={activeTab === "activity" ? 0 : -1}
      >
        <Box as="span" css={tabIconStyle}><FaRss /></Box>
        <Box as="span" css={tabLabelStyle}>Activity</Box>
      </Box>

      {/* The Plan Tab - Always visible */}
      <Box
        as="button"
        type="button"
        css={{ ...tabItemBase, ...(activeTab === "experience" ? tabItemActiveAdditions : {}) }}
        onClick={() => setActiveTab("experience")}
        aria-selected={activeTab === "experience"}
        role="tab"
        tabIndex={activeTab === "experience" ? 0 : -1}
      >
        <Box as="span" css={tabIconStyle}><FaListAlt /></Box>
        <Box as="span" css={tabLabelStyle}>{lang.current.heading.thePlan}</Box>
      </Box>

      {/* My Plan Tab(s) - Loading or Dropdown/Button */}
      {plansLoading ? (
        // Show loading state for plan tabs
        <Box as="button" type="button" css={tabItemBase} disabled>
          <Loading size="sm" variant="inline" showMessage={false} />
        </Box>
      ) : (
        (() => {
          // Debug log
          debug.log(
            "Rendering tabs. allPlans:",
            allPlans,
            "length:",
            allPlans.length
          );

          // Determine how many plans belong to others (collaborator plans)
          const otherPlansCount = allPlans.filter((plan) => {
            const planUserId = plan.user?._id || plan.user;
            return !idEquals(planUserId, user._id);
          }).length;

          // If there are multiple plans (user + collaborators OR multiple collaborators), show a custom dropdown
          if (allPlans.length > 1 || otherPlansCount > 0) {
            // Get the selected plan's display name
            const selectedPlan = allPlans.find(p => idEquals(p._id, selectedPlanId));

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
              <Box
                ref={dropdownRef}
                style={tabDropdownContainerStyle}
              >
                {/* Tab button - switches to My Plan tab without opening dropdown */}
                <Box
                  as="button"
                  type="button"
                  css={{ ...tabItemBase, ...tabItemWithDropdownAdditions, ...(activeTab === "myplan" ? tabItemActiveAdditions : {}) }}
                  onClick={() => {
                    // Clicking the tab should update the address bar to the selected plan
                    // even if a plan was already pre-selected.
                    const planIdToUse = ensurePlanSelected() || normalizeId(selectedPlanId);
                    if (planIdToUse) {
                      handlePlanChange(planIdToUse, { reason: 'tab-click/myplan' });
                    }
                    setActiveTab("myplan");
                    setDropdownOpen(false); // Close dropdown when switching tabs
                  }}
                  aria-selected={activeTab === "myplan"}
                  role="tab"
                  tabIndex={activeTab === "myplan" ? 0 : -1}
                >
                  <Box as="span" css={tabIconStyle}><FaUser /></Box>
                  <Box as="span" css={tabLabelStyle}>{selectedDisplayName}</Box>
                </Box>

                {/* Caret button - toggles dropdown */}
                <Box
                  as="button"
                  type="button"
                  css={{ ...caretButtonBase, ...((activeTab === 'myplan' || dropdownOpen) ? caretButtonActiveAdditions : {}) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  aria-label={lang.current.aria.togglePlansDropdown}
                  aria-expanded={dropdownOpen}
                >
                  {dropdownOpen ? <FaChevronUp /> : <FaChevronDown />}
                </Box>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <Box css={tabDropdownMenuStyle}>
                    {allPlans.map((plan, ci) => {
                      const planUserId = plan.user?._id || plan.user;
                      const isOwnPlan = idEquals(planUserId, user._id);
                      let displayName = "Plan";

                      if (isOwnPlan) {
                        displayName = "My Plan";
                      } else if (plan.user?.name) {
                        const firstName = plan.user.name.split(' ')[0];
                        displayName = `${firstName}'s Plan`;
                      }

                      const planId = normalizeId(plan._id);
                      const optionKey = planId != null ? planId : `plan-${ci}`;
                      const isSelected = idEquals(planId, selectedPlanId);

                      return (
                        <Box
                          as="button"
                          key={optionKey}
                          type="button"
                          css={{ ...tabDropdownItemBase, ...(isSelected ? tabDropdownItemSelectedAdditions : {}) }}
                          onClick={() => {
                            handlePlanChange(planId, { reason: 'dropdown/select-plan' });
                            setActiveTab("myplan");
                            setDropdownOpen(false);
                          }}
                        >
                          <span>{displayName}</span>
                          {isSelected && <FaCheck style={checkmarkStyle} />}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          }

          // Otherwise, render a simple button for the (single) user's plan
          if (allPlans.length === 1) {
            const onlyPlan = allPlans[0];
            const planUserId = onlyPlan.user?._id || onlyPlan.user;
            const isOwnPlan = idEquals(planUserId, user._id);
            // Only show the button if it's the user's own plan
            if (isOwnPlan) {
              return (
                <Box
                  as="button"
                  type="button"
                  css={{ ...tabItemBase, ...(activeTab === "myplan" ? tabItemActiveAdditions : {}) }}
                  onClick={() => {
                    const planId = normalizeId(onlyPlan._id);
                    setSelectedPlanId(planId);
                    handlePlanChange(planId, { reason: 'single-plan/click-myplan' }); // Ensure plan is set before switching tabs
                    setActiveTab("myplan");
                  }}
                  aria-selected={activeTab === "myplan"}
                  role="tab"
                  tabIndex={activeTab === "myplan" ? 0 : -1}
                >
                  <Box as="span" css={tabIconStyle}><FaUser /></Box>
                  <Box as="span" css={tabLabelStyle}>My Plan</Box>
                </Box>
              );
            }
          }

          // No plans available - render nothing
          return null;
        })()
      )}
    </Flex>
  );
}

export default memo(PlanTabsNavigation);
