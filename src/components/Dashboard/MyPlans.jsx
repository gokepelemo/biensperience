import React, { useEffect, useState } from 'react';
import {
  Heading,
  Text,
  Button,
  Container,
  Stack,
  FlexBetween,
  FadeIn,
  SkeletonLoader,
  HashLink
} from '../design-system';
import { FaCheckCircle, FaCalendar, FaTasks, FaChevronRight } from 'react-icons/fa';
import { getUserPlans } from '../../utilities/plans-api';
import { formatCurrency } from '../../utilities/currency-utils';
import './MyPlans.css';

export default function MyPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const resp = await getUserPlans();
        if (!mounted) return;
        // API may return { data: [...] } or an array
        const list = (resp && resp.data) ? resp.data : (Array.isArray(resp) ? resp : (resp?.plans || []));
        setPlans(list);
        // Auto-expand first plan only (default collapsed state)
        if (list.length > 0) {
          setExpandedPlanId(list[0]._id);
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Listen for plan updates (e.g., plan item completion changes)
  useEffect(() => {
    const handlePlanUpdated = (event) => {
      const { plan } = event.detail || {};
      if (!plan || !plan._id) return;

      // Update the plan in local state with fresh data from server
      setPlans((prevPlans) => {
        return prevPlans.map((p) => {
          if (p._id === plan._id) {
            // Merge updated plan data, ensuring we keep the virtual properties
            return {
              ...p,
              ...plan,
              // Ensure completion_percentage is updated
              completion_percentage: plan.completion_percentage !== undefined
                ? plan.completion_percentage
                : p.completion_percentage
            };
          }
          return p;
        });
      });
    };

    window.addEventListener('plan:updated', handlePlanUpdated);
    return () => window.removeEventListener('plan:updated', handlePlanUpdated);
  }, []);

  const togglePlan = (planId) => {
    // If clicking already expanded plan, collapse it
    // Otherwise, expand the clicked plan (collapsing any other)
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  return (
    <FadeIn>
      <div
        className="my-plans-card"
        style={{
          width: '100%',
          height: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Heading level={4} className="mb-2">My Plans</Heading>
        <Text size="sm" variant="muted" className="mb-4">
          Your saved plans with progress and cost estimates
        </Text>

        {loading && (
          <Stack spacing="md">
            <SkeletonLoader variant="text" width="100%" height="80px" />
            <SkeletonLoader variant="text" width="100%" height="80px" />
            <SkeletonLoader variant="text" width="100%" height="80px" />
          </Stack>
        )}

        {!loading && plans.length === 0 && (
          <div className="empty-state">
            <Text size="base" variant="muted">
              No plans yet. Plan an experience to get started.
            </Text>
          </div>
        )}

        {!loading && plans.length > 0 && (
          <Stack spacing="md">
            {plans.map((plan) => {
              const isExpanded = expandedPlanId === plan._id;
              const itemCount = (plan.plan || []).length;
              const completedCount = (plan.plan || []).filter(item => item.complete).length;

              // Debug logging
              console.log('Plan Progress Debug:', {
                planId: plan._id,
                experienceName: plan.experience?.name,
                itemCount,
                completedCount,
                serverPercentage: plan.completion_percentage,
                localPercentage: itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0,
                items: (plan.plan || []).map(item => ({
                  text: item.text?.substring(0, 30),
                  complete: item.complete
                }))
              });

              // Use server-calculated completion percentage (virtual property)
              // Fallback to local calculation if not available
              const completionPercentage = plan.completion_percentage !== undefined
                ? plan.completion_percentage
                : (itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0);

              return (
                <div
                  key={plan._id}
                  className={`plan-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => togglePlan(plan._id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} plan for ${plan.experience?.name || 'Unnamed Experience'}`}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePlan(plan._id);
                    }
                  }}
                >
                  {/* Plan Header - Always Visible */}
                  <div className="plan-header">
                    <div className="plan-header-content">
                      <div className="plan-title-section">
                        <Heading level={5} className="plan-title">
                          {plan.experience?.name || 'Unnamed Experience'}
                        </Heading>
                        <div className="plan-meta">
                          <span className="meta-item">
                            <FaTasks size={12} />
                            {completedCount}/{itemCount} items
                          </span>
                          {plan.planned_date && (
                            <span className="meta-item">
                              <FaCalendar size={12} />
                              {new Date(plan.planned_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="plan-header-right">
                        <div className="plan-cost">
                          <Text weight="bold" size="lg">
                            {formatCurrency(plan.total_cost || 0)}
                          </Text>
                        </div>
                        <div className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>
                          <FaChevronRight size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-bar-container">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${completionPercentage}%` }}
                          role="progressbar"
                          aria-valuenow={completionPercentage}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        />
                      </div>
                      <Text size="xs" variant="muted" className="progress-text">
                        {completionPercentage}% complete
                      </Text>
                    </div>
                  </div>

                  {/* Plan Body - Collapsible */}
                  {isExpanded && (
                    <div className="plan-body">
                      {/* Plan Items Grid */}
                      <div className="plan-items-grid">
                        {(plan.plan || []).map((item) => {
                          const isCompleted = item.complete || false;
                          const itemLink = `/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item.plan_item_id || item._id}`;

                          return (
                            <HashLink
                              key={item.plan_item_id || item._id}
                              to={itemLink}
                              className={`plan-item ${isCompleted ? 'completed' : ''}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Completion Badge */}
                              {isCompleted && (
                                <div className="completion-badge">
                                  <FaCheckCircle size={12} />
                                  <span>Done</span>
                                </div>
                              )}

                              {/* Item Content */}
                              <div className="item-content">
                                <Text
                                  weight="semibold"
                                  className="item-text"
                                  style={{
                                    textDecoration: isCompleted ? 'line-through' : 'none',
                                    color: isCompleted ? 'var(--color-text-muted)' : 'inherit'
                                  }}
                                >
                                  {item.text}
                                </Text>
                                {Number(item.cost) > 0 && (
                                  <Text size="sm" variant="muted" className="item-cost">
                                    {formatCurrency(item.cost)}
                                  </Text>
                                )}
                              </div>
                            </HashLink>
                          );
                        })}
                      </div>

                      {/* Additional Costs */}
                      {plan.costs && plan.costs.length > 0 && (
                        <div className="additional-costs">
                          <Heading level={6} className="mb-3">Additional Costs</Heading>
                          <Stack spacing="sm">
                            {plan.costs.map((c) => (
                              <FlexBetween
                                key={c._id || `${c.title}-${c.cost}`}
                                className="cost-item"
                              >
                                <div className="cost-info">
                                  <Text weight="semibold">{c.title}</Text>
                                  {c.description && (
                                    <Text size="sm" variant="muted">{c.description}</Text>
                                  )}
                                </div>
                                <Text weight="semibold">
                                  {formatCurrency(c.cost || 0, c.currency || 'USD')}
                                </Text>
                              </FlexBetween>
                            ))}
                          </Stack>
                        </div>
                      )}

                      {/* View Full Experience Button */}
                      <div className="plan-footer">
                        <HashLink to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}`}>
                          <Button variant="outline" size="md" style={{ width: '100%' }}>
                            View Full Experience
                          </Button>
                        </HashLink>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Stack>
        )}
      </div>
    </FadeIn>
  );
}
