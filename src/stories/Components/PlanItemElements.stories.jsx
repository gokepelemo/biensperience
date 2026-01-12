import React from 'react';
import { BsPencilSquare, BsPlusCircle, BsTrash3 } from 'react-icons/bs';
import { FaClock, FaDollarSign, FaClipboardList } from 'react-icons/fa';

import { ActionsMenu, Checkbox } from '../../components/design-system';
import DragHandle from '../../components/DragHandle/DragHandle';
import CostEstimate from '../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../components/PlanningTime/PlanningTime';

import '../../styles/utilities.scss';
import '../../styles/design-tokens.css';
import '../../views/SingleExperience/SingleExperience.module.scss';

export default {
  title: 'Design System/Planning/Plan Item Elements',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Canonical plan-item rendering primitives used by both “The Plan” and “My Plan” tabs. The base layout (tree/indent, title, meta row) should remain consistent; differences should be limited to action controls.',
      },
    },
  },
};

function CardShell({ title, actions, children }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="plan-item-card mb-3 overflow-hidden">
        <div className="plan-item-header p-3 p-md-4">
          <div className="plan-item-title-row">
            <div className="plan-item-tree">
              <span className="no-child-arrow">•</span>
            </div>
            <div className="plan-item-title flex-grow-1 fw-semibold">{title}</div>
          </div>

          <div className="drag-handle-wrapper" style={{ cursor: 'grab' }}>
            <DragHandle isDragging={false} disabled={false} />
          </div>

          <div className="plan-item-actions plan-item-card-actions">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const PlanCard = {
  name: 'Card (The Plan)',
  render: () => {
    const actions = [
      {
        id: 'add-child',
        label: 'Add Child',
        icon: <BsPlusCircle />,
        onClick: () => {},
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: <BsPencilSquare />,
        onClick: () => {},
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <BsTrash3 />,
        variant: 'danger',
        onClick: () => {},
      },
    ];

    return (
      <CardShell
        title={<a href="https://example.com" target="_blank" rel="noopener noreferrer">Book hotel</a>}
        actions={<ActionsMenu actions={actions} ariaLabel="Plan item actions" size="md" position="bottom-right" />}
      >
        <div className="plan-item-details p-2 p-md-3">
          <div className="plan-item-meta">
            <span className="plan-item-cost">
              <CostEstimate cost={349} showTooltip={true} compact={true} />
            </span>
            <span className="plan-item-days">
              <PlanningTime days={2} showTooltip={true} />
            </span>
          </div>
        </div>
      </CardShell>
    );
  },
};

export const MyPlanCard = {
  name: 'Card (My Plan – Different Actions)',
  render: () => {
    const actions = [
      {
        id: 'edit',
        label: 'Edit',
        icon: <BsPencilSquare />,
        onClick: () => {},
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <BsTrash3 />,
        variant: 'danger',
        onClick: () => {},
      },
    ];

    return (
      <CardShell
        title={<span>Check in</span>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-sm btn-outline-secondary" aria-label="View details" title="View details">
              <FaClipboardList />
            </button>
            <button type="button" className="btn btn-sm btn-outline-success">Mark Complete</button>
            <ActionsMenu actions={actions} ariaLabel="Plan item actions" size="md" position="bottom-right" />
          </div>
        }
      >
        <div className="plan-item-details p-2 p-md-3">
          <div className="plan-item-meta">
            <span className="plan-item-cost">
              <CostEstimate cost={0} showTooltip={true} compact={true} />
            </span>
            <span className="plan-item-days">
              <PlanningTime days={1} showTooltip={true} />
            </span>
          </div>
        </div>
      </CardShell>
    );
  },
};

function CompactShell({ children }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="compact-plan-items-list">{children}</div>
    </div>
  );
}

export const PlanCompact = {
  name: 'Compact (The Plan)',
  render: () => {
    const actions = [
      {
        id: 'edit',
        label: 'Edit',
        icon: <BsPencilSquare />,
        onClick: () => {},
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <BsTrash3 />,
        variant: 'danger',
        onClick: () => {},
      },
    ];

    return (
      <CompactShell>
        <div className="compact-plan-item">
          <div className="compact-drag-handle" style={{ cursor: 'grab' }}>
            <DragHandle isDragging={false} disabled={false} />
          </div>
          <span className="compact-item-indent">•</span>
          <span className="compact-item-text">
            <a href="https://example.com" target="_blank" rel="noopener noreferrer">Hotel link</a>
          </span>
          <span className="compact-item-meta">
            <span className="compact-meta-cost" title="Cost estimate">
              <FaDollarSign />
            </span>
            <span className="compact-meta-days" title="Planning days">
              <FaClock />
            </span>
          </span>
          <ActionsMenu actions={actions} size="sm" ariaLabel="Item actions" />
        </div>
      </CompactShell>
    );
  },
};

export const MyPlanCompact = {
  name: 'Compact (My Plan – Different Actions)',
  render: () => {
    const actions = [
      {
        id: 'view',
        label: 'View Details',
        icon: <FaClipboardList />,
        onClick: () => {},
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <BsTrash3 />,
        variant: 'danger',
        onClick: () => {},
      },
    ];

    return (
      <CompactShell>
        <div className="compact-plan-item">
          <div className="compact-drag-handle" style={{ cursor: 'grab' }}>
            <DragHandle isDragging={false} disabled={false} />
          </div>
          <span className="compact-item-indent">•</span>
          <Checkbox id="demo-complete" checked={false} onChange={() => {}} size="sm" className="compact-item-checkbox" />
          <span className="compact-item-text">
            <button type="button" className="compact-item-title-button">Arrive at airport</button>
          </span>
          <span className="compact-item-meta">
            <span className="compact-meta-cost" title="Cost estimate">
              <FaDollarSign />
            </span>
            <span className="compact-meta-days" title="Planning days">
              <FaClock />
            </span>
          </span>
          <ActionsMenu actions={actions} size="sm" ariaLabel="Item actions" />
        </div>
      </CompactShell>
    );
  },
};
