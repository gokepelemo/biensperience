import React, { useEffect, useState } from 'react';
import {
  Heading,
  Text,
  Button,
  Accordion,
  Container,
  Stack,
  FlexBetween,
  FadeIn,
  SkeletonLoader,
  HashLink
} from '../design-system';
import { FaCheckCircle } from 'react-icons/fa';
import { getUserPlans } from '../../utilities/plans-api';
import { formatCurrency } from '../../utilities/currency-utils';

export default function MyPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

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
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <FadeIn>
      <Container
        className="my-plans-card"
        style={{
          height: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Heading level={4} className="mb-2">My Plans</Heading>
        <Text size="sm" variant="secondary" className="mb-4">
          Your saved plans with progress and cost estimates
        </Text>

        {loading && (
          <Stack spacing="3">
            <SkeletonLoader variant="text" width="100%" height="60px" />
            <SkeletonLoader variant="text" width="100%" height="60px" />
            <SkeletonLoader variant="text" width="100%" height="60px" />
          </Stack>
        )}

        {!loading && plans.length === 0 && (
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--color-border-medium)'
            }}
          >
            <Text size="base" variant="secondary">
              No plans yet. Plan an experience to get started.
            </Text>
          </div>
        )}

        {!loading && plans.length > 0 && (
          <Accordion defaultActiveKey={plans[0]._id} flush>
            {plans.map((plan) => (
              <Accordion.Item eventKey={plan._id} key={plan._id}>
                <Accordion.Header>
                  <FlexBetween style={{ width: '100%', gap: 'var(--space-4)' }}>
                    <div style={{ flex: 1 }}>
                      <Heading level={5} style={{ margin: 0 }}>
                        <HashLink
                          to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}`}
                          style={{
                            color: 'inherit',
                            textDecoration: 'none',
                            transition: 'color var(--transition-fast)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                        >
                          {plan.experience?.name || plan.experience}
                        </HashLink>
                      </Heading>
                      <Text size="sm" variant="secondary">
                        {(plan.plan || []).length} items • {plan.completion_percentage || 0}% complete
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 'fit-content', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
                      <Heading level={6} style={{ margin: 0 }}>
                        {formatCurrency(plan.total_cost || 0)}
                      </Heading>
                      <Text size="sm" variant="secondary">
                        {plan.planned_date ? new Date(plan.planned_date).toLocaleDateString() : 'No date'}
                      </Text>
                    </div>
                  </FlexBetween>
                </Accordion.Header>
                <Accordion.Body>
                  {/* Progress Bar */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div
                      style={{
                        height: '8px',
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${plan.completion_percentage || 0}%`,
                          height: '100%',
                          background: 'var(--gradient-primary)',
                          transition: 'width var(--transition-normal)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Plan Items */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 'var(--space-4)',
                      marginTop: 'var(--space-1)'
                    }}
                  >
                    {(plan.plan || []).map((item) => {
                      const isCompleted = item.complete || false;

                      return (
                      <div
                        key={item.plan_item_id || item._id}
                        style={{
                          padding: 'var(--space-5)',
                          background: isCompleted
                            ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(25, 135, 84, 0.05) 100%)'
                            : 'var(--color-bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          border: isCompleted
                            ? '2px solid var(--color-success)'
                            : '1px solid var(--color-border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-3)',
                          minHeight: '140px',
                          position: 'relative',
                          transition: 'all var(--transition-normal)',
                          transform: isCompleted ? 'scale(0.98)' : 'scale(1)',
                          opacity: isCompleted ? 0.85 : 1
                        }}
                      >
                        {/* Completion badge */}
                        {isCompleted && (
                          <div style={{
                            position: 'absolute',
                            top: 'var(--space-3)',
                            right: 'var(--space-3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-1) var(--space-3)',
                            background: 'var(--color-success)',
                            color: 'white',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-semibold)',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            <FaCheckCircle size={12} />
                            <span>Done</span>
                          </div>
                        )}

                        <div style={{ flex: 1, paddingRight: isCompleted ? 'var(--space-10)' : 0 }}>
                          <Text
                            weight="semibold"
                            className="mb-2"
                            style={{
                              lineHeight: '1.4',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              color: isCompleted ? 'var(--color-text-muted)' : 'inherit'
                            }}
                          >
                            {item.text}
                          </Text>
                          {Number(item.cost) > 0 && (
                            <Text size="sm" variant="secondary">
                              {formatCurrency(item.cost)}
                            </Text>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
                          <HashLink
                            to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item.plan_item_id || item._id}`}
                          >
                            <Button
                              variant="gradient"
                              size="sm"
                              rounded
                              style={{ minWidth: '100px' }}
                            >
                              Open
                            </Button>
                          </HashLink>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {/* Additional Costs */}
                  {plan.costs && plan.costs.length > 0 && (
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <Heading level={6} className="mb-3">Additional Costs</Heading>
                      <Stack spacing="2">
                        {plan.costs.map((c) => (
                          <FlexBetween
                            key={c._id || `${c.title}-${c.cost}`}
                            style={{
                              padding: 'var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--color-bg-tertiary)'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <Text weight="semibold">{c.title}</Text>
                              {c.description && (
                                <Text size="sm" variant="secondary">{c.description}</Text>
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
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Container>
    </FadeIn>
  );
}
