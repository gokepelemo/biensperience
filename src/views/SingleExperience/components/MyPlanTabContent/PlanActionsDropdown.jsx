import { useMemo } from 'react';
import { BsArrowRepeat, BsChatDots, BsPersonPlus, BsPlusCircle } from 'react-icons/bs';

import ActionsMenu from '../../../../components/ActionsMenu';
import { lang } from '../../../../lang.constants';

export default function PlanActionsDropdown({
  canEdit,
  isPlanOwner,
  showSyncButton,
  loading,
  handleAddPlanInstanceItem,
  openCollaboratorModal,
  handleSyncPlan,
  chatEnabled,
  chatLoading,
  openPlanChat
}) {
  const actions = useMemo(() => {
    return [
      {
        id: 'chat',
        label: chatLoading ? 'Opening…' : 'Chat',
        icon: <BsChatDots />,
        onClick: () => openPlanChat(),
        disabled: chatLoading,
        hidden: !chatEnabled,
      },
      {
        id: 'add-plan-item',
        label: lang.current.button.addPlanItem,
        icon: <BsPlusCircle />,
        onClick: () => handleAddPlanInstanceItem(),
        hidden: !canEdit,
      },
      {
        id: 'collaborators',
        label: lang.current.button.addCollaborators,
        icon: <BsPersonPlus />,
        onClick: () => openCollaboratorModal('plan'),
        hidden: !isPlanOwner,
      },
      {
        id: 'sync',
        label: loading ? lang.current.button.syncing : lang.current.button.syncNow,
        icon: <BsArrowRepeat className={loading ? 'spin' : undefined} />,
        onClick: () => handleSyncPlan(),
        disabled: loading,
        hidden: !showSyncButton,
      },
    ];
  }, [
    canEdit,
    chatEnabled,
    chatLoading,
    handleAddPlanInstanceItem,
    handleSyncPlan,
    isPlanOwner,
    loading,
    openCollaboratorModal,
    openPlanChat,
    showSyncButton,
  ]);

  const hasAnyActions = actions.some(action => !action.hidden);
  if (!hasAnyActions) return null;

  return (
    <div className="plan-actions-dropdown">
      <ActionsMenu
        trigger={<BsPlusCircle />}
        triggerVariant="primary"
        actions={actions}
        ariaLabel={lang.current.tooltip.planActions}
        size="md"
        position="bottom-right"
      />
    </div>
  );
}
