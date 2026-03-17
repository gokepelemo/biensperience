/**
 * PlanTabsNavigation Component
 * Displays tab navigation for Experience Plan vs My Plan with dropdown for multiple plans
 * Uses Chakra UI Tabs for the base tab structure.
 *
 * Wrapped with React.memo to prevent unnecessary re-renders - this component
 * only needs to re-render when tab/plan selection or plans list changes.
 */

import { memo, useState, useEffect, useRef } from 'react';
import { FaListAlt, FaUser, FaChevronDown, FaChevronUp, FaCheck, FaRss } from 'react-icons/fa';
import { Tabs, Box, Flex, NativeSelect } from '@chakra-ui/react';
import Loading from '../../../components/Loading/Loading';
import debug from '../../../utilities/debug';
import { lang } from '../../../lang.constants';
import { idEquals, normalizeId } from '../../../utilities/id-utils';

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

  // Determine if My Plan tab should show
  const hasPlans = !plansLoading && allPlans.length > 0;
  const hasMultiplePlans = allPlans.length > 1 || allPlans.filter((plan) => {
    const planUserId = plan.user?._id || plan.user;
    return !idEquals(planUserId, user._id);
  }).length > 0;

  // Get the selected plan's display name for multi-plan dropdown
  const getSelectedDisplayName = () => {
    if (!hasMultiplePlans) return 'My Plan';
    const selectedPlan = allPlans.find(p => idEquals(p._id, selectedPlanId));
    if (!selectedPlan) return 'Plans';
    const planUserId = selectedPlan.user?._id || selectedPlan.user;
    const isOwnPlan = idEquals(planUserId, user._id);
    if (isOwnPlan) return 'My Plan';
    if (selectedPlan.user?.name) {
      const firstName = selectedPlan.user.name.split(' ')[0];
      return `${firstName}'s Plan`;
    }
    return 'Plan';
  };

  // Check if single plan belongs to user
  const singlePlanIsOwn = () => {
    if (allPlans.length !== 1) return false;
    const planUserId = allPlans[0].user?._id || allPlans[0].user;
    return idEquals(planUserId, user._id);
  };

  // Dropdown menu styles
  const dropdownMenuStyle = {
    position: 'absolute', top: 'calc(100% + 4px)', left: '50%',
    transform: 'translateX(-50%)', zIndex: 100, minWidth: '160px',
    padding: 'var(--space-2) 0', background: 'var(--color-bg-primary, #ffffff)',
    backgroundColor: 'var(--color-bg-primary, #ffffff)',
    border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
  };
  const dropdownItemBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
    transition: 'background-color var(--transition-fast), color var(--transition-fast)',
    '&:hover': { background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' },
  };
  const dropdownItemSelectedAdditions = {
    color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)',
    '&:hover': { color: 'var(--color-primary)' },
  };
  const checkmarkStyle = {
    marginLeft: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-primary)',
  };

  debug.log('Rendering tabs. allPlans:', allPlans, 'length:', allPlans.length);

  // Determine if the My Plan tab should render at all
  const showMyPlanTab = plansLoading || (hasPlans && (hasMultiplePlans || singlePlanIsOwn()));

  // Build the current select value for mobile dropdown.
  // For multi-plan, encode the plan ID into the value so each plan is a distinct option.
  const getMobileSelectValue = () => {
    if (activeTab === 'myplan' && hasMultiplePlans && selectedPlanId) {
      return `myplan:${normalizeId(selectedPlanId)}`;
    }
    return activeTab;
  };

  // Handle mobile select change
  const handleMobileSelectChange = (e) => {
    const value = e.target.value;

    if (value === 'activity' || value === 'experience') {
      setActiveTab(value);
      return;
    }

    if (value === 'myplan') {
      const planIdToUse = ensurePlanSelected() || normalizeId(selectedPlanId);
      if (planIdToUse) {
        handlePlanChange(planIdToUse, { reason: 'mobile-select/myplan' });
      }
      setActiveTab('myplan');
      return;
    }

    // Multi-plan selection: value is "myplan:<planId>"
    if (value.startsWith('myplan:')) {
      const planId = value.replace('myplan:', '');
      handlePlanChange(planId, { reason: 'mobile-select/select-plan' });
      setSelectedPlanId(planId);
      setActiveTab('myplan');
    }
  };

  // Get display name for a plan (used by both mobile select and desktop dropdown)
  const getPlanDisplayName = (plan) => {
    const planUserId = plan.user?._id || plan.user;
    const isOwnPlan = idEquals(planUserId, user._id);
    if (isOwnPlan) return 'My Plan';
    if (plan.user?.name) {
      const firstName = plan.user.name.split(' ')[0];
      return `${firstName}'s Plan`;
    }
    return 'Plan';
  };

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(e) => {
        const newTab = e.value;
        if (newTab === 'myplan') {
          const planIdToUse = ensurePlanSelected() || normalizeId(selectedPlanId);
          if (planIdToUse) {
            handlePlanChange(planIdToUse, { reason: 'tab-click/myplan' });
          }
          setDropdownOpen(false);
        }
        setActiveTab(newTab);
      }}
      variant="line"
      fitted={false}
      mb="6"
    >
      {/* Mobile/Tablet: Native select dropdown (hidden on md+) */}
      <Box display={{ base: 'block', md: 'none' }} mb="2">
        <NativeSelect.Root size="md" variant="outline">
          <NativeSelect.Field
            aria-label={lang.current.aria.planTabs}
            value={getMobileSelectValue()}
            onChange={handleMobileSelectChange}
            css={{
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              borderColor: 'var(--color-border-light)',
              '&:focus': { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' },
            }}
          >
            <option value="activity">Activity</option>
            <option value="experience">{lang.current.heading.thePlan}</option>
            {plansLoading ? (
              <option value="myplan" disabled>Loading plans...</option>
            ) : showMyPlanTab && hasMultiplePlans ? (
              allPlans.map((plan, ci) => {
                const planId = normalizeId(plan._id);
                const optionKey = planId != null ? planId : `plan-${ci}`;
                return (
                  <option key={optionKey} value={`myplan:${planId}`}>
                    {getPlanDisplayName(plan)}
                  </option>
                );
              })
            ) : showMyPlanTab ? (
              <option value="myplan">My Plan</option>
            ) : null}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

      {/* Desktop: Tab triggers (hidden below md) */}
      <Tabs.List aria-label={lang.current.aria.planTabs} display={{ base: 'none', md: 'flex' }}>
        {/* Activity Tab */}
        <Tabs.Trigger value="activity">
          <FaRss />
          Activity
        </Tabs.Trigger>

        {/* The Plan Tab */}
        <Tabs.Trigger value="experience">
          <FaListAlt />
          {lang.current.heading.thePlan}
        </Tabs.Trigger>

        {/* My Plan Tab(s) */}
        {plansLoading ? (
          <Tabs.Trigger value="myplan" disabled>
            <Loading size="sm" variant="inline" showMessage={false} />
          </Tabs.Trigger>
        ) : showMyPlanTab && hasMultiplePlans ? (
          /* Multi-plan: tab trigger + caret dropdown */
          <Flex ref={dropdownRef} position="relative" align="center">
            <Tabs.Trigger value="myplan" css={{ paddingRight: 'var(--space-2)' }}>
              <FaUser />
              {getSelectedDisplayName()}
            </Tabs.Trigger>

            {/* Caret button for dropdown */}
            <Box
              as="button"
              type="button"
              css={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-2)', background: 'transparent', border: 'none',
                borderBottom: '2px solid transparent', cursor: 'pointer',
                color: activeTab === 'myplan' || dropdownOpen ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                marginBottom: '-1px',
                transition: 'color var(--transition-fast), border-color var(--transition-fast)',
                '&:hover': { color: 'var(--color-text-primary)', borderBottomColor: 'var(--color-border-medium)' },
                '& svg': { width: '0.75rem', height: '0.75rem' },
              }}
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
              <Box css={dropdownMenuStyle} bg="var(--color-bg-primary, #ffffff)">
                {allPlans.map((plan, ci) => {
                  const planId = normalizeId(plan._id);
                  const optionKey = planId != null ? planId : `plan-${ci}`;
                  const isSelected = idEquals(planId, selectedPlanId);

                  return (
                    <Box
                      as="button"
                      key={optionKey}
                      type="button"
                      css={{ ...dropdownItemBase, ...(isSelected ? dropdownItemSelectedAdditions : {}) }}
                      onClick={() => {
                        handlePlanChange(planId, { reason: 'dropdown/select-plan' });
                        setActiveTab('myplan');
                        setDropdownOpen(false);
                      }}
                    >
                      <span>{getPlanDisplayName(plan)}</span>
                      {isSelected && <FaCheck style={checkmarkStyle} />}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Flex>
        ) : showMyPlanTab ? (
          /* Single plan: simple tab trigger */
          <Tabs.Trigger
            value="myplan"
            onClick={() => {
              const onlyPlan = allPlans[0];
              const planId = normalizeId(onlyPlan._id);
              setSelectedPlanId(planId);
              handlePlanChange(planId, { reason: 'single-plan/click-myplan' });
            }}
          >
            <FaUser />
            My Plan
          </Tabs.Trigger>
        ) : null}
      </Tabs.List>
    </Tabs.Root>
  );
}

export default memo(PlanTabsNavigation);
