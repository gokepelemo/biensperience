import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useNavigate } from 'react-router-dom';
import { FaUsers } from 'react-icons/fa';
import Tooltip from '../../Tooltip/Tooltip';
import { useUIPreference } from '../../../hooks/useUIPreference';
import { lang } from '../../../lang.constants';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './PlanCalendar.module.scss';

// Setup date-fns localizer for react-big-calendar
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

/**
 * PlanCalendar Component
 * Displays user plans in a calendar view with month/week/day navigation
 *
 * @param {Object} props
 * @param {Array} props.plans - Array of plan objects with planned_date
 * @param {string} props.className - Additional CSS class
 */
export default function PlanCalendar({ plans = [], className = '' }) {
  const navigate = useNavigate();

  // Store calendar view preference (month/week/day)
  const [calendarView, setCalendarView] = useUIPreference('viewMode.calendarView', 'month');
  const [currentView, setCurrentView] = useState('month');

  // Sync preference to state on load
  useEffect(() => {
    if (calendarView && calendarView !== currentView) {
      setCurrentView(calendarView);
    }
  }, [calendarView]);

  // Handle view change - persist to preferences
  const handleViewChange = useCallback((newView) => {
    setCurrentView(newView);
    setCalendarView(newView);
  }, [setCalendarView]);

  // Transform plans into calendar events
  const events = useMemo(() => {
    return plans
      .filter(plan => plan.planned_date)
      .map(plan => {
        const plannedDate = new Date(plan.planned_date);
        return {
          id: plan._id,
          title: plan.experience?.name || 'Unnamed Experience',
          start: plannedDate,
          end: plannedDate,
          allDay: true,
          resource: plan,
          isCollaborative: plan.isCollaborative,
        };
      });
  }, [plans]);

  // Handle event click - navigate to experience with plan hash
  const handleSelectEvent = useCallback((event) => {
    const plan = event.resource;
    const experienceId = plan.experience?._id || plan.experience;
    if (experienceId) {
      navigate(`/experiences/${experienceId}#plan-${plan._id}`);
    }
  }, [navigate]);

  // Custom event styling - minimal styling since we render dots
  const eventStyleGetter = useCallback(() => {
    return {
      style: {
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
      },
    };
  }, []);

  // Custom event component - renders purple dot with tooltip
  // Memoized to prevent unnecessary re-renders and tooltip flashing
  const EventComponent = useCallback(({ event }) => {
    // Memoize tooltip content to prevent re-creation on every render
    const tooltipContent = useMemo(() => (
      <div className={styles.eventTooltip}>
        <span className={styles.eventTooltipTitle}>{event.title}</span>
        {event.isCollaborative && (
          <span className={styles.eventTooltipBadge}>
            <FaUsers size={10} /> {lang.current.planCalendar.shared}
          </span>
        )}
      </div>
    ), [event.title, event.isCollaborative]);

    return (
      <Tooltip content={tooltipContent} placement="top">
        <div
          className={`${styles.eventDot} ${event.isCollaborative ? styles.eventDotShared : ''}`}
          role="button"
          tabIndex={0}
          aria-label={event.title}
        />
      </Tooltip>
    );
  }, []);

  // Custom toolbar component with design system styling
  const CustomToolbar = useCallback(({ label, onNavigate, onView, view }) => (
    <div className={styles.calendarToolbar}>
      <div className={styles.toolbarNavigation}>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() => onNavigate('TODAY')}
        >
          {lang.current.planCalendar.today}
        </button>
        <button
          type="button"
          className={styles.toolbarButtonIcon}
          onClick={() => onNavigate('PREV')}
          aria-label={lang.current.planCalendar.previousAria}
        >
          &lt;
        </button>
        <button
          type="button"
          className={styles.toolbarButtonIcon}
          onClick={() => onNavigate('NEXT')}
          aria-label={lang.current.planCalendar.nextAria}
        >
          &gt;
        </button>
      </div>
      <span className={styles.toolbarLabel}>{label}</span>
      <div className={styles.toolbarViews}>
        <button
          type="button"
          className={`${styles.toolbarViewButton} ${view === 'month' ? styles.active : ''}`}
          onClick={() => {
            onView('month');
            handleViewChange('month');
          }}
        >
          {lang.current.planCalendar.month}
        </button>
        <button
          type="button"
          className={`${styles.toolbarViewButton} ${view === 'week' ? styles.active : ''}`}
          onClick={() => {
            onView('week');
            handleViewChange('week');
          }}
        >
          {lang.current.planCalendar.week}
        </button>
        <button
          type="button"
          className={`${styles.toolbarViewButton} ${view === 'day' ? styles.active : ''}`}
          onClick={() => {
            onView('day');
            handleViewChange('day');
          }}
        >
          {lang.current.planCalendar.day}
        </button>
      </div>
    </div>
  ), [handleViewChange]);

  return (
    <div className={`${styles.calendarContainer} ${className}`}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        view={currentView}
        onView={handleViewChange}
        components={{
          event: EventComponent,
          toolbar: CustomToolbar,
        }}
        popup
        selectable={false}
      />
    </div>
  );
}

PlanCalendar.propTypes = {
  plans: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    planned_date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    experience: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        _id: PropTypes.string,
        name: PropTypes.string,
      }),
    ]),
    isCollaborative: PropTypes.bool,
  })),
  className: PropTypes.string,
};
