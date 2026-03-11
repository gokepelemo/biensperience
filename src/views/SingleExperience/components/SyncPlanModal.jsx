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
import { Box, Flex } from '@chakra-ui/react';

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
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          {lang.current.alert.selectChangesToApply}
        </p>

        {/* Added Items */}
        {syncChanges.added.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Flex justify="space-between" align="center" mb="2">
              <h6 style={{ color: 'var(--color-success)', marginBottom: 0 }}>
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
            </Flex>
            <Box css={{ display: 'flex', flexDirection: 'column', paddingLeft: 0, marginBottom: 0, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              {syncChanges.added.map((item, idx) => (
                <Box key={idx} css={{ position: 'relative', display: 'block', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)', '&:last-child': { borderBottom: 0 } }}>
                  <Flex align="flex-start">
                    <div style={{ marginInlineEnd: 'var(--space-4)', marginTop: 'var(--space-1)' }}>
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
                    <div style={{ flexGrow: 1 }}>
                      <strong>{item.text}</strong>
                      {item.url && (() => {
                        const safeUrl = sanitizeUrl(item.url);
                        const displayUrl = sanitizeText(item.url);
                        return safeUrl && displayUrl ? (
                          <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-normal)', color: 'var(--color-text-muted)' }}>
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
                    <div style={{ marginInlineStart: 'var(--space-2)', textAlign: 'end' }}>
                      {item.cost > 0 && (
                        <div style={{ display: 'inline-block', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-secondary-bg, #6c757d)', color: 'var(--color-bg-primary)' }}>
                          <CostEstimate
                            cost={item.cost}
                            showTooltip={false}
                            compact={true}
                          />
                        </div>
                      )}
                      {item.planning_days > 0 && (
                        <div style={{ display: 'inline-block', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-info-bg, #0dcaf0)', color: 'var(--color-text-primary)', marginInlineStart: 'var(--space-1)' }}>
                          <PlanningTime
                            days={item.planning_days}
                            showTooltip={false}
                          />
                        </div>
                      )}
                    </div>
                  </Flex>
                </Box>
              ))}
            </Box>
          </div>
        )}

        {/* Removed Items */}
        {syncChanges.removed.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Flex justify="space-between" align="center" mb="2">
              <h6 style={{ color: 'var(--color-danger)', marginBottom: 0 }}>
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
            </Flex>
            <Box css={{ display: 'flex', flexDirection: 'column', paddingLeft: 0, marginBottom: 0, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              {syncChanges.removed.map((item, idx) => (
                <Box
                  key={idx}
                  css={{ position: 'relative', display: 'block', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-danger-bg, rgba(220, 53, 69, 0.08))', borderColor: 'var(--color-danger-border, rgba(220, 53, 69, 0.2))', borderBottom: '1px solid var(--color-border)', '&:last-child': { borderBottom: 0 } }}
                >
                  <Flex align="flex-start">
                    <div style={{ marginInlineEnd: 'var(--space-4)', marginTop: 'var(--space-1)' }}>
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
                    <div style={{ flexGrow: 1 }}>
                      <strong>{item.text}</strong>
                      {item.url && (
                        <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-normal)', color: 'var(--color-text-muted)' }}>
                          URL: {item.url}
                        </div>
                      )}
                    </div>
                  </Flex>
                </Box>
              ))}
            </Box>
          </div>
        )}

        {/* Modified Items */}
        {syncChanges.modified.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Flex justify="space-between" align="center" mb="2">
              <h6 style={{ color: 'var(--color-warning)', marginBottom: 0 }}>
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
            </Flex>
            <Box css={{ display: 'flex', flexDirection: 'column', paddingLeft: 0, marginBottom: 0, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              {syncChanges.modified.map((item, idx) => (
                <Box key={idx} css={{ position: 'relative', display: 'block', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)', '&:last-child': { borderBottom: 0 } }}>
                  <Flex align="flex-start">
                    <div style={{ marginInlineEnd: 'var(--space-4)', marginTop: 'var(--space-1)' }}>
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
                    <div style={{ flexGrow: 1 }}>
                      <strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>{item.text}</strong>
                      {item.modifications.map((mod, modIdx) => (
                        <div key={modIdx} style={{ fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-normal)', marginBottom: 'var(--space-1)' }}>
                          <span style={{ display: 'inline-block', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-warning-bg, #ffc107)', color: 'var(--color-text-primary)', marginInlineEnd: 'var(--space-2)' }}>
                            {mod.field}
                          </span>
                          <span style={{ marginInlineEnd: 'var(--space-2)', textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>
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
                          <span style={{ marginInlineStart: 'var(--space-2)', color: 'var(--color-success)' }}>
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
                  </Flex>
                </Box>
              ))}
            </Box>
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
          style={{ marginTop: 'var(--space-4)' }}
          title={lang.current.label.note}
          message={lang.current.alert.syncPreserveNote}
        />
      </>
    </Modal>
  );
}
