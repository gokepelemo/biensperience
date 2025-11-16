import React, { useEffect, useState } from 'react';
import { Heading, Text, Button, Accordion } from '../design-system';
import { Stack, FlexBetween } from '../Layout/Layout';
import { getUserPlans } from '../../utilities/plans-api';
import { formatCurrency } from '../../utilities/currency-utils';
import { Link } from 'react-router-dom';

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
    <div style={{ height: '100%', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)' }}>
      <Heading level={4}>My Plans</Heading>
      <Text size="sm" className="mb-3">Your saved plans with progress and cost estimates</Text>

      {loading && <Text size="sm">Loading plans...</Text>}
      {!loading && plans.length === 0 && <Text size="sm">No plans yet. Plan an experience to get started.</Text>}

      {!loading && plans.length > 0 && (
        <Accordion defaultActiveKey={plans[0]._id} flush>
          {plans.map((plan) => (
            <Accordion.Item eventKey={plan._id} key={plan._id}>
              <Accordion.Header>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{plan.experience?.name || plan.experience}</div>
                    <div style={{ fontSize: '0.85em', color: 'var(--color-text-muted)' }}>{(plan.plan || []).length} items • {plan.completion_percentage || 0}% complete</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(plan.total_cost || 0)}</div>
                    <div style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>{plan.planned_date ? new Date(plan.planned_date).toLocaleDateString() : 'No date'}</div>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ height: '8px', background: 'var(--color-border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${plan.completion_percentage || 0}%`, height: '100%', background: 'var(--color-success)' }} />
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <Stack spacing="sm">
                    {(plan.plan || []).map((item) => (
                      <FlexBetween key={item.plan_item_id || item._id} style={{ alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.text}</div>
                          <div style={{ fontSize: '0.85em', color: 'var(--color-text-muted)' }}>{Number(item.cost) > 0 ? formatCurrency(item.cost) : ''}</div>
                        </div>
                        <div>
                          <Button as={Link} to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item.plan_item_id || item._id}`} variant="outline" size="sm">Open</Button>
                        </div>
                      </FlexBetween>
                    ))}
                  </Stack>

                  {plan.costs && plan.costs.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <Heading level={6}>Costs</Heading>
                      <Stack spacing="sm">
                        {plan.costs.map((c) => (
                          <FlexBetween key={c._1d || `${c.title}-${c.cost}`}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{c.title}</div>
                              <div style={{ fontSize: '0.85em', color: 'var(--color-text-muted)' }}>{c.description}</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>{formatCurrency(c.cost || 0, c.currency || 'USD')}</div>
                          </FlexBetween>
                        ))}
                      </Stack>
                    </div>
                  )}
                </div>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </div>
  );
}
