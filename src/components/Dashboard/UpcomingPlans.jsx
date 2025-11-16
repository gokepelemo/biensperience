import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Button } from 'react-bootstrap';
import { getUpcomingPlans } from '../../utilities/dashboard-api';
import { Link } from 'react-router-dom';
import { FaCalendar } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';

/**
 * UpcomingPlans component for displaying user's upcoming travel plans
 * Shows a list of plans with dates
 */
export default function UpcomingPlans({ plans = [], title = "Upcoming Plans", pageSize = 5 }) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [serverPlans, setServerPlans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, totalPages: 1, totalCount: 0 });
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // If `plans` prop is provided (from initial dashboard payload), use it as page 1 seed
  useEffect(() => {
    if (plans && plans.length > 0 && pagination.page === 1 && serverPlans.length === 0) {
      setServerPlans(plans.slice(0, pageSize));
      setPagination(prev => ({ ...prev, totalCount: plans.length, totalPages: Math.max(1, Math.ceil(plans.length / pageSize)) }));
    }
  }, [plans, pageSize, pagination.page, serverPlans.length]);

  // Load page from server (supports infinite scroll append)
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await getUpcomingPlans(page, pageSize);
        if (!mounted) return;
        // Replace results for any page load (server-side pagination)
        setServerPlans(resp.plans || []);
        setPagination(resp.pagination || { page, limit: pageSize, totalPages: 1, totalCount: resp.plans?.length || 0, hasMore: false, numPages: resp.pagination?.totalPages || resp.pagination?.numPages });
      } catch (err) {
        setError('Failed to load upcoming plans');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [page, pageSize]);

  // Scroll to top of list when page changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try { el.scrollTop = 0; } catch (e) { /* ignore */ }
  }, [page]);

  // Date helpers: format relative date and exact date for hover
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const formatExactDate = (d) => {
    try {
      const dt = new Date(d);
      const opts = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Intl.DateTimeFormat(undefined, opts).format(dt);
    } catch (e) {
      return d;
    }
  };

  const formatRelativeDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;

    const today = startOfDay(new Date());
    const target = startOfDay(dt);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.round((target - today) / msPerDay);

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const abs = Math.abs(diff);

    const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

    // Short ranges in days
    if (abs <= 7) return diff > 0 ? `In ${diff} days` : `${abs} days ago`;

    // Months logic (approximate month = 30 days)
    if (abs < 365) {
      const monthsFloat = abs / 30;
      if (monthsFloat >= 1.5) {
        const monthsRounded = Math.round(monthsFloat);
        return diff > 0 ? `In about ${monthsRounded} month${monthsRounded === 1 ? '' : 's'}` : `about ${monthsRounded} month${monthsRounded === 1 ? '' : 's'} ago`;
      }

      if (monthsFloat >= 1) {
        const months = Math.floor(monthsFloat);
        const days = abs - months * 30;
        const monthsPart = plural(months, 'month');
        const daysPart = days > 0 ? `, ${plural(days, 'day')}` : '';
        return diff > 0 ? `In ${monthsPart}${daysPart}` : `${monthsPart}${daysPart} ago`;
      }

      // fallback to days for 8-29 days
      return diff > 0 ? `In ${abs} days` : `${abs} days ago`;
    }

    // Years logic
    const yearsFloat = abs / 365;
    if (yearsFloat >= 1.5) {
      const yearsRounded = Math.round(yearsFloat);
      return diff > 0 ? `In about ${yearsRounded} year${yearsRounded === 1 ? '' : 's'}` : `about ${yearsRounded} year${yearsRounded === 1 ? '' : 's'} ago`;
    }

    if (yearsFloat >= 1) {
      const years = Math.floor(yearsFloat);
      const remainingDays = abs - years * 365;
      const months = Math.floor(remainingDays / 30);
      const yearsPart = plural(years, 'year');
      const monthsPart = months > 0 ? `, ${plural(months, 'month')}` : '';
      return diff > 0 ? `In ${yearsPart}${monthsPart}` : `${yearsPart}${monthsPart} ago`;
    }

    return formatExactDate(d);
  };

  return (
    <Card style={{
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-6)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Heading level={3} style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        {title}
      </Heading>

      <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Loading upcoming plans...</div>
        ) : (
          serverPlans && serverPlans.length > 0 ? (
            <>
              {serverPlans.map((plan) => (
                <div key={plan.id || plan._id || `${plan.title}-${plan.date}`} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-light)'
                }}>
                  <div>
                    {plan.experienceId ? (
                      <Link to={`/experiences/${plan.experienceId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {plan.title}
                      </Link>
                    ) : plan.title}
                  </div>

                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)'
                  }}>
                    <FaCalendar />
                    {(() => {
                      const exact = formatExactDate(plan.date);
                      const rel = (formatRelativeDate(plan.date) || exact).toString();
                      const relLower = rel.toLowerCase();
                      return (
                        <span title={exact} aria-label={`${relLower} — ${exact}`}>
                          {relLower}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}

              {/* Pagination controls placed at end of scrollable content so they appear after the list */}
              {(pagination.numPages || pagination.totalPages) > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)', paddingBottom: 'var(--space-4)' }}>
                  <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {page}/{pagination.numPages || pagination.totalPages}
                  </div>
                  <Button size="sm" variant="outline-secondary" disabled={page >= (pagination.numPages || pagination.totalPages)} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-4)',
              color: 'var(--color-text-muted)',
            }}>
              <FaCalendar size={24} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
              <div>No upcoming plans</div>
            </div>
          )
        )}
      </div>

      {/* Single pagination is rendered inside the scrollable list above */}
    </Card>
  );
}

  function renderPageButtons(totalPages, currentPage, onClick) {
    const buttons = [];
    const maxButtons = 7;

    const addButton = (p) => buttons.push(
      <Button key={p} size="sm" variant={p === currentPage ? 'primary' : 'outline-secondary'} onClick={() => onClick(p)}>
        {p}
      </Button>
    );

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) addButton(i);
    } else {
      addButton(1);
      let start = Math.max(2, currentPage - 2);
      let end = Math.min(totalPages - 1, currentPage + 2);

      if (start > 2) buttons.push(<span key="dots-start" style={{ alignSelf: 'center' }}>...</span>);

      for (let i = start; i <= end; i++) addButton(i);

      if (end < totalPages - 1) buttons.push(<span key="dots-end" style={{ alignSelf: 'center' }}>...</span>);

      addButton(totalPages);
    }

    return <div style={{ display: 'flex', gap: 'var(--space-2)' }}>{buttons}</div>;
  }

UpcomingPlans.propTypes = {
  plans: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    experienceId: PropTypes.any,
    title: PropTypes.string,
    date: PropTypes.string,
  })),
  title: PropTypes.string,
  pageSize: PropTypes.number,
};