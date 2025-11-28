/**
 * Planning Layouts Stories
 * Storybook stories for trip planning layout components.
 */

import React from 'react';
import { FaCalendarAlt, FaClock, FaDollarSign, FaCheckCircle } from 'react-icons/fa';
import PlannerLayout from '../../components/Layout/PlannerLayout';
import TimelineLayout, { TimelineDay, TimelineItem } from '../../components/Layout/TimelineLayout';
import MetricsBarLayout, { MetricItem } from '../../components/Layout/MetricsBarLayout';

export default {
  title: 'Layouts/Planning Pages',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Layout components optimized for trip planning workflows.',
      },
    },
  },
};

// Sample plan items for demos
const SamplePlanItems = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {['Visit Sensoji Temple', 'Lunch in Asakusa', 'Tokyo Skytree', 'Shibuya Crossing'].map((item, i) => (
      <div
        key={i}
        style={{
          padding: '12px 16px',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <input type="checkbox" defaultChecked={i === 0} />
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const SampleMap = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      minHeight: '400px',
      background: 'var(--color-bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.25rem',
      color: 'var(--color-text-tertiary)',
    }}
  >
    🗺️ Map View
  </div>
);

const SampleMetrics = () => (
  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', color: 'var(--color-text-secondary)' }}>
    <span>📅 Dec 15, 2025</span>
    <span>✅ 2/5 completed</span>
    <span>💰 $1,250 estimated</span>
  </div>
);

// ============================================================
// PlannerLayout Stories
// ============================================================

export const PlannerBasic = {
  name: 'Planner Layout - Basic',
  render: () => (
    <PlannerLayout
      header={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>Tokyo Food Tour</h1>
          <button className="btn btn-primary">Edit</button>
        </div>
      }
      main={<SampleMap />}
      sidebar={<SamplePlanItems />}
      sidebarTitle="Plan Items"
      itemCount={4}
      footer={<SampleMetrics />}
    />
  ),
};

export const PlannerLeftSidebar = {
  name: 'Planner Layout - Left Sidebar',
  render: () => (
    <PlannerLayout
      header={
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>Kyoto Temple Tour</h1>
      }
      main={<SampleMap />}
      sidebar={<SamplePlanItems />}
      sidebarPosition="left"
      sidebarTitle="Itinerary"
      itemCount={4}
    />
  ),
};

export const PlannerCollapsed = {
  name: 'Planner Layout - Collapsed Sidebar',
  render: () => (
    <PlannerLayout
      header={
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>Osaka Adventure</h1>
      }
      main={<SampleMap />}
      sidebar={<SamplePlanItems />}
      defaultCollapsed={true}
      sidebarTitle="Activities"
      itemCount={4}
    />
  ),
};

// ============================================================
// TimelineLayout Stories
// ============================================================

export const TimelineBasic = {
  name: 'Timeline Layout - Basic',
  render: () => (
    <TimelineLayout showProgress completedCount={3} totalCount={8}>
      <TimelineDay dayLabel="Day 1" date="November 28, 2025">
        <TimelineItem
          time="9:00 AM"
          title="Breakfast at hotel"
          description="Start the day with a traditional Japanese breakfast"
          isCompleted
        />
        <TimelineItem
          time="11:00 AM"
          title="Visit Sensoji Temple"
          description="Explore Tokyo's oldest temple and Nakamise shopping street"
          isActive
        >
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.875rem' }}>
            <span>📍 Asakusa</span>
            <span>💰 Free</span>
            <span>⏱️ 2 hours</span>
          </div>
        </TimelineItem>
        <TimelineItem
          time="2:00 PM"
          title="Lunch in Asakusa"
          description="Try local ramen at a famous shop"
        />
      </TimelineDay>

      <TimelineDay dayLabel="Day 2" date="November 29, 2025">
        <TimelineItem
          time="10:00 AM"
          title="Shibuya Crossing"
          description="Experience the world's busiest pedestrian crossing"
        />
        <TimelineItem
          time="1:00 PM"
          title="Harajuku Shopping"
          description="Explore Takeshita Street and local boutiques"
        />
        <TimelineItem
          time="5:00 PM"
          title="Meiji Shrine"
          description="Visit the peaceful shrine in Yoyogi Park"
        />
      </TimelineDay>
    </TimelineLayout>
  ),
};

export const TimelineWithProgress = {
  name: 'Timeline Layout - With Progress',
  render: () => (
    <TimelineLayout showProgress completedCount={5} totalCount={10}>
      <TimelineDay dayLabel="Day 1" date="December 1, 2025">
        <TimelineItem time="Morning" title="Airport Arrival" isCompleted />
        <TimelineItem time="Afternoon" title="Hotel Check-in" isCompleted />
        <TimelineItem time="Evening" title="Welcome Dinner" isCompleted />
      </TimelineDay>
      <TimelineDay dayLabel="Day 2" date="December 2, 2025">
        <TimelineItem time="Morning" title="City Tour" isCompleted />
        <TimelineItem time="Afternoon" title="Museum Visit" isCompleted />
        <TimelineItem time="Evening" title="Local Market" isActive />
      </TimelineDay>
      <TimelineDay dayLabel="Day 3" date="December 3, 2025">
        <TimelineItem time="Morning" title="Day Trip" />
        <TimelineItem time="Afternoon" title="Beach Time" />
        <TimelineItem time="Evening" title="Sunset Cruise" />
      </TimelineDay>
    </TimelineLayout>
  ),
};

// ============================================================
// MetricsBarLayout Stories
// ============================================================

export const MetricsBarBasic = {
  name: 'Metrics Bar - Basic',
  render: () => (
    <MetricsBarLayout>
      <MetricItem
        label="Planned Date"
        value="Dec 15"
        icon={<FaCalendarAlt />}
        action={<button className="btn btn-sm btn-outline-primary">Edit</button>}
      />
      <MetricItem
        label="Completion"
        value="45%"
        progress={45}
        icon={<FaCheckCircle />}
        variant="primary"
      />
      <MetricItem
        label="Total Cost"
        value="$1,250"
        icon={<FaDollarSign />}
      />
      <MetricItem
        label="Days Left"
        value="19"
        icon={<FaClock />}
        subValue="until trip"
      />
    </MetricsBarLayout>
  ),
};

export const MetricsBarVertical = {
  name: 'Metrics Bar - Vertical',
  render: () => (
    <div style={{ maxWidth: '300px' }}>
      <MetricsBarLayout direction="vertical">
        <MetricItem
          label="Planning Status"
          value="75%"
          progress={75}
          variant="success"
        />
        <MetricItem
          label="Budget Used"
          value="$800 / $1,200"
          progress={66}
          variant="warning"
        />
        <MetricItem
          label="Items Completed"
          value="12 / 16"
          progress={75}
          variant="primary"
        />
      </MetricsBarLayout>
    </div>
  ),
};

export const MetricsBarCompact = {
  name: 'Metrics Bar - Compact',
  render: () => (
    <MetricsBarLayout compact>
      <MetricItem label="Date" value="Dec 15" />
      <MetricItem label="Progress" value="45%" progress={45} />
      <MetricItem label="Cost" value="$1,250" />
      <MetricItem label="Days" value="19" />
    </MetricsBarLayout>
  ),
};

export const MetricsBarVariants = {
  name: 'Metrics Bar - Color Variants',
  render: () => (
    <MetricsBarLayout>
      <MetricItem
        label="On Track"
        value="Good"
        variant="success"
        progress={85}
      />
      <MetricItem
        label="Budget"
        value="Warning"
        variant="warning"
        progress={75}
      />
      <MetricItem
        label="Overdue"
        value="Alert"
        variant="danger"
        progress={30}
      />
      <MetricItem
        label="Progress"
        value="Active"
        variant="primary"
        progress={60}
      />
    </MetricsBarLayout>
  ),
};
