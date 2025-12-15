/**
 * SyncPlanModal Component
 * Modal for syncing plan changes from the master experience plan to user's plan
 * Shows added, removed, and modified items with checkbox selection
 */

import Modal from '../../../components/Modal/Modal';
import Alert from '../../../components/Alert/Alert';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import { FormCheck } from '../../../components/design-system';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';

export default function SyncPlanModal({
  // Modal state
  show,
  onHide,

  // Sync data
  syncChanges,
  selectedSyncItems,
  setSelectedSyncItems,

  // Handlers
  onConfirmSync,

  // UI state
  loading,

  // Language strings
  lang
}) {
  if (!show || !syncChanges) return null;

  return (
    <Modal
      show={true}
      onClose={onHide}
      title={lang.current.modal.syncPlanTitle}
      dialogClassName="responsive-modal-dialog"
      scrollable={true}
      submitText="Confirm Sync"
      cancelText={lang.current.button.cancel}
      onSubmit={onConfirmSync}
      loading={loading}
      disableSubmit={
        selectedSyncItems.added.length === 0 &&
        selectedSyncItems.removed.length === 0 &&
        selectedSyncItems.modified.length === 0
      }
    >
      <>
        <p style={{ color: 'var(--bs-gray-600)' }} className="mb-3">
          {lang.current.alert.selectChangesToApply}
        </p>

        {/* Added Items */}
        {syncChanges.added.length > 0 && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 style={{ color: 'var(--bs-success)' }} className="mb-0">
                <strong>
                  {lang.current.label.addedItems.replace(
                    "{count}",
                    syncChanges.added.length
                  )}
                </strong>
              </h6>
              <div className="sync-modal-select-all">
                <FormCheck
                  type="checkbox"
                  id="selectAllAdded"
                  checked={
                    selectedSyncItems.added.length ===
                    syncChanges.added.length
                  }
                  label={lang.current.label.selectAll}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        added: syncChanges.added.map((_, idx) => idx),
                      }));
                    } else {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        added: [],
                      }));
                    }
                  }}
                />
              </div>
            </div>
            <div className="list-group">
              {syncChanges.added.map((item, idx) => (
                <div key={idx} className="list-group-item">
                  <div className="d-flex align-items-start">
                    <div className="me-3 mt-1">
                      <FormCheck
                        type="checkbox"
                        id={`add-${idx}`}
                        checked={selectedSyncItems.added.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              added: [...prev.added, idx],
                            }));
                          } else {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              added: prev.added.filter((i) => i !== idx),
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-grow-1">
                      <strong>{item.text}</strong>
                      {item.url && (
                        <div className="small" style={{ color: 'var(--bs-gray-600)' }}>
                          URL:{" "}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.url}
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="ms-2" style={{ textAlign: 'end' }}>
                      {item.cost > 0 && (
                        <div className="badge bg-secondary">
                          <CostEstimate
                            cost={item.cost}
                            showTooltip={false}
                            compact={true}
                          />
                        </div>
                      )}
                      {item.planning_days > 0 && (
                        <div className="badge bg-info ms-1">
                          <PlanningTime
                            days={item.planning_days}
                            showTooltip={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Removed Items */}
        {syncChanges.removed.length > 0 && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 style={{ color: 'var(--bs-danger)' }} className="mb-0">
                <strong>
                  {lang.current.label.removedItems.replace(
                    "{count}",
                    syncChanges.removed.length
                  )}
                </strong>
              </h6>
              <div className="sync-modal-select-all">
                <FormCheck
                  type="checkbox"
                  id="selectAllRemoved"
                  checked={
                    selectedSyncItems.removed.length ===
                    syncChanges.removed.length
                  }
                  label={lang.current.label.selectAll}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        removed: syncChanges.removed.map((_, idx) => idx),
                      }));
                    } else {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        removed: [],
                      }));
                    }
                  }}
                />
              </div>
            </div>
            <div className="list-group">
              {syncChanges.removed.map((item, idx) => (
                <div
                  key={idx}
                  className="list-group-item list-group-item-danger"
                >
                  <div className="d-flex align-items-start">
                    <div className="me-3 mt-1">
                      <FormCheck
                        type="checkbox"
                        id={`remove-${idx}`}
                        checked={selectedSyncItems.removed.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              removed: [...prev.removed, idx],
                            }));
                          } else {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              removed: prev.removed.filter(
                                (i) => i !== idx
                              ),
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-grow-1">
                      <strong>{item.text}</strong>
                      {item.url && (
                        <div className="small" style={{ color: 'var(--bs-gray-600)' }}>
                          URL: {item.url}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modified Items */}
        {syncChanges.modified.length > 0 && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 style={{ color: 'var(--bs-warning)' }} className="mb-0">
                <strong>
                  {lang.current.label.modifiedItems.replace(
                    "{count}",
                    syncChanges.modified.length
                  )}
                </strong>
              </h6>
              <div className="sync-modal-select-all">
                <FormCheck
                  type="checkbox"
                  id="selectAllModified"
                  checked={
                    selectedSyncItems.modified.length ===
                    syncChanges.modified.length
                  }
                  label={lang.current.label.selectAll}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        modified: syncChanges.modified.map((_, idx) => idx),
                      }));
                    } else {
                      setSelectedSyncItems((prev) => ({
                        ...prev,
                        modified: [],
                      }));
                    }
                  }}
                />
              </div>
            </div>
            <div className="list-group">
              {syncChanges.modified.map((item, idx) => (
                <div key={idx} className="list-group-item">
                  <div className="d-flex align-items-start">
                    <div className="me-3 mt-1">
                      <FormCheck
                        type="checkbox"
                        id={`modify-${idx}`}
                        checked={selectedSyncItems.modified.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              modified: [...prev.modified, idx],
                            }));
                          } else {
                            setSelectedSyncItems((prev) => ({
                              ...prev,
                              modified: prev.modified.filter(
                                (i) => i !== idx
                              ),
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-grow-1">
                      <strong className="d-block mb-2">{item.text}</strong>
                      {item.modifications.map((mod, modIdx) => (
                        <div key={modIdx} className="small mb-1">
                          <span className="badge bg-warning me-2" style={{ color: 'var(--bs-dark)' }}>
                            {mod.field}
                          </span>
                          <span className="me-2" style={{ textDecoration: 'line-through', color: 'var(--bs-gray-600)' }}>
                            {mod.field === "cost"
                              ? `$${(mod.old || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : mod.field === "days"
                              ? `${mod.old || 0} ${
                                  (mod.old || 0) === 1 ? "day" : "days"
                                }`
                              : mod.old || "(empty)"}
                          </span>
                          →
                          <span className="ms-2" style={{ color: 'var(--bs-success)' }}>
                            {mod.field === "cost"
                              ? `$${(mod.new || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : mod.field === "days"
                              ? `${mod.new || 0} ${
                                  (mod.new || 0) === 1 ? "day" : "days"
                                }`
                              : mod.new || "(empty)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {syncChanges.added.length === 0 &&
          syncChanges.removed.length === 0 &&
          syncChanges.modified.length === 0 && (
            <Alert
              type="info"
              title={lang.current.alert.noChangesDetected}
              message={lang.current.alert.planAlreadyInSync}
            />
          )}

        <Alert
          type="warning"
          className="mt-3"
          title={lang.current.label.note}
          message={lang.current.alert.syncPreserveNote}
        />
      </>
    </Modal>
  );
}
