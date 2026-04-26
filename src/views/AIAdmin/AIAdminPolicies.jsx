/**
 * AI Admin Policies Tab
 *
 * CRUD for global and per-user AI policies including rate limits,
 * token budgets, provider restrictions, and content filtering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Badge, Stack, Input, Textarea } from '@chakra-ui/react';
import { FaPlus, FaEdit, FaTrash, FaGlobe, FaUser, FaTimes } from 'react-icons/fa';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Alert,
  Modal,
  Text,
  Heading,
  Form,
  FormGroup,
  FormLabel,
  FormControl,
  SearchInput,
  EmptyState,
  Pill
} from '../../components/design-system';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import Pagination from '../../components/Pagination/Pagination';
import { getPolicies, createPolicy, updatePolicy, deletePolicy } from '../../utilities/ai-admin-api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { logger } from '../../utilities/logger';

const POLICIES_PER_PAGE = 50;

const EMPTY_POLICY = {
  name: '',
  scope: 'global',
  target: '',
  allowed_providers: '',
  blocked_providers: '',
  rate_limits: { requests_per_minute: '', requests_per_hour: '', requests_per_day: '' },
  token_budget: { daily_input_tokens: '', daily_output_tokens: '', monthly_input_tokens: '', monthly_output_tokens: '' },
  content_filtering: { enabled: false, block_patterns: '', redact_patterns: '' },
  max_tokens_per_request: 4000
};

export default function AIAdminPolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState(EMPTY_POLICY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { success: showSuccess, error: showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const filteredPolicies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return policies.filter(p => {
      if (scopeFilter !== 'all' && p.scope !== scopeFilter) return false;
      if (!term) return true;
      const haystack = [
        p.name,
        p.scope,
        p.target?.name,
        p.target?.email
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [policies, search, scopeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPolicies.length / POLICIES_PER_PAGE));
  const paginatedPolicies = useMemo(() => {
    const start = (page - 1) * POLICIES_PER_PAGE;
    return filteredPolicies.slice(start, start + POLICIES_PER_PAGE);
  }, [filteredPolicies, page]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, scopeFilter]);

  // Clamp page if filtered list shrinks below current page
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getPolicies();
      setPolicies(result?.data?.policies || []);
    } catch (err) {
      logger.error('[AIAdminPolicies] Failed to load policies', { error: err.message });
      setError('Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleCreate = useCallback(() => {
    setEditingPolicy(null);
    setFormData(EMPTY_POLICY);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name || '',
      scope: policy.scope || 'global',
      target: policy.target?._id || policy.target || '',
      allowed_providers: (policy.allowed_providers || []).join(', '),
      blocked_providers: (policy.blocked_providers || []).join(', '),
      rate_limits: {
        requests_per_minute: policy.rate_limits?.requests_per_minute ?? '',
        requests_per_hour: policy.rate_limits?.requests_per_hour ?? '',
        requests_per_day: policy.rate_limits?.requests_per_day ?? ''
      },
      token_budget: {
        daily_input_tokens: policy.token_budget?.daily_input_tokens ?? '',
        daily_output_tokens: policy.token_budget?.daily_output_tokens ?? '',
        monthly_input_tokens: policy.token_budget?.monthly_input_tokens ?? '',
        monthly_output_tokens: policy.token_budget?.monthly_output_tokens ?? ''
      },
      content_filtering: {
        enabled: policy.content_filtering?.enabled || false,
        block_patterns: (policy.content_filtering?.block_patterns || []).join('\n'),
        redact_patterns: (policy.content_filtering?.redact_patterns || []).join('\n')
      },
      max_tokens_per_request: policy.max_tokens_per_request || 4000
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const parseNum = (v) => v === '' || v == null ? null : parseInt(v, 10);
      const data = {
        name: formData.name,
        scope: formData.scope,
        target: formData.scope === 'user' ? formData.target : null,
        allowed_providers: formData.allowed_providers ? formData.allowed_providers.split(',').map(s => s.trim()).filter(Boolean) : [],
        blocked_providers: formData.blocked_providers ? formData.blocked_providers.split(',').map(s => s.trim()).filter(Boolean) : [],
        rate_limits: {
          requests_per_minute: parseNum(formData.rate_limits.requests_per_minute),
          requests_per_hour: parseNum(formData.rate_limits.requests_per_hour),
          requests_per_day: parseNum(formData.rate_limits.requests_per_day)
        },
        token_budget: {
          daily_input_tokens: parseNum(formData.token_budget.daily_input_tokens),
          daily_output_tokens: parseNum(formData.token_budget.daily_output_tokens),
          monthly_input_tokens: parseNum(formData.token_budget.monthly_input_tokens),
          monthly_output_tokens: parseNum(formData.token_budget.monthly_output_tokens)
        },
        content_filtering: {
          enabled: formData.content_filtering.enabled,
          block_patterns: formData.content_filtering.block_patterns ? formData.content_filtering.block_patterns.split('\n').map(s => s.trim()).filter(Boolean) : [],
          redact_patterns: formData.content_filtering.redact_patterns ? formData.content_filtering.redact_patterns.split('\n').map(s => s.trim()).filter(Boolean) : []
        },
        max_tokens_per_request: parseInt(formData.max_tokens_per_request, 10) || 4000
      };

      if (editingPolicy) {
        await updatePolicy(editingPolicy._id, data);
        showSuccess('Policy updated');
      } else {
        await createPolicy(data);
        showSuccess('Policy created');
      }
      setShowForm(false);
      fetchPolicies();
    } catch (err) {
      showError(err.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }, [formData, editingPolicy, fetchPolicies, showSuccess, showError]);

  const handleDelete = useCallback(async (policyId, policyName) => {
    const ok = await confirm({ title: 'Deactivate policy?', message: `Deactivate policy "${policyName}"? This can be reversed by re-enabling it.`, confirmText: 'Deactivate' });
    if (!ok) return;
    try {
      await deletePolicy(policyId);
      setPolicies(prev => prev.filter(p => p._id !== policyId));
      showSuccess('Policy deactivated');
    } catch (err) {
      showError('Failed to deactivate policy');
    }
  }, [showSuccess, showError]);

  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateNestedField = useCallback((parent, field, value) => {
    setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }));
  }, []);

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        {/* Header row */}
        <Flex justify="space-between" align="center">
          <Box>
            <SkeletonLoader width="120px" height="24px" />
            <SkeletonLoader width="320px" height="14px" style={{ marginTop: 'var(--space-1)' }} />
          </Box>
          <SkeletonLoader width="110px" height="36px" variant="rectangle" />
        </Flex>
        {/* Filter row */}
        <Flex gap="var(--space-2)">
          <SkeletonLoader width="280px" height="32px" variant="rectangle" />
          <SkeletonLoader width="60px" height="32px" variant="rectangle" />
          <SkeletonLoader width="70px" height="32px" variant="rectangle" />
          <SkeletonLoader width="60px" height="32px" variant="rectangle" />
        </Flex>
        {/* Policy cards */}
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader>
              <Flex justify="space-between" align="center" width="100%">
                <Flex align="center" gap="var(--space-3)">
                  <SkeletonLoader width="16px" height="16px" />
                  <SkeletonLoader width="140px" height="18px" />
                  <SkeletonLoader width="50px" height="20px" variant="rectangle" />
                  <SkeletonLoader width="50px" height="20px" variant="rectangle" />
                </Flex>
                <Flex gap="var(--space-2)">
                  <SkeletonLoader width="36px" height="32px" variant="rectangle" />
                  <SkeletonLoader width="36px" height="32px" variant="rectangle" />
                </Flex>
              </Flex>
            </CardHeader>
            <CardBody>
              <Flex gap="var(--space-6)" wrap="wrap">
                {['Daily Requests', 'Daily Input Tokens', 'Max Tokens/Req', 'Content Filtering'].map(label => (
                  <Box key={label}>
                    <SkeletonLoader width="90px" height="12px" />
                    <SkeletonLoader width="60px" height="14px" style={{ marginTop: 'var(--space-1)' }} />
                  </Box>
                ))}
              </Flex>
            </CardBody>
          </Card>
        ))}
      </Stack>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const hasActiveFilters = search.trim() !== '' || scopeFilter !== 'all';
  const handleClearFilters = () => {
    setSearch('');
    setScopeFilter('all');
  };

  return (
    <Stack gap="var(--space-4)">
      {ConfirmDialog}
      <Flex justify="space-between" align="center" wrap="wrap" gap="var(--space-3)">
        <Box>
          <Flex align="center" gap="var(--space-2)" wrap="wrap">
            <Heading as="h2" size="heading-3">AI Policies</Heading>
            {policies.length > 0 && (
              <Pill variant="info">
                {hasActiveFilters
                  ? `${filteredPolicies.length} of ${policies.length}`
                  : filteredPolicies.length}
              </Pill>
            )}
          </Flex>
          <Text color="var(--color-text-secondary)" fontSize="var(--font-size-sm)" mt="var(--space-1)">
            Configure guardrails, rate limits, and token budgets per user or globally.
          </Text>
        </Box>
        <Button variant="gradient" size="sm" onClick={handleCreate}>
          <FaPlus /> New Policy
        </Button>
      </Flex>

      {policies.length === 0 ? (
        <EmptyState
          variant="generic"
          icon="🛡️"
          title="No policies configured"
          description="Create a global policy to set default guardrails, rate limits, and token budgets."
          primaryAction="New Policy"
          onPrimaryAction={handleCreate}
          size="md"
          compact
        />
      ) : (
        <>
          <Card>
            <Flex
              align={{ base: 'stretch', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={{ base: 'var(--space-2)', md: 'var(--space-3)' }}
              p="var(--space-3)"
              bg="var(--color-bg-secondary)"
              borderBottom="1px solid var(--color-border-light)"
              wrap="wrap"
            >
              <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                  placeholder="Search policies by name, target user, or email..."
                  size="sm"
                  ariaLabel="Filter policies"
                />
              </Box>
              <Flex gap="var(--space-1)" wrap="wrap">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'global', label: 'Global' },
                  { value: 'user', label: 'User' }
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={scopeFilter === opt.value ? 'gradient' : 'outline'}
                    size="sm"
                    onClick={() => setScopeFilter(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </Flex>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  aria-label="Clear all filters"
                >
                  <FaTimes /> Clear
                </Button>
              )}
            </Flex>
          </Card>

          {filteredPolicies.length === 0 && (
            <EmptyState
              variant="search"
              title="No policies match"
              description="Try adjusting your search or scope filter."
              primaryAction="Clear Filters"
              onPrimaryAction={handleClearFilters}
              size="md"
              compact
            />
          )}
        </>
      )}

      {paginatedPolicies.map(policy => (
        <Card key={policy._id}>
          <CardHeader>
            <Flex justify="space-between" align="center" width="100%">
              <Flex align="center" gap="var(--space-3)">
                {policy.scope === 'global' ? <FaGlobe /> : <FaUser />}
                <Heading as="h3" size="heading-5">
                  {policy.name}
                </Heading>
                <Badge colorPalette={policy.active ? 'green' : 'gray'} variant="subtle" fontSize="var(--font-size-xs)">
                  {policy.active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" fontSize="var(--font-size-xs)">
                  {policy.scope}
                </Badge>
              </Flex>
              <Flex gap="var(--space-2)">
                <Button variant="outline" size="sm" onClick={() => handleEdit(policy)}>
                  <FaEdit />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(policy._id, policy.name)}>
                  <FaTrash />
                </Button>
              </Flex>
            </Flex>
          </CardHeader>
          <CardBody>
            <Flex gap="var(--space-6)" wrap="wrap">
              {policy.scope === 'user' && policy.target && (
                <Box>
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Target User</Text>
                  <Text fontSize="var(--font-size-sm)">{policy.target.name || policy.target.email || policy.target}</Text>
                </Box>
              )}
              {policy.rate_limits?.requests_per_day != null && (
                <Box>
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Daily Requests</Text>
                  <Text fontSize="var(--font-size-sm)">{policy.rate_limits.requests_per_day}</Text>
                </Box>
              )}
              {policy.token_budget?.daily_input_tokens != null && (
                <Box>
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Daily Input Tokens</Text>
                  <Text fontSize="var(--font-size-sm)">{policy.token_budget.daily_input_tokens.toLocaleString()}</Text>
                </Box>
              )}
              <Box>
                <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Max Tokens/Request</Text>
                <Text fontSize="var(--font-size-sm)">{policy.max_tokens_per_request}</Text>
              </Box>
              <Box>
                <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Content Filtering</Text>
                <Text fontSize="var(--font-size-sm)">{policy.content_filtering?.enabled ? 'Enabled' : 'Disabled'}</Text>
              </Box>
            </Flex>
          </CardBody>
        </Card>
      ))}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalResults={filteredPolicies.length}
        resultsPerPage={POLICIES_PER_PAGE}
        onPageChange={setPage}
        variant="compact"
      />

      <Modal
        show={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        centered
      >
        <Box p="var(--space-4)">
          <Heading as="h3" size="heading-3" mb="var(--space-4)">
            {editingPolicy ? 'Edit Policy' : 'Create Policy'}
          </Heading>

          <Stack gap="var(--space-4)">
            <FormGroup>
              <FormLabel>Policy Name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="e.g., Global Default, Premium User"
              />
            </FormGroup>

            {!editingPolicy && (
              <FormGroup>
                <FormLabel>Scope</FormLabel>
                <Flex gap="var(--space-3)">
                  <Button
                    variant={formData.scope === 'global' ? 'gradient' : 'outline'}
                    size="sm"
                    onClick={() => updateFormField('scope', 'global')}
                  >
                    <FaGlobe /> Global
                  </Button>
                  <Button
                    variant={formData.scope === 'user' ? 'gradient' : 'outline'}
                    size="sm"
                    onClick={() => updateFormField('scope', 'user')}
                  >
                    <FaUser /> User
                  </Button>
                </Flex>
              </FormGroup>
            )}

            {formData.scope === 'user' && !editingPolicy && (
              <FormGroup>
                <FormLabel>Target User ID</FormLabel>
                <Input
                  value={formData.target}
                  onChange={(e) => updateFormField('target', e.target.value)}
                  placeholder="MongoDB User ID"
                />
              </FormGroup>
            )}

            <FormGroup>
              <FormLabel>Allowed Providers (comma-separated, empty = all)</FormLabel>
              <Input
                value={formData.allowed_providers}
                onChange={(e) => updateFormField('allowed_providers', e.target.value)}
                placeholder="openai, anthropic"
              />
            </FormGroup>

            <FormGroup>
              <FormLabel>Blocked Providers (comma-separated)</FormLabel>
              <Input
                value={formData.blocked_providers}
                onChange={(e) => updateFormField('blocked_providers', e.target.value)}
                placeholder="mistral"
              />
            </FormGroup>

            <Heading as="h4" size="heading-6">
              Rate Limits
            </Heading>

            <Flex gap="var(--space-3)" wrap="wrap">
              <Box flex="1" minW="120px">
                <FormLabel>Per Minute</FormLabel>
                <Input
                  type="number"
                  value={formData.rate_limits.requests_per_minute}
                  onChange={(e) => updateNestedField('rate_limits', 'requests_per_minute', e.target.value)}
                  placeholder="No limit"
                />
              </Box>
              <Box flex="1" minW="120px">
                <FormLabel>Per Hour</FormLabel>
                <Input
                  type="number"
                  value={formData.rate_limits.requests_per_hour}
                  onChange={(e) => updateNestedField('rate_limits', 'requests_per_hour', e.target.value)}
                  placeholder="No limit"
                />
              </Box>
              <Box flex="1" minW="120px">
                <FormLabel>Per Day</FormLabel>
                <Input
                  type="number"
                  value={formData.rate_limits.requests_per_day}
                  onChange={(e) => updateNestedField('rate_limits', 'requests_per_day', e.target.value)}
                  placeholder="No limit"
                />
              </Box>
            </Flex>

            <Heading as="h4" size="heading-6">
              Token Budget
            </Heading>

            <Flex gap="var(--space-3)" wrap="wrap">
              <Box flex="1" minW="140px">
                <FormLabel>Daily Input</FormLabel>
                <Input
                  type="number"
                  value={formData.token_budget.daily_input_tokens}
                  onChange={(e) => updateNestedField('token_budget', 'daily_input_tokens', e.target.value)}
                  placeholder="Unlimited"
                />
              </Box>
              <Box flex="1" minW="140px">
                <FormLabel>Daily Output</FormLabel>
                <Input
                  type="number"
                  value={formData.token_budget.daily_output_tokens}
                  onChange={(e) => updateNestedField('token_budget', 'daily_output_tokens', e.target.value)}
                  placeholder="Unlimited"
                />
              </Box>
              <Box flex="1" minW="140px">
                <FormLabel>Monthly Input</FormLabel>
                <Input
                  type="number"
                  value={formData.token_budget.monthly_input_tokens}
                  onChange={(e) => updateNestedField('token_budget', 'monthly_input_tokens', e.target.value)}
                  placeholder="Unlimited"
                />
              </Box>
              <Box flex="1" minW="140px">
                <FormLabel>Monthly Output</FormLabel>
                <Input
                  type="number"
                  value={formData.token_budget.monthly_output_tokens}
                  onChange={(e) => updateNestedField('token_budget', 'monthly_output_tokens', e.target.value)}
                  placeholder="Unlimited"
                />
              </Box>
            </Flex>

            <FormGroup>
              <FormLabel>Max Tokens Per Request</FormLabel>
              <Input
                type="number"
                value={formData.max_tokens_per_request}
                onChange={(e) => updateFormField('max_tokens_per_request', e.target.value)}
              />
            </FormGroup>

            <Flex gap="var(--space-3)" pt="var(--space-2)" justify="flex-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="gradient" onClick={handleSave} disabled={saving || !formData.name}>
                {saving ? 'Saving...' : (editingPolicy ? 'Update Policy' : 'Create Policy')}
              </Button>
            </Flex>
          </Stack>
        </Box>
      </Modal>
    </Stack>
  );
}
