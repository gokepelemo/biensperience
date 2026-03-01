/**
 * SyncPlanModal Component
 * Modal for syncing plan changes from the master experience plan to user's plan
 * Shows added, removed, and modified items with checkbox selection
 */

import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import { Modal, Checkbox, Alert } from '../../../components/design-system';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { sanitizeUrl, sanitizeText } from '../../../utilities/sanitize';
import styles from './SyncPlanModal.module.scss';

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
        <p style={{ color: 'var(--color-text-muted)' }} className={styles.mb3}>
          {lang.current.alert.selectChangesToApply}
        </p>

        {/* Added Items */}
        {syncChanges.added.length > 0 && (
          <div className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <h6 style={{ color: 'var(--color-success)' }} className={styles.noMarginBottom}>
                <strong>
                  {lang.current.label.addedItems.replace(
                    "{count}",
                    syncChanges.added.length
                  )}
                </strong>
              </h6>
              <Checkbox
                  id="selectAllAdded"
                  variant="outline"
                  size="sm"
                  checked={
                    selectedSyncItems.added.length ===
                    syncChanges.added.length
                  }
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
            <div className={styles.listGroup}>
              {syncChanges.added.map((item, idx) => (
                <div key={idx} className={styles.listGroupItem}>
                  <div className={styles.itemRow}>
                    <div className={styles.checkboxCell}>
                      <Checkbox
                        id={`add-${idx}`}
                        variant="outline"
                        size="sm"
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
                    <div className={styles.contentCell}>
                      <strong>{item.text}</strong>
                      {item.url && (() => {
                        const safeUrl = sanitizeUrl(item.url);
                        const displayUrl = sanitizeText(item.url);
                        return safeUrl && displayUrl ? (
                          <div className={styles.smallText} style={{ color: 'var(--color-text-muted)' }}>
                            URL:{" "}
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {displayUrl}
                            </a>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className={styles.badgeCell}>
                      {item.cost > 0 && (
                        <div className={styles.badgeSecondary}>
                          <CostEstimate
                            cost={item.cost}
                            showTooltip={false}
                            compact={true}
                          />
                        </div>
                      )}
                      {item.planning_days > 0 && (
                        <div className={`${styles.badgeInfo} ${styles.badgeGapStart}`}>
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
          <div className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <h6 style={{ color: 'var(--color-danger)' }} className={styles.noMarginBottom}>
                <strong>
                  {lang.current.label.removedItems.replace(
                    "{count}",
                    syncChanges.removed.length
                  )}
                </strong>
              </h6>
              <Checkbox
                  id="selectAllRemoved"
                  variant="outline"
                  size="sm"
                  checked={
                    selectedSyncItems.removed.length ===
                    syncChanges.removed.length
                  }
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
            <div className={styles.listGroup}>
              {syncChanges.removed.map((item, idx) => (
                <div
                  key={idx}
                  className={styles.listGroupItemDanger}
                >
                  <div className={styles.itemRow}>
                    <div className={styles.checkboxCell}>
                      <Checkbox
                        id={`remove-${idx}`}
                        variant="outline"
                        size="sm"
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
                    <div className={styles.contentCell}>
                      <strong>{item.text}</strong>
                      {item.url && (
                        <div className={styles.smallText} style={{ color: 'var(--color-text-muted)' }}>
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
          <div className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <h6 style={{ color: 'var(--color-warning)' }} className={styles.noMarginBottom}>
                <strong>
                  {lang.current.label.modifiedItems.replace(
                    "{count}",
                    syncChanges.modified.length
                  )}
                </strong>
              </h6>
              <Checkbox
                  id="selectAllModified"
                  variant="outline"
                  size="sm"
                  checked={
                    selectedSyncItems.modified.length ===
                    syncChanges.modified.length
                  }
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
            <div className={styles.listGroup}>
              {syncChanges.modified.map((item, idx) => (
                <div key={idx} className={styles.listGroupItem}>
                  <div className={styles.itemRow}>
                    <div className={styles.checkboxCell}>
                      <Checkbox
                        id={`modify-${idx}`}
                        variant="outline"
                        size="sm"
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
                    <div className={styles.contentCell}>
                      <strong className={styles.itemTitle}>{item.text}</strong>
                      {item.modifications.map((mod, modIdx) => (
                        <div key={modIdx} className={`${styles.smallText} ${styles.modDetail}`}>
                          <span className={`${styles.badgeWarning} ${styles.me2}`} style={{ color: 'var(--color-text-primary)' }}>
                            {mod.field}
                          </span>
                          <span className={styles.me2} style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>
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
                          <span className={styles.ms2} style={{ color: 'var(--color-success)' }}>
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
          className={styles.mt3}
          title={lang.current.label.note}
          message={lang.current.alert.syncPreserveNote}
        />
      </>
    </Modal>
  );
}
