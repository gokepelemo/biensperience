/**
 * AI Admin Routing Tab
 *
 * Configure task/intent → provider routing rules.
 * Each rule routes by AI task. When the task is "bienbot", an optional
 * intent can further refine routing. Both task and intent support custom
 * (user-defined) values for dynamically created tasks/intents.
 *
 * Rules with task+intent are matched first (most specific).
 */

import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import { Box, Flex, Badge, Stack, Input, Separator } from '@chakra-ui/react';
import { FaPlus, FaTrash, FaSave, FaRoute, FaRobot, FaBrain } from 'react-icons/fa';
import { Button, Pill } from '../../components/design-system';
import { Text, Heading } from '../../components/design-system';
import { FormGroup, FormLabel } from '../../components/design-system';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import Alert from '../../components/Alert/Alert';
import { getRouting, updateRouting } from '../../utilities/ai-admin-api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';

const CUSTOM_VALUE = '__custom__';

const AVAILABLE_TASKS = [
  'autocomplete',
  'edit_language',
  'improve_description',
  'summarize',
  'generate_tips',
  'translate',
  'bienbot',
  'document_parse'
];

const AVAILABLE_PROVIDERS = ['openai', 'anthropic', 'mistral', 'gemini'];

const TASK_LABELS = {
  autocomplete: 'Autocomplete',
  edit_language: 'Edit Language',
  improve_description: 'Improve Description',
  summarize: 'Summarize',
  generate_tips: 'Generate Tips',
  translate: 'Translate',
  bienbot: 'BienBot',
  document_parse: 'Document Parse'
};

const INTENT_LABELS = {
  QUERY_DESTINATION: 'Query Destination',
  PLAN_EXPERIENCE: 'Plan Experience',
  CREATE_EXPERIENCE: 'Create Experience',
  ADD_PLAN_ITEMS: 'Add Plan Items',
  INVITE_COLLABORATOR: 'Invite Collaborator',
  SYNC_PLAN: 'Sync Plan',
  ANSWER_QUESTION: 'Answer Question'
};

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  gemini: 'Gemini'
};

const EMPTY_RULE = {
  task: '',
  intent: '',
  provider: '',
  model: '',
  max_tokens: '',
  temperature: ''
};

/** Check whether a task value is a known predefined task */
function isKnownTask(task) {
  return AVAILABLE_TASKS.includes(task);
}

/** Check whether an intent value is a known predefined intent */
function isKnownIntent(intent) {
  return Object.prototype.hasOwnProperty.call(INTENT_LABELS, intent);
}

/** Return a human label describing what a rule matches on */
function ruleMatchLabel(rule) {
  const parts = [];
  if (rule.task) parts.push(TASK_LABELS[rule.task] || rule.task);
  if (rule.intent) parts.push(INTENT_LABELS[rule.intent] || rule.intent);
  return parts.join(' + ') || 'Unconfigured';
}

export default function AIAdminRouting() {
  const [rules, setRules] = useState([]);
  const [availableIntents, setAvailableIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { success: showSuccess, error: showError } = useToast();

  const fetchRouting = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getRouting();
      const taskRouting = result?.data?.task_routing || [];
      setRules(taskRouting.map(r => ({
        task: r.task || '',
        intent: r.intent || '',
        provider: r.provider || '',
        model: r.model || '',
        max_tokens: r.max_tokens ?? '',
        temperature: r.temperature ?? ''
      })));
      if (result?.data?.available_intents?.length) {
        setAvailableIntents(result.data.available_intents);
      } else {
        setAvailableIntents(Object.keys(INTENT_LABELS));
      }
      setHasChanges(false);
    } catch (err) {
      logger.error('[AIAdminRouting] Failed to load routing', { error: err.message });
      setError('Failed to load routing configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRouting(); }, [fetchRouting]);

  const handleAddRule = useCallback(() => {
    setRules(prev => [...prev, { ...EMPTY_RULE }]);
    setHasChanges(true);
  }, []);

  const handleRemoveRule = useCallback((index) => {
    setRules(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  const handleUpdateRule = useCallback((index, field, value) => {
    setRules(prev => prev.map((rule, i) => {
      if (i !== index) return rule;
      const updated = { ...rule, [field]: value };
      // Clear intent when task changes away from bienbot
      if (field === 'task' && value !== 'bienbot' && rule.intent) {
        updated.intent = '';
      }
      return updated;
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    for (const rule of rules) {
      if (!rule.task && !rule.intent) {
        showError('Each rule must specify a task, an intent, or both');
        return;
      }
      if (!rule.provider) {
        showError('Each rule must specify a provider');
        return;
      }
    }

    try {
      setSaving(true);
      const taskRouting = rules
        .filter(r => (r.task || r.intent) && r.provider)
        .map(r => ({
          task: r.task || undefined,
          intent: r.intent || undefined,
          provider: r.provider,
          model: r.model || undefined,
          max_tokens: r.max_tokens ? parseInt(r.max_tokens, 10) : undefined,
          temperature: r.temperature !== '' ? parseFloat(r.temperature) : undefined
        }));

      await updateRouting(taskRouting);
      showSuccess('Routing configuration saved');
      setHasChanges(false);
    } catch (err) {
      showError('Failed to save routing configuration');
    } finally {
      setSaving(false);
    }
  }, [rules, showSuccess, showError]);

  /** Group rules by specificity for display */
  const groupedRules = useMemo(() => {
    const taskAndIntent = [];
    const taskOnly = [];
    const incomplete = [];

    rules.forEach((rule, index) => {
      const item = { rule, index };
      if (rule.task && rule.intent) taskAndIntent.push(item);
      else if (rule.task) taskOnly.push(item);
      else incomplete.push(item);
    });

    return { taskAndIntent, taskOnly, incomplete };
  }, [rules]);

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        <SkeletonLoader height="60px" />
        <SkeletonLoader height="200px" />
      </Stack>
    );
  }

  if (error) {
    return <Alert type="danger">{error}</Alert>;
  }

  const intentsForDropdown = availableIntents.length > 0 ? availableIntents : Object.keys(INTENT_LABELS);

  return (
    <Stack gap="var(--space-5)">
      {/* Header */}
      <Flex justify="space-between" align="center" wrap="wrap" gap="var(--space-3)">
        <Box>
          <Heading as="h2" fontSize="var(--font-size-lg)" fontWeight="var(--font-weight-semibold)">
            <FaRoute style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Task &amp; Intent Routing
          </Heading>
          <Text color="var(--color-text-secondary)" fontSize="var(--font-size-sm)" mt="var(--space-1)">
            Map AI tasks to specific providers and models. For BienBot tasks, you can also route by intent. Select &ldquo;Custom&rdquo; to enter a dynamic task or intent not in the list. Rules are evaluated in specificity order: task+intent, then task-only. Unrouted requests use the default provider.
          </Text>
        </Box>
        <Flex gap="var(--space-2)">
          <Button variant="outline" size="sm" onClick={handleAddRule}>
            <FaPlus style={{ marginRight: 4 }} /> Add Rule
          </Button>
          {hasChanges && (
            <Button variant="gradient" size="sm" onClick={handleSave} disabled={saving}>
              <FaSave style={{ marginRight: 4 }} /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </Flex>
      </Flex>

      {rules.length === 0 && (
        <Alert type="info">
          No routing rules configured. All tasks will use the highest-priority enabled provider.
        </Alert>
      )}

      {/* Priority overview badges */}
      {rules.length > 0 && (
        <Flex gap="var(--space-2)" wrap="wrap" align="center">
          <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" fontWeight="var(--font-weight-medium)">
            Priority:
          </Text>
          <Pill variant="primary" outline>Task + Intent (highest)</Pill>
          <Pill variant="info" outline>Task only</Pill>
        </Flex>
      )}

      {/* Task + Intent Rules */}
      {groupedRules.taskAndIntent.length > 0 && (
        <RuleSection
          title="Task + Intent Rules"
          subtitle="Most specific — matched first"
          icon={<><FaRobot style={{ marginRight: 4 }} /><FaBrain style={{ marginRight: 4 }} /></>}
          colorPalette="purple"
          items={groupedRules.taskAndIntent}
          intentsForDropdown={intentsForDropdown}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
        />
      )}

      {/* Task-Only Rules */}
      {groupedRules.taskOnly.length > 0 && (
        <RuleSection
          title="Task Rules"
          subtitle="Matched when no task+intent rule applies"
          icon={<FaRobot style={{ marginRight: 4 }} />}
          colorPalette="blue"
          items={groupedRules.taskOnly}
          intentsForDropdown={intentsForDropdown}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
        />
      )}

      {/* Incomplete Rules (new, not yet configured) */}
      {groupedRules.incomplete.length > 0 && (
        <RuleSection
          title="New Rules"
          subtitle="Configure a task and optionally an intent"
          icon={<FaPlus style={{ marginRight: 4 }} />}
          colorPalette="gray"
          items={groupedRules.incomplete}
          intentsForDropdown={intentsForDropdown}
          onUpdateRule={handleUpdateRule}
          onRemoveRule={handleRemoveRule}
        />
      )}
    </Stack>
  );
}

/**
 * Section container for a group of routing rules
 */
function RuleSection({ title, subtitle, icon, colorPalette, items, intentsForDropdown, onUpdateRule, onRemoveRule }) {
  return (
    <Box>
      <Flex align="center" gap="var(--space-2)" mb="var(--space-2)">
        <Text fontSize="var(--font-size-sm)" fontWeight="var(--font-weight-semibold)" color="var(--color-text-primary)">
          {icon}{title}
        </Text>
        <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">
          — {subtitle}
        </Text>
      </Flex>
      <Stack gap="var(--space-3)">
        {items.map(({ rule, index }) => (
          <RoutingRuleCard
            key={index}
            rule={rule}
            index={index}
            colorPalette={colorPalette}
            intentsForDropdown={intentsForDropdown}
            onUpdate={onUpdateRule}
            onRemove={onRemoveRule}
          />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * A combobox-style selector: dropdown with known options plus a
 * "Custom..." option that reveals a free-text input for dynamic values.
 */
function ComboSelect({ value, options, labels, placeholder, customPlaceholder, onChange }) {
  const uid = useId();
  const isCustom = value && !options.includes(value);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const [customText, setCustomText] = useState(isCustom ? value : '');

  // Sync if value changes externally (e.g., cleared by parent)
  useEffect(() => {
    if (!value) {
      setShowCustomInput(false);
      setCustomText('');
    } else if (value && !options.includes(value)) {
      setShowCustomInput(true);
      setCustomText(value);
    } else {
      setShowCustomInput(false);
      setCustomText('');
    }
  }, [value, options]);

  const selectStyle = {
    width: '100%',
    height: 'var(--btn-height-sm)',
    borderRadius: 'var(--space-2)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)',
    fontSize: 'var(--font-size-sm)'
  };

  const handleSelectChange = (e) => {
    const selected = e.target.value;
    if (selected === CUSTOM_VALUE) {
      setShowCustomInput(true);
      setCustomText('');
      onChange('');
    } else {
      setShowCustomInput(false);
      setCustomText('');
      onChange(selected);
    }
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomText(val);
    onChange(val);
  };

  const handleCancelCustom = () => {
    setShowCustomInput(false);
    setCustomText('');
    onChange('');
  };

  if (showCustomInput) {
    return (
      <Flex gap="var(--space-1)" align="center">
        <Input
          id={uid}
          value={customText}
          onChange={handleCustomChange}
          placeholder={customPlaceholder || 'Enter custom value...'}
          size="sm"
          flex="1"
          autoFocus
        />
        <Box
          as="button"
          type="button"
          onClick={handleCancelCustom}
          fontSize="var(--font-size-xs)"
          color="var(--color-text-secondary)"
          cursor="pointer"
          px="var(--space-1)"
          title="Switch back to list"
          _hover={{ color: 'var(--color-text-primary)' }}
        >
          ✕
        </Box>
      </Flex>
    );
  }

  return (
    <select
      value={value}
      onChange={handleSelectChange}
      style={selectStyle}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {(labels && labels[opt]) || opt}
        </option>
      ))}
      <option value={CUSTOM_VALUE}>Custom…</option>
    </select>
  );
}

/**
 * A single routing rule card with two rows:
 * Row 1: Task (+ Intent if bienbot) → Provider
 * Row 2: Model / Max Tokens / Temperature (optional parameters)
 */
function RoutingRuleCard({ rule, index, colorPalette, intentsForDropdown, onUpdate, onRemove }) {
  const selectStyle = {
    width: '100%',
    height: 'var(--btn-height-sm)',
    borderRadius: 'var(--space-2)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)',
    fontSize: 'var(--font-size-sm)'
  };

  const showIntent = rule.task === 'bienbot';

  return (
    <Box
      p="var(--space-4)"
      borderRadius="var(--space-3)"
      border="1px solid"
      borderColor="var(--color-border)"
      bg="var(--color-bg-primary)"
      _hover={{ borderColor: `var(--chakra-colors-${colorPalette}-300, var(--color-border))` }}
      transition="border-color 0.2s"
    >
      {/* Row 1: Matching criteria and Provider */}
      <Flex gap="var(--space-3)" wrap="wrap" align="flex-end">
        <Box flex="1" minW="150px">
          <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
            Task
          </FormLabel>
          <ComboSelect
            value={rule.task}
            options={AVAILABLE_TASKS}
            labels={TASK_LABELS}
            placeholder="Select task..."
            customPlaceholder="e.g. my_custom_task"
            onChange={(val) => onUpdate(index, 'task', val)}
          />
        </Box>

        {showIntent && (
          <Box flex="1" minW="160px">
            <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
              <FaBrain style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Intent
            </FormLabel>
            <ComboSelect
              value={rule.intent}
              options={intentsForDropdown}
              labels={INTENT_LABELS}
              placeholder="Any intent"
              customPlaceholder="e.g. MY_CUSTOM_INTENT"
              onChange={(val) => onUpdate(index, 'intent', val)}
            />
          </Box>
        )}

        <Box
          display="flex"
          alignItems="center"
          fontSize="var(--font-size-lg)"
          color="var(--color-text-secondary)"
          pb="var(--space-1)"
          userSelect="none"
        >
          →
        </Box>

        <Box flex="1" minW="140px">
          <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
            Provider
          </FormLabel>
          <select
            value={rule.provider}
            onChange={(e) => onUpdate(index, 'provider', e.target.value)}
            style={{
              ...selectStyle,
              borderColor: !rule.provider && (rule.task || rule.intent) ? 'var(--color-danger)' : undefined
            }}
          >
            <option value="">Select provider...</option>
            {AVAILABLE_PROVIDERS.map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
            ))}
          </select>
        </Box>

        <Button
          variant="danger"
          size="sm"
          onClick={() => onRemove(index)}
          style={{ alignSelf: 'flex-end' }}
          title="Remove rule"
        >
          <FaTrash />
        </Button>
      </Flex>

      {/* Row 2: Optional parameters */}
      <Separator my="var(--space-3)" borderColor="var(--color-border)" />
      <Flex gap="var(--space-3)" wrap="wrap" align="flex-end">
        <Box flex="2" minW="160px">
          <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
            Model (optional)
          </FormLabel>
          <Input
            value={rule.model}
            onChange={(e) => onUpdate(index, 'model', e.target.value)}
            placeholder="Default model"
            size="sm"
          />
        </Box>

        <Box flex="1" minW="100px">
          <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
            Max Tokens
          </FormLabel>
          <Input
            type="number"
            value={rule.max_tokens}
            onChange={(e) => onUpdate(index, 'max_tokens', e.target.value)}
            placeholder="4000"
            size="sm"
            min={1}
          />
        </Box>

        <Box flex="1" minW="100px">
          <FormLabel fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
            Temperature
          </FormLabel>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={rule.temperature}
            onChange={(e) => onUpdate(index, 'temperature', e.target.value)}
            placeholder="0.7"
            size="sm"
          />
        </Box>
      </Flex>

      {/* Summary badge */}
      {(rule.task || rule.intent) && rule.provider && (
        <Flex mt="var(--space-3)" gap="var(--space-2)" align="center" wrap="wrap">
          <Badge variant="subtle" colorPalette={colorPalette} fontSize="var(--font-size-xs)">
            {ruleMatchLabel(rule)}
          </Badge>
          <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">→</Text>
          <Badge variant="subtle" colorPalette="green" fontSize="var(--font-size-xs)">
            {PROVIDER_LABELS[rule.provider] || rule.provider}{rule.model ? ` / ${rule.model}` : ''}
          </Badge>
        </Flex>
      )}
    </Box>
  );
}
