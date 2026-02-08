import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
 * Calendar Event Component - renders purple dot with tooltip
 * Memoized to prevent unnecessary re-renders and tooltip flashing
 */
const CalendarEvent = React.memo(({ event }) => {
  // Memoize tooltip content with stable dependencies
  const tooltipContent = React.useMemo(() => (
    <div className={styles.eventTooltip}>
      <span className={styles.eventTooltipTitle}>{event.title}</span>
      {event.isCollaborative && (
        <span className={styles.eventTooltipBadge}>
          <FaUsers size={10} /> {lang.current.planCalendar.shared}
        </span>
      )}
    </div>
  ), [event.title, event.isCollaborative]);

  // Memoize the event dot element to prevent re-creation
  const eventDotElement = React.useMemo(() => (
    <div
      className={`${styles.eventDot} ${event.isCollaborative ? styles.eventDotShared : ''}`}
      role="button"
      tabIndex={0}
      aria-label={event.title}
    />
  ), [event.title, event.isCollaborative]);

  return (
    <Tooltip content={tooltipContent} placement="top" delayHide={100}>
      {eventDotElement}
    </Tooltip>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if stable key changes
  return prevProps.event._stableKey === nextProps.event._stableKey;
});

CalendarEvent.displayName = 'CalendarEvent';

/**
 * Custom toolbar component extracted outside PlanCalendar
 * to maintain a stable component reference and prevent
 * react-big-calendar from re-mounting event components.
 */
const CustomToolbar = React.memo(({ label, onNavigate, onView, view }) => {
  // Use a ref to store the external handleViewChange callback
  // so the component identity stays stable across parent re-renders
  const handleViewChangeRef = React.useContext(ViewChangeContext);

  const changeView = useCallback((newView) => {
    onView(newView);
    handleViewChangeRef?.current?.(newView);
  }, [onView, handleViewChangeRef]);

  return (
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
          onClick={() => changeView('month')}
        >
          {lang.current.planCalendar.month}
        </button>
        <button
          type="button"
          className={`${styles.toolbarViewButton} ${view === 'week' ? styles.active : ''}`}
          onClick={() => changeView('week')}
        >
          {lang.current.planCalendar.week}
        </button>
        <button
          type="button"
          className={`${styles.toolbarViewButton} ${view === 'day' ? styles.active : ''}`}
          onClick={() => changeView('day')}
        >
          {lang.current.planCalendar.day}
        </button>
      </div>
    </div>
  );
});

CustomToolbar.displayName = 'CustomToolbar';

// Context to pass the view change handler ref to CustomToolbar
// without creating a new component reference
const ViewChangeContext = React.createContext(null);

/**
 * Suppress react-big-calendar's native browser tooltip (title attribute)
 * which conflicts with the Chakra tooltip and causes flashing.
 */
const noTooltip = () => null;

/**
 * PlanCalendar Component
 * Displays user plans in a calendar view with month/week/day navigation
 *
 * @param {Object} props
 * @param {Array} props.plans - Array of plan objects with planned_date
 * @param {string} props.className - Additional CSS class
 */
function PlanCalendarInner({ plans = [], className = '' }) {
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

  // Ref to pass handleViewChange to CustomToolbar via context
  // so the components object stays referentially stable
  const viewChangeRef = useRef(handleViewChange);
  viewChangeRef.current = handleViewChange;

  // Transform plans into calendar events - ensure stable object references
  const events = useMemo(() => {
    return plans
      .filter(plan => plan.planned_date)
      .map(plan => {
        // Create stable date object
        const plannedDate = new Date(plan.planned_date);
        const plannedTimestamp = plannedDate.getTime();

        // Create stable event object with frozen properties
        const event = {
          id: plan._id,
          title: plan.experience?.name || 'Unnamed Experience',
          start: plannedDate,
          end: plannedDate,
          allDay: true,
          resource: plan, // Keep plan reference for navigation
          isCollaborative: plan.isCollaborative,
          // Add stable key for React.memo comparison
          _stableKey: `${plan._id}-${plannedTimestamp}-${plan.isCollaborative}`,
        };

        // Freeze the event object to prevent mutations
        return Object.freeze(event);
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

  // Stable components object - never changes, preventing react-big-calendar
  // from re-mounting event components (which destroys tooltips and causes flash loops)
  const calendarComponents = useMemo(() => ({
    event: CalendarEvent,
    toolbar: CustomToolbar,
  }), []);

  return (
    <ViewChangeContext.Provider value={viewChangeRef}>
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
          components={calendarComponents}
          tooltipAccessor={noTooltip}
          popup
          selectable={false}
        />
      </div>
    </ViewChangeContext.Provider>
  );
}

const PlanCalendar = React.memo(PlanCalendarInner);
PlanCalendar.displayName = 'PlanCalendar';

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

export default PlanCalendar;
