import React from 'react';
import PropTypes from 'prop-types';
import WorkflowStepCard from './WorkflowStepCard';
import PlanSelector from './PlanSelector';
import PendingActionCard from './PendingActionCard';
import styles from './BienBotPanel.module.css';

function PendingActionsArea({
  pendingActions,
  isLoading,
  isStreaming,
  executingActionId,
  onExecute,
  onCancel,
  onUpdate,
  onApproveStep,
  onSkipStep,
  onEditStep,
  onCancelWorkflow,
}) {
  if (!pendingActions || pendingActions.length === 0) return null;

  // Separate regular actions from workflow steps and plan/destination pickers
  const regularActions = [];
  const planPickerActions = [];
  const destinationPickerActions = [];
  const workflowGroups = new Map();

  for (const action of pendingActions) {
    if (action.workflow_id) {
      const group = workflowGroups.get(action.workflow_id) || [];
      group.push(action);
      workflowGroups.set(action.workflow_id, group);
    } else if (action.type === 'select_plan') {
      planPickerActions.push(action);
    } else if (action.type === 'select_destination') {
      destinationPickerActions.push(action);
    } else {
      regularActions.push(action);
    }
  }

  return (
    <div className={styles.actionsContainer}>
      {/* Destination picker (select_destination disambiguation) */}
      {destinationPickerActions.length > 0 && (
        <PlanSelector
          actions={destinationPickerActions}
          onExecute={onExecute}
          onCancel={onCancel}
          disabled={isLoading || isStreaming}
        />
      )}

      {/* Plan picker (select_plan disambiguation) */}
      {planPickerActions.length > 0 && (
        <PlanSelector
          actions={planPickerActions}
          onExecute={onExecute}
          onCancel={onCancel}
          disabled={isLoading || isStreaming}
        />
      )}

      {/* Workflow step cards */}
      {[...workflowGroups.entries()].map(([wfId, steps]) => (
        <WorkflowStepCard
          key={wfId}
          workflowId={wfId}
          steps={steps}
          onApprove={onApproveStep}
          onSkip={onSkipStep}
          onEdit={onEditStep}
          onCancelWorkflow={onCancelWorkflow}
          disabled={isLoading || isStreaming}
        />
      ))}

      {/* Regular (non-workflow) action cards */}
      {regularActions.map((action) => (
        <PendingActionCard
          key={action._id || action.id}
          action={action}
          onExecute={onExecute}
          onUpdate={onUpdate}
          onCancel={onCancel}
          disabled={isLoading || isStreaming}
          executing={executingActionId}
        />
      ))}
    </div>
  );
}

PendingActionsArea.propTypes = {
  pendingActions: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  isStreaming: PropTypes.bool,
  executingActionId: PropTypes.string,
  onExecute: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onApproveStep: PropTypes.func.isRequired,
  onSkipStep: PropTypes.func.isRequired,
  onEditStep: PropTypes.func.isRequired,
  onCancelWorkflow: PropTypes.func.isRequired,
};

export default React.memo(PendingActionsArea);
