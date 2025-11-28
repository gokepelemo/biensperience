/**
 * MetricsBar Stories
 * Storybook stories for the MetricsBar component.
 */

import React from 'react';
import { FaCalendarAlt, FaClock, FaDollarSign, FaCheckCircle, FaPlane } from 'react-icons/fa';
import MetricsBar, { MetricItem } from './MetricsBar';

export default {
  title: 'Components/MetricsBar',
  component: MetricsBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Responsive metrics display component. Shows as horizontal bar on desktop and stacked cards on mobile/tablet.',
      },
    },
  },
  argTypes: {
    compact: {
      control: { type: 'boolean' },
      description: 'Enable compact mode with reduced padding',
    },
    bordered: {
      control: { type: 'boolean' },
      description: 'Show borders between metric items',
    },
  },
};

// Basic usage with emoji icons
export const Basic = {
  name: 'Basic (Emoji Icons)',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'Planned Date',
          type: 'date',
          value: new Date('2025-12-15'),
          icon: '📅',
        },
        {
          title: 'Completion',
          type: 'completion',
          value: 45,
          icon: '✅',
          color: 'primary',
        },
        {
          title: 'Total Cost',
          type: 'cost',
          value: 1250,
          icon: '💰',
        },
        {
          title: 'Planning Time',
          type: 'days',
          value: 19,
          icon: '⏱️',
          footer: 'until trip',
        },
      ]}
    />
  ),
};

// With FontAwesome icons
export const WithFaIcons = {
  name: 'FontAwesome Icons',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'Planned Date',
          type: 'date',
          value: new Date('2025-12-15'),
          icon: <FaCalendarAlt />,
        },
        {
          title: 'Completion',
          type: 'completion',
          value: 75,
          icon: <FaCheckCircle />,
          color: 'success',
        },
        {
          title: 'Total Cost',
          type: 'cost',
          value: 2500,
          icon: <FaDollarSign />,
        },
        {
          title: 'Days Left',
          type: 'string',
          value: '19 days',
          icon: <FaClock />,
          footer: 'until trip',
        },
      ]}
    />
  ),
};

// String-based FA icon names
export const StringFaIcons = {
  name: 'String-based FA Icons',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'Calendar',
          type: 'date',
          value: new Date(),
          icon: 'calendar-alt',
        },
        {
          title: 'Check',
          type: 'completion',
          value: 100,
          icon: 'check-circle',
          color: 'success',
        },
        {
          title: 'Money',
          type: 'cost',
          value: 500,
          icon: 'dollar-sign',
        },
        {
          title: 'Time',
          type: 'days',
          value: 7,
          icon: 'clock',
        },
      ]}
    />
  ),
};

// Compact variant
export const Compact = {
  name: 'Compact Mode',
  render: () => (
    <MetricsBar
      compact
      metrics={[
        {
          title: 'Date',
          type: 'date',
          value: new Date('2025-12-15'),
        },
        {
          title: 'Progress',
          type: 'completion',
          value: 45,
        },
        {
          title: 'Cost',
          type: 'cost',
          value: 1250,
        },
        {
          title: 'Days',
          type: 'days',
          value: 19,
        },
      ]}
    />
  ),
};

// Color variants
export const ColorVariants = {
  name: 'Color Variants',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'On Track',
          type: 'completion',
          value: 85,
          icon: '✅',
          color: 'success',
        },
        {
          title: 'Budget',
          type: 'completion',
          value: 75,
          icon: '💰',
          color: 'warning',
        },
        {
          title: 'Overdue',
          type: 'completion',
          value: 30,
          icon: '⚠️',
          color: 'danger',
        },
        {
          title: 'Progress',
          type: 'completion',
          value: 60,
          icon: '📊',
          color: 'primary',
        },
      ]}
    />
  ),
};

// With action buttons
export const WithActions = {
  name: 'With Action Buttons',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'Planned Date',
          type: 'date',
          value: new Date('2025-12-15'),
          icon: '📅',
          action: <button className="btn btn-sm btn-outline-primary">Edit</button>,
        },
        {
          title: 'Completion',
          type: 'completion',
          value: 45,
          icon: '✅',
          color: 'primary',
        },
        {
          title: 'Total Cost',
          type: 'cost',
          value: 1250,
          icon: '💰',
          action: <button className="btn btn-sm btn-outline-secondary">Details</button>,
        },
        {
          title: 'Planning Time',
          type: 'days',
          value: 7,
          icon: '⏱️',
        },
      ]}
    />
  ),
};

// Clickable metrics
export const Clickable = {
  name: 'Clickable Metrics',
  render: () => (
    <MetricsBar
      metrics={[
        {
          title: 'Set Date',
          type: 'string',
          value: 'Click to set',
          icon: '📅',
          onClick: () => alert('Date picker would open'),
        },
        {
          title: 'View Details',
          type: 'completion',
          value: 45,
          icon: '📊',
          color: 'primary',
          onClick: () => alert('Details modal would open'),
        },
        {
          title: 'Add Cost',
          type: 'string',
          value: 'Track expense',
          icon: '💰',
          onClick: () => alert('Add cost modal would open'),
        },
        {
          title: 'Schedule',
          type: 'string',
          value: 'Plan timing',
          icon: '⏱️',
          onClick: () => alert('Schedule modal would open'),
        },
      ]}
    />
  ),
};

// Different metric types
export const MetricTypes = {
  name: 'All Metric Types',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 style={{ marginBottom: '1rem' }}>Date Type</h4>
        <MetricsBar
          metrics={[
            { title: 'Today', type: 'date', value: new Date(), icon: '📅' },
            { title: 'Future', type: 'date', value: new Date('2025-12-25'), icon: '🎄' },
            { title: 'Past', type: 'date', value: new Date('2024-01-01'), icon: '📆' },
          ]}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem' }}>Cost Type</h4>
        <MetricsBar
          metrics={[
            { title: 'Small', type: 'cost', value: 50, icon: '💵' },
            { title: 'Medium', type: 'cost', value: 500, icon: '💰' },
            { title: 'Large', type: 'cost', value: 5000, icon: '🏦' },
          ]}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem' }}>Days Type</h4>
        <MetricsBar
          metrics={[
            { title: 'Hours', type: 'days', value: 0.5, icon: '⏰' },
            { title: 'Days', type: 'days', value: 3, icon: '📅' },
            { title: 'Weeks', type: 'days', value: 14, icon: '📆' },
          ]}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem' }}>Completion Type</h4>
        <MetricsBar
          metrics={[
            { title: 'Starting', type: 'completion', value: 10, icon: '🚀', color: 'danger' },
            { title: 'In Progress', type: 'completion', value: 50, icon: '⚙️', color: 'primary' },
            { title: 'Almost Done', type: 'completion', value: 85, icon: '🎯', color: 'warning' },
            { title: 'Complete', type: 'completion', value: 100, icon: '✅', color: 'success' },
          ]}
        />
      </div>

      <div>
        <h4 style={{ marginBottom: '1rem' }}>String Type</h4>
        <MetricsBar
          metrics={[
            { title: 'Status', type: 'string', value: 'Active', icon: '🟢' },
            { title: 'Location', type: 'string', value: 'Tokyo', icon: '📍' },
            { title: 'Category', type: 'string', value: 'Adventure', icon: '🏔️' },
          ]}
        />
      </div>
    </div>
  ),
};

// Empty/null values
export const NullValues = {
  name: 'Null/Empty Values',
  render: () => (
    <MetricsBar
      metrics={[
        { title: 'No Date', type: 'date', value: null, icon: '📅' },
        { title: 'No Cost', type: 'cost', value: null, icon: '💰' },
        { title: 'Zero Progress', type: 'completion', value: 0, icon: '📊' },
        { title: 'No Days', type: 'days', value: null, icon: '⏱️' },
      ]}
    />
  ),
};

// Single MetricItem
export const SingleItem = {
  name: 'Single MetricItem',
  render: () => (
    <div style={{ maxWidth: '200px' }}>
      <MetricItem
        title="Trip to Japan"
        type="date"
        value={new Date('2025-12-15')}
        icon={<FaPlane />}
        footer="15 days away"
        color="primary"
      />
    </div>
  ),
};

// With tooltip for truncated values
export const WithTooltips = {
  name: 'With Tooltips (Truncation)',
  render: () => (
    <div>
      <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
        When metric values are truncated with ellipsis, hover or click to see the full value in a tooltip.
        Resize the container to see truncation in action.
      </p>
      <div style={{ maxWidth: '400px' }}>
        <MetricsBar
          metrics={[
            {
              title: 'Planned Date',
              type: 'date',
              value: new Date('2025-12-15'),
              icon: '📅',
              tooltip: 'Monday, December 15, 2025',
            },
            {
              title: 'Total Cost',
              type: 'cost',
              value: 12500,
              icon: '💰',
              tooltip: '$12,500 estimated total cost',
            },
            {
              title: 'Planning Time',
              type: 'days',
              value: 45,
              icon: '⏱️',
              tooltip: 'Approximately 6-7 weeks of planning time',
            },
          ]}
        />
      </div>
    </div>
  ),
};

// Responsive preview helper
export const ResponsivePreview = {
  name: 'Responsive Preview',
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } },
      },
    },
  },
  render: () => (
    <div>
      <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
        Resize your browser or use Storybook's viewport addon to see responsive behavior.
        On mobile/tablet, metrics display as stacked cards. On desktop, they display as a horizontal bar.
      </p>
      <MetricsBar
        metrics={[
          {
            title: 'Planned Date',
            type: 'date',
            value: new Date('2025-12-15'),
            icon: '📅',
          },
          {
            title: 'Completion',
            type: 'completion',
            value: 65,
            icon: '✅',
            color: 'primary',
          },
          {
            title: 'Total Cost',
            type: 'cost',
            value: 1850,
            icon: '💰',
          },
          {
            title: 'Planning Time',
            type: 'days',
            value: 14,
            icon: '⏱️',
            footer: 'until departure',
          },
        ]}
      />
    </div>
  ),
};
