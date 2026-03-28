/**
 * AI Admin Classifier Tab
 *
 * Three sections:
 * 1. Classifier Config — thresholds, LLM fallback toggle, logging settings
 * 2. Corpus Management — view/edit intents and utterances, retrain model
 * 3. Classification Logs — browse low-confidence logs, review, add to corpus
 *
 * Uses native Chakra UI elements throughout.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Flex,
  Badge,
  Stack,
  Input,
  Separator,
  Switch,
  Textarea,
  HStack,
  VStack,
  Tag
} from '@chakra-ui/react';
import {
  FaSync,
  FaPlus,
  FaTrash,
  FaCheck,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaEdit,
  FaSave
} from 'react-icons/fa';
import { Button, Card, CardHeader, CardBody, Alert, Checkbox } from '../../components/design-system';
import { Text, Heading } from '../../components/design-system';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/design-system';
import { FormGroup, FormLabel } from '../../components/design-system';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import { createSimpleFilter } from '../../utilities/trie';
import {
  getCorpus,
  getCorpusIntent,
  createCorpusIntent,
  updateCorpusIntent,
  deleteCorpusIntent,
  retrainClassifier,
  getClassificationLogs,
  getClassificationSummary,
  reviewClassification,
  batchAddToCorpus,
  getClassifierConfig,
  updateClassifierConfig
} from '../../utilities/ai-admin-api';

// ---------------------------------------------------------------------------
// Sub-section selector
// ---------------------------------------------------------------------------

const SECTIONS = [
  { value: 'config', label: 'Configuration' },
  { value: 'corpus', label: 'Corpus' },
  { value: 'logs', label: 'Classification Logs' }
];

export default function AIAdminClassifier() {
  const [activeSection, setActiveSection] = useState('config');

  return (
    <Box>
      <Flex gap="var(--space-2)" mb="var(--space-4)" flexWrap="wrap">
        {SECTIONS.map(s => (
          <Button
            key={s.value}
            size="sm"
            variant={activeSection === s.value ? 'gradient' : 'outline'}
            onClick={() => setActiveSection(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </Flex>

      {activeSection === 'config' && <ConfigSection />}
      {activeSection === 'corpus' && <CorpusSection />}
      {activeSection === 'logs' && <LogsSection />}
    </Box>
  );
}

// ============================================================================
// Configuration Section
// ============================================================================

function ConfigSection() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const { success, error: showError } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getClassifierConfig();
      const c = result?.data?.config || result?.config || {};
      setConfig(c);
      setForm({
        low_confidence_threshold: c.low_confidence_threshold ?? 0.65,
        llm_fallback_enabled: c.llm_fallback_enabled ?? false,
        llm_fallback_threshold: c.llm_fallback_threshold ?? 0.4,
        log_all_classifications: c.log_all_classifications ?? false,
        log_retention_days: c.log_retention_days ?? 90
      });
    } catch (err) {
      showError('Failed to load classifier config');
      logger.error('[AIAdminClassifier] Config fetch failed', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateClassifierConfig(form);
      success('Classifier configuration updated');
      await fetchConfig();
    } catch (err) {
      showError('Failed to update config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        <SkeletonLoader width="220px" height="24px" />
        <Card>
          <CardBody>
            <Stack gap="var(--space-4)">
              {/* Low Confidence Threshold */}
              <Box>
                <SkeletonLoader width="180px" height="16px" />
                <SkeletonLoader width="320px" height="12px" style={{ marginTop: 'var(--space-1)' }} />
                <SkeletonLoader width="200px" height="36px" variant="rectangle" style={{ marginTop: 'var(--space-1)' }} />
              </Box>
              <Separator />
              {/* LLM Fallback toggle */}
              <Flex align="center" gap="var(--space-3)">
                <SkeletonLoader width="36px" height="20px" variant="rectangle" />
                <SkeletonLoader width="160px" height="16px" />
              </Flex>
              <SkeletonLoader width="360px" height="12px" />
              <Separator />
              {/* Log All toggle */}
              <Flex align="center" gap="var(--space-3)">
                <SkeletonLoader width="36px" height="20px" variant="rectangle" />
                <SkeletonLoader width="170px" height="16px" />
              </Flex>
              <SkeletonLoader width="300px" height="12px" />
              {/* Log Retention */}
              <Box>
                <SkeletonLoader width="130px" height="16px" />
                <SkeletonLoader width="200px" height="36px" variant="rectangle" style={{ marginTop: 'var(--space-1)' }} />
              </Box>
              {/* Save button */}
              <Flex justify="flex-end">
                <SkeletonLoader width="150px" height="40px" variant="rectangle" />
              </Flex>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="var(--space-4)">
      <Heading as="h3" size="heading-3">Classifier Configuration</Heading>

      <Card>
        <CardBody>
          <Stack gap="var(--space-4)">
            <FormGroup>
              <FormLabel>Low Confidence Threshold</FormLabel>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
                Classifications below this score are logged for review (0.0 - 1.0)
              </Text>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={form.low_confidence_threshold}
                onChange={e => setForm(f => ({ ...f, low_confidence_threshold: parseFloat(e.target.value) || 0 }))}
                maxW="200px"
              />
            </FormGroup>

            <Separator />

            <FormGroup>
              <Flex align="center" gap="var(--space-3)">
                <Switch.Root
                  checked={form.llm_fallback_enabled}
                  onCheckedChange={(e) => setForm(f => ({ ...f, llm_fallback_enabled: e.checked }))}
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
                <FormLabel mb="0">LLM Fallback Enabled</FormLabel>
              </Flex>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mt="var(--space-1)">
                When enabled, messages with very low NLP.js confidence are reclassified by the LLM
              </Text>
            </FormGroup>

            {form.llm_fallback_enabled && (
              <FormGroup>
                <FormLabel>LLM Fallback Threshold</FormLabel>
                <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
                  Below this score, the LLM is invoked for reclassification (0.0 - 1.0)
                </Text>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.llm_fallback_threshold}
                  onChange={e => setForm(f => ({ ...f, llm_fallback_threshold: parseFloat(e.target.value) || 0 }))}
                  maxW="200px"
                />
              </FormGroup>
            )}

            <Separator />

            <FormGroup>
              <Flex align="center" gap="var(--space-3)">
                <Switch.Root
                  checked={form.log_all_classifications}
                  onCheckedChange={(e) => setForm(f => ({ ...f, log_all_classifications: e.checked }))}
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
                <FormLabel mb="0">Log All Classifications</FormLabel>
              </Flex>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mt="var(--space-1)">
                When off, only low-confidence classifications are logged
              </Text>
            </FormGroup>

            <FormGroup>
              <FormLabel>Log Retention (days)</FormLabel>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.log_retention_days}
                onChange={e => setForm(f => ({ ...f, log_retention_days: parseInt(e.target.value, 10) || 90 }))}
                maxW="200px"
              />
            </FormGroup>

            <Flex justify="flex-end">
              <Button variant="gradient" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Flex>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

// ============================================================================
// Corpus Section
// ============================================================================

function CorpusSection() {
  const [allIntents, setAllIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIntent, setExpandedIntent] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [newUtterance, setNewUtterance] = useState('');
  const [showNewIntent, setShowNewIntent] = useState(false);
  const [newIntentForm, setNewIntentForm] = useState({ intent: '', description: '', utterances: '' });
  const [retraining, setRetraining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const trieRef = useRef(null);
  const { success, error: showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const PAGE_SIZE = 20;

  const fetchCorpus = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCorpus();
      const intents = result?.data?.intents || result?.intents || [];
      setAllIntents(intents);
      // Build trie index
      const filter = createSimpleFilter(['intent', 'description']);
      filter.buildIndex(intents);
      trieRef.current = filter;
    } catch (err) {
      showError('Failed to load corpus');
      logger.error('[AIAdminClassifier] Corpus fetch failed', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchCorpus(); }, [fetchCorpus]);

  // Client-side filtering via trie + pagination
  const filteredIntents = useMemo(() => {
    if (!search.trim() || !trieRef.current) return allIntents;
    return trieRef.current.filter(search);
  }, [allIntents, search]);

  const totalPages = Math.ceil(filteredIntents.length / PAGE_SIZE) || 1;
  const paginatedIntents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredIntents.slice(start, start + PAGE_SIZE);
  }, [filteredIntents, page]);

  const handleExpand = useCallback(async (intentKey) => {
    if (expandedIntent === intentKey) {
      setExpandedIntent(null);
      setExpandedData(null);
      return;
    }
    try {
      const result = await getCorpusIntent(intentKey);
      setExpandedData(result?.data?.intent || result?.intent || null);
      setExpandedIntent(intentKey);
      setNewUtterance('');
    } catch {
      showError('Failed to load intent details');
    }
  }, [expandedIntent, showError]);

  const handleAddUtterance = async () => {
    if (!newUtterance.trim() || !expandedData) return;
    try {
      setSaving(true);
      const updated = [...expandedData.utterances, newUtterance.trim()];
      await updateCorpusIntent(expandedData.intent, { utterances: updated });
      setExpandedData(prev => ({ ...prev, utterances: updated }));
      setNewUtterance('');
      // Update count in list
      setAllIntents(prev => prev.map(i =>
        i.intent === expandedData.intent ? { ...i, utterance_count: updated.length } : i
      ));
      success('Utterance added');
    } catch {
      showError('Failed to add utterance');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUtterance = async (idx) => {
    if (!expandedData) return;
    try {
      const updated = expandedData.utterances.filter((_, i) => i !== idx);
      await updateCorpusIntent(expandedData.intent, { utterances: updated });
      setExpandedData(prev => ({ ...prev, utterances: updated }));
      setAllIntents(prev => prev.map(i =>
        i.intent === expandedData.intent ? { ...i, utterance_count: updated.length } : i
      ));
    } catch {
      showError('Failed to remove utterance');
    }
  };

  const handleToggleEnabled = async (intentKey, currentEnabled) => {
    try {
      await updateCorpusIntent(intentKey, { enabled: !currentEnabled });
      setAllIntents(prev => prev.map(i =>
        i.intent === intentKey ? { ...i, enabled: !currentEnabled } : i
      ));
      if (expandedData?.intent === intentKey) {
        setExpandedData(prev => ({ ...prev, enabled: !currentEnabled }));
      }
      success(`Intent ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      showError('Failed to toggle intent');
    }
  };

  const handleDeleteIntent = async (intentKey) => {
    const ok = await confirm({ title: 'Delete intent?', message: `Delete custom intent "${intentKey}"? This cannot be undone.`, confirmText: 'Delete' });
    if (!ok) return;
    try {
      await deleteCorpusIntent(intentKey);
      if (expandedIntent === intentKey) {
        setExpandedIntent(null);
        setExpandedData(null);
      }
      success('Intent deleted');
      await fetchCorpus();
    } catch {
      showError('Failed to delete intent');
    }
  };

  const handleCreateIntent = async () => {
    const { intent, description, utterances } = newIntentForm;
    if (!intent.trim()) {
      showError('Intent name is required');
      return;
    }
    try {
      setSaving(true);
      const utts = utterances
        .split('\n')
        .map(u => u.trim())
        .filter(Boolean);
      await createCorpusIntent({ intent: intent.trim(), description, utterances: utts });
      setShowNewIntent(false);
      setNewIntentForm({ intent: '', description: '', utterances: '' });
      success('Intent created');
      setPage(1);
      await fetchCorpus();
    } catch {
      showError('Failed to create intent');
    } finally {
      setSaving(false);
    }
  };

  const handleRetrain = async () => {
    const ok = await confirm({ title: 'Retrain classifier?', message: 'Retrain the NLP model from the current corpus? This may take a few seconds.', confirmText: 'Retrain', confirmVariant: 'gradient' });
    if (!ok) return;
    try {
      setRetraining(true);
      const result = await retrainClassifier();
      const stats = result?.data || result || {};
      success(`Model retrained: ${stats.intents || 0} intents, ${stats.utterances || 0} utterances`);
    } catch {
      showError('Failed to retrain classifier');
    } finally {
      setRetraining(false);
    }
  };

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        {/* Header with buttons */}
        <Flex justify="space-between" align="center" flexWrap="wrap" gap="var(--space-2)">
          <SkeletonLoader width="220px" height="24px" />
          <HStack gap="var(--space-2)">
            <SkeletonLoader width="110px" height="32px" variant="rectangle" />
            <SkeletonLoader width="130px" height="32px" variant="rectangle" />
          </HStack>
        </Flex>
        {/* Intent cards */}
        <Stack gap="var(--space-2)">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardBody p="var(--space-3)">
                <Flex justify="space-between" align="center">
                  <Flex align="center" gap="var(--space-2)">
                    <SkeletonLoader width="12px" height="12px" />
                    <SkeletonLoader width={`${80 + i * 15}px`} height="14px" />
                    <SkeletonLoader width="55px" height="18px" variant="rectangle" />
                  </Flex>
                  <Flex align="center" gap="var(--space-3)">
                    <SkeletonLoader width="80px" height="12px" />
                    <SkeletonLoader width="36px" height="20px" variant="rectangle" />
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="var(--space-4)">
      {ConfirmDialog}
      <Flex justify="space-between" align="center" flexWrap="wrap" gap="var(--space-2)">
        <Heading as="h3" size="heading-3">Intent Corpus ({filteredIntents.length}{search.trim() ? ` of ${allIntents.length}` : ''} intents)</Heading>
        <HStack gap="var(--space-2)">
          <Button size="sm" variant="outline" onClick={() => setShowNewIntent(true)} disabled={showNewIntent}>
            <FaPlus style={{ marginRight: 'var(--space-1)' }} /> New Intent
          </Button>
          <Button size="sm" variant="outline" onClick={handleRetrain} disabled={retraining}>
            <FaSync style={{ marginRight: 'var(--space-1)' }} /> {retraining ? 'Retraining...' : 'Retrain Model'}
          </Button>
        </HStack>
      </Flex>

      {/* Search */}
      <Input
        size="sm"
        placeholder="Filter intents..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
      />

      {showNewIntent && (
        <Card>
          <CardBody>
            <Stack gap="var(--space-3)">
              <Heading as="h4" size="heading-4">Create New Intent</Heading>
              <FormGroup>
                <FormLabel>Intent Name</FormLabel>
                <Input
                  placeholder="e.g. BOOK_ACTIVITY"
                  value={newIntentForm.intent}
                  onChange={e => setNewIntentForm(f => ({ ...f, intent: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Description</FormLabel>
                <Input
                  placeholder="What this intent is for"
                  value={newIntentForm.description}
                  onChange={e => setNewIntentForm(f => ({ ...f, description: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Utterances (one per line)</FormLabel>
                <Textarea
                  placeholder={"book an activity\nreserve a tour\nschedule an excursion"}
                  value={newIntentForm.utterances}
                  onChange={e => setNewIntentForm(f => ({ ...f, utterances: e.target.value }))}
                  rows={4}
                />
              </FormGroup>
              <Flex gap="var(--space-2)" justify="flex-end">
                <Button size="sm" variant="outline" onClick={() => setShowNewIntent(false)}>Cancel</Button>
                <Button size="sm" variant="gradient" onClick={handleCreateIntent} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Intent'}
                </Button>
              </Flex>
            </Stack>
          </CardBody>
        </Card>
      )}

      <Stack gap="var(--space-2)">
        {paginatedIntents.map(item => (
          <Card key={item.intent}>
            <CardBody p="var(--space-3)">
              <Flex
                justify="space-between"
                align="center"
                cursor="pointer"
                onClick={() => handleExpand(item.intent)}
              >
                <Flex align="center" gap="var(--space-2)">
                  {expandedIntent === item.intent ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  <Text fontWeight="600" fontFamily="monospace" fontSize="var(--font-size-sm)">
                    {item.intent}
                  </Text>
                  <Badge colorPalette={item.enabled ? 'green' : 'gray'} size="sm">
                    {item.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  {item.is_custom && (
                    <Badge colorPalette="purple" size="sm">custom</Badge>
                  )}
                </Flex>
                <Flex align="center" gap="var(--space-3)">
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">
                    {item.utterance_count} utterances
                  </Text>
                  <Switch.Root
                    size="sm"
                    checked={item.enabled}
                    onCheckedChange={() => handleToggleEnabled(item.intent, item.enabled)}
                    onClick={e => e.stopPropagation()}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                  {item.is_custom && (
                    <Box
                      as="button"
                      onClick={e => { e.stopPropagation(); handleDeleteIntent(item.intent); }}
                      color="var(--color-danger)"
                      cursor="pointer"
                      p="var(--space-1)"
                    >
                      <FaTrash size={12} />
                    </Box>
                  )}
                </Flex>
              </Flex>

              {expandedIntent === item.intent && expandedData && (
                <Box mt="var(--space-3)" pt="var(--space-3)" borderTop="1px solid" borderColor="var(--color-border)">
                  {expandedData.description && (
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-2)">
                      {expandedData.description}
                    </Text>
                  )}

                  <Flex flexWrap="wrap" gap="var(--space-2)" mb="var(--space-3)">
                    {expandedData.utterances.map((utt, idx) => (
                      <Tag.Root key={idx} size="lg" variant="subtle" colorPalette="blue">
                        <Tag.Label>{utt}</Tag.Label>
                        <Tag.EndElement>
                          <Tag.CloseTrigger onClick={() => handleRemoveUtterance(idx)} />
                        </Tag.EndElement>
                      </Tag.Root>
                    ))}
                  </Flex>

                  <Flex gap="var(--space-2)">
                    <Input
                      size="sm"
                      placeholder="Add utterance..."
                      value={newUtterance}
                      onChange={e => setNewUtterance(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddUtterance()}
                    />
                    <Button size="sm" variant="outline" onClick={handleAddUtterance} disabled={saving || !newUtterance.trim()}>
                      <FaPlus />
                    </Button>
                  </Flex>
                </Box>
              )}
            </CardBody>
          </Card>
        ))}
      </Stack>
      {/* Pagination */}
      {totalPages > 1 && (
        <Flex justify="center" gap="var(--space-2)">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <Text fontSize="var(--font-size-sm)" lineHeight="var(--btn-height-sm)" px="var(--space-2)">
            Page {page} of {totalPages}
          </Text>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </Flex>
      )}    </Stack>
  );
}

// ============================================================================
// Classification Logs Section
// ============================================================================

function LogsSection() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    low_confidence: true,
    reviewed: undefined,
    intent: ''
  });
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [correctionIntents, setCorrectionIntents] = useState({});
  const { success, error: showError } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (filters.low_confidence) params.low_confidence = true;
      if (filters.reviewed !== undefined) params.reviewed = filters.reviewed;
      if (filters.intent) params.intent = filters.intent;

      const [logsResult, summaryResult] = await Promise.all([
        getClassificationLogs(params),
        page === 1 ? getClassificationSummary(30) : Promise.resolve(null)
      ]);

      const logsData = logsResult?.data || logsResult || {};
      setLogs(logsData.logs || []);
      setTotalPages(logsData.pages || 1);

      if (summaryResult) {
        setSummary(summaryResult?.data || summaryResult || {});
      }
    } catch (err) {
      showError('Failed to load classification logs');
      logger.error('[AIAdminClassifier] Logs fetch failed', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [page, filters, showError]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleReview = async (logId, correctedIntent) => {
    try {
      await reviewClassification(logId, {
        corrected_intent: correctedIntent || undefined
      });
      setLogs(prev => prev.map(l =>
        l._id === logId ? { ...l, reviewed: true, admin_corrected_intent: correctedIntent || null } : l
      ));
      success('Classification reviewed');
    } catch {
      showError('Failed to review classification');
    }
  };

  const handleBatchAdd = async () => {
    const corrections = [];
    for (const logId of selectedLogs) {
      const log = logs.find(l => l._id === logId);
      if (!log) continue;
      const correctedIntent = correctionIntents[logId] || log.admin_corrected_intent || log.intent;
      corrections.push({
        log_id: logId,
        intent: correctedIntent,
        utterance: log.message
      });
    }
    if (corrections.length === 0) {
      showError('No logs selected');
      return;
    }
    try {
      const result = await batchAddToCorpus(corrections);
      const added = (result?.data?.results || result?.results || []).filter(r => r.status === 'added').length;
      success(`${added} utterance${added !== 1 ? 's' : ''} added to corpus`);
      setSelectedLogs(new Set());
      setCorrectionIntents({});
      await fetchLogs();
    } catch {
      showError('Failed to add to corpus');
    }
  };

  const toggleLogSelection = (logId) => {
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const formatConfidence = (c) => {
    if (typeof c !== 'number') return '-';
    return `${(c * 100).toFixed(1)}%`;
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading && page === 1) {
    return (
      <Stack gap="var(--space-4)">
        <SkeletonLoader width="180px" height="24px" />
        {/* Summary stat cards */}
        <Flex gap="var(--space-3)" flexWrap="wrap">
          {['Total (30d)', 'Low Confidence', 'Unreviewed', 'LLM Reclassified', 'Avg Confidence'].map(label => (
            <Card key={label} flex="1" minW="140px">
              <CardBody p="var(--space-3)" textAlign="center">
                <SkeletonLoader width="50px" height="28px" style={{ margin: '0 auto' }} />
                <SkeletonLoader width="80px" height="12px" style={{ margin: 'var(--space-1) auto 0' }} />
              </CardBody>
            </Card>
          ))}
        </Flex>
        {/* Filter buttons */}
        <Flex gap="var(--space-2)" flexWrap="wrap" align="center">
          <SkeletonLoader width="130px" height="32px" variant="rectangle" />
          <SkeletonLoader width="100px" height="32px" variant="rectangle" />
          <SkeletonLoader width="200px" height="32px" variant="rectangle" />
          <SkeletonLoader width="32px" height="32px" variant="rectangle" />
        </Flex>
        {/* Table */}
        <Box overflowX="auto">
          <Table>
            <TableHead>
              <TableRow>
                {['', 'Message', 'Intent', 'Confidence', 'LLM', 'Date', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} as="th">
                    {h && <SkeletonLoader width={h === 'Message' ? '60px' : `${Math.max(h.length * 8, 40)}px`} height="14px" />}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[1, 2, 3, 4, 5].map(i => (
                <TableRow key={i}>
                  <TableCell><SkeletonLoader width="14px" height="14px" variant="rectangle" /></TableCell>
                  <TableCell><SkeletonLoader width="180px" height="12px" /></TableCell>
                  <TableCell><SkeletonLoader width="100px" height="18px" variant="rectangle" /></TableCell>
                  <TableCell><SkeletonLoader width="50px" height="18px" variant="rectangle" /></TableCell>
                  <TableCell><SkeletonLoader width="12px" height="12px" /></TableCell>
                  <TableCell><SkeletonLoader width="100px" height="12px" /></TableCell>
                  <TableCell><SkeletonLoader width="60px" height="18px" variant="rectangle" /></TableCell>
                  <TableCell>
                    <Flex gap="var(--space-1)" align="center">
                      <SkeletonLoader width="100px" height="28px" variant="rectangle" />
                      <SkeletonLoader width="28px" height="28px" variant="rectangle" />
                    </Flex>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="var(--space-4)">
      <Heading as="h3" size="heading-3">Classification Logs</Heading>

      {summary && (
        <Flex gap="var(--space-3)" flexWrap="wrap">
          <Card flex="1" minW="140px">
            <CardBody p="var(--space-3)" textAlign="center">
              <Text fontSize="var(--font-size-2xl)" fontWeight="700">{summary.total || 0}</Text>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Total (30d)</Text>
            </CardBody>
          </Card>
          <Card flex="1" minW="140px">
            <CardBody p="var(--space-3)" textAlign="center">
              <Text fontSize="var(--font-size-2xl)" fontWeight="700" color="var(--color-danger)">
                {summary.low_confidence || 0}
              </Text>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Low Confidence</Text>
            </CardBody>
          </Card>
          <Card flex="1" minW="140px">
            <CardBody p="var(--space-3)" textAlign="center">
              <Text fontSize="var(--font-size-2xl)" fontWeight="700">
                {summary.unreviewed || 0}
              </Text>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Unreviewed</Text>
            </CardBody>
          </Card>
          <Card flex="1" minW="140px">
            <CardBody p="var(--space-3)" textAlign="center">
              <Text fontSize="var(--font-size-2xl)" fontWeight="700">
                {summary.llm_reclassified || 0}
              </Text>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">LLM Reclassified</Text>
            </CardBody>
          </Card>
          <Card flex="1" minW="140px">
            <CardBody p="var(--space-3)" textAlign="center">
              <Text fontSize="var(--font-size-2xl)" fontWeight="700">
                {formatConfidence(summary.avg_confidence)}
              </Text>
              <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Avg Confidence</Text>
            </CardBody>
          </Card>
        </Flex>
      )}

      {/* Filters */}
      <Flex gap="var(--space-2)" flexWrap="wrap" align="center">
        <Button
          size="sm"
          variant={filters.low_confidence ? 'gradient' : 'outline'}
          onClick={() => { setPage(1); setFilters(f => ({ ...f, low_confidence: !f.low_confidence })); }}
        >
          Low Confidence Only
        </Button>
        <Button
          size="sm"
          variant={filters.reviewed === false ? 'gradient' : 'outline'}
          onClick={() => { setPage(1); setFilters(f => ({
            ...f,
            reviewed: f.reviewed === false ? undefined : false
          })); }}
        >
          Unreviewed
        </Button>
        <Input
          size="sm"
          placeholder="Filter by intent..."
          value={filters.intent}
          onChange={e => { setPage(1); setFilters(f => ({ ...f, intent: e.target.value })); }}
          maxW="200px"
        />
        <Button size="sm" variant="outline" onClick={() => { setPage(1); fetchLogs(); }}>
          <FaSync />
        </Button>
      </Flex>

      {selectedLogs.size > 0 && (
        <Flex align="center" gap="var(--space-2)">
          <Text fontSize="var(--font-size-sm)">{selectedLogs.size} selected</Text>
          <Button size="sm" variant="gradient" onClick={handleBatchAdd}>
            <FaPlus style={{ marginRight: 'var(--space-1)' }} /> Add to Corpus
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedLogs(new Set())}>
            Clear
          </Button>
        </Flex>
      )}

      {/* Logs Table */}
      <Box overflowX="auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell as="th" width="30px"></TableCell>
              <TableCell as="th">Message</TableCell>
              <TableCell as="th">Intent</TableCell>
              <TableCell as="th">Confidence</TableCell>
              <TableCell as="th">LLM</TableCell>
              <TableCell as="th">Date</TableCell>
              <TableCell as="th">Status</TableCell>
              <TableCell as="th">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log._id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLogs.has(log._id)}
                    onChange={() => toggleLogSelection(log._id)}
                  />
                </TableCell>
                <TableCell>
                  <Text size="xs" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.message}
                  </Text>
                </TableCell>
                <TableCell>
                  <Badge size="sm" fontFamily="monospace">{log.intent}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    size="sm"
                    colorPalette={log.confidence >= 0.65 ? 'green' : log.confidence >= 0.4 ? 'yellow' : 'red'}
                  >
                    {formatConfidence(log.confidence)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {log.llm_reclassified ? (
                    <Badge size="sm" colorPalette="purple">{log.llm_intent}</Badge>
                  ) : (
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">-</Text>
                  )}
                </TableCell>
                <TableCell>
                  <Text fontSize="var(--font-size-xs)">{formatDate(log.createdAt)}</Text>
                </TableCell>
                <TableCell>
                  {log.reviewed ? (
                    <Badge size="sm" colorPalette="green">
                      Reviewed{log.admin_corrected_intent ? ` → ${log.admin_corrected_intent}` : ''}
                    </Badge>
                  ) : (
                    <Badge size="sm" colorPalette="gray">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!log.reviewed && (
                    <Flex gap="var(--space-1)" align="center">
                      <Input
                        size="sm"
                        placeholder="Correct intent"
                        value={correctionIntents[log._id] || ''}
                        onChange={e => setCorrectionIntents(prev => ({ ...prev, [log._id]: e.target.value }))}
                        maxW="120px"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(log._id, correctionIntents[log._id])}
                      >
                        <FaCheck size={10} />
                      </Button>
                    </Flex>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {logs.length === 0 && !loading && (
        <Alert variant="info">No classification logs found matching the current filters.</Alert>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex justify="center" gap="var(--space-2)">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <Text fontSize="var(--font-size-sm)" lineHeight="var(--btn-height-sm)" px="var(--space-2)">
            Page {page} of {totalPages}
          </Text>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </Flex>
      )}
    </Stack>
  );
}
