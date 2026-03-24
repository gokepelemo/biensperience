/**
 * AI Admin Usage Tab
 *
 * Usage analytics dashboard with summary stats, daily breakdown,
 * and per-user usage drill-down. When multiple AI providers have
 * usage data, a dropdown lets the admin scope stats to a single provider.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Badge, Stack, Input, NativeSelect } from '@chakra-ui/react';
import { FaSync } from 'react-icons/fa';
import { Button, Card, CardHeader, CardBody, Alert } from '../../components/design-system';
import { Text, Heading } from '../../components/design-system';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/design-system';
import { FormGroup, FormLabel } from '../../components/design-system';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { getUsageSummary, getUsage } from '../../utilities/ai-admin-api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  gemini: 'Gemini'
};

const ALL_PROVIDERS = '__all__';

export default function AIAdminUsage() {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [filterUserId, setFilterUserId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(ALL_PROVIDERS);
  const { error: showError } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { limit: 50 };
      if (filterUserId.trim()) params.userId = filterUserId.trim();

      const [summaryResult, usageResult] = await Promise.all([
        getUsageSummary(days),
        getUsage(params)
      ]);

      setSummary(summaryResult?.data || null);
      setRecords(usageResult?.data?.usage || []);
    } catch (err) {
      logger.error('[AIAdminUsage] Failed to load usage data', { error: err.message });
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [days, filterUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** List of providers that have usage data */
  const availableProviders = useMemo(() => {
    const breakdown = summary?.provider_breakdown || [];
    return breakdown.map(p => p._id).filter(Boolean).sort();
  }, [summary]);

  const hasMultipleProviders = availableProviders.length > 1;

  /** Totals scoped to selected provider */
  const totals = useMemo(() => {
    if (selectedProvider === ALL_PROVIDERS) {
      return summary?.summary || {};
    }
    const match = (summary?.provider_breakdown || []).find(p => p._id === selectedProvider);
    if (!match) return { total_requests: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_estimate: 0 };
    return {
      total_requests: match.requests,
      total_input_tokens: match.input_tokens,
      total_output_tokens: match.output_tokens,
      total_cost_estimate: null // not available per-provider
    };
  }, [summary, selectedProvider]);

  /** Daily breakdown scoped to selected provider */
  const dailyBreakdown = useMemo(() => {
    if (selectedProvider === ALL_PROVIDERS) {
      return summary?.daily || [];
    }
    return (summary?.provider_daily || [])
      .filter(d => d._id?.provider === selectedProvider)
      .map(d => ({
        date: d._id?.date,
        requests: d.requests,
        input_tokens: d.input_tokens,
        output_tokens: d.output_tokens
      }));
  }, [summary, selectedProvider]);

  // Reset provider selection when data reloads and selected provider no longer present
  useEffect(() => {
    if (selectedProvider !== ALL_PROVIDERS && !availableProviders.includes(selectedProvider)) {
      setSelectedProvider(ALL_PROVIDERS);
    }
  }, [availableProviders, selectedProvider]);

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        {/* Header row */}
        <Flex justify="space-between" align="center" wrap="wrap" gap="var(--space-3)">
          <Box>
            <SkeletonLoader width="160px" height="24px" />
            <SkeletonLoader width="280px" height="14px" style={{ marginTop: 'var(--space-1)' }} />
          </Box>
          <Flex gap="var(--space-2)">
            {[1, 2, 3, 4].map(i => (
              <SkeletonLoader key={i} width="60px" height="32px" variant="rectangle" />
            ))}
            <SkeletonLoader width="80px" height="32px" variant="rectangle" />
          </Flex>
        </Flex>
        {/* Stat cards */}
        <Flex gap="var(--space-4)" wrap="wrap">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} flex="1" minW="150px">
              <CardBody>
                <SkeletonLoader width="80px" height="12px" />
                <SkeletonLoader width="60px" height="28px" style={{ marginTop: 'var(--space-1)' }} />
              </CardBody>
            </Card>
          ))}
        </Flex>
        {/* Daily breakdown table */}
        <Card>
          <CardHeader>
            <SkeletonLoader width="140px" height="18px" />
          </CardHeader>
          <CardBody>
            <Stack gap="var(--space-3)">
              {/* Table header */}
              <Flex gap="var(--space-4)">
                {[80, 70, 90, 90, 70].map((w, i) => (
                  <SkeletonLoader key={i} width={`${w}px`} height="14px" />
                ))}
              </Flex>
              {/* Table rows */}
              {[1, 2, 3, 4, 5].map(i => (
                <Flex key={i} gap="var(--space-4)">
                  {[80, 50, 60, 60, 50].map((w, j) => (
                    <SkeletonLoader key={j} width={`${w}px`} height="14px" />
                  ))}
                </Flex>
              ))}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const showCost = selectedProvider === ALL_PROVIDERS;

  return (
    <Stack gap="var(--space-4)">
      <Flex justify="space-between" align="center" wrap="wrap" gap="var(--space-3)">
        <Box>
          <Heading as="h2" fontSize="var(--font-size-lg)" fontWeight="var(--font-weight-semibold)">
            Usage Analytics
          </Heading>
          <Text color="var(--color-text-secondary)" fontSize="var(--font-size-sm)">
            AI request volume, token usage, and cost estimates.
          </Text>
        </Box>
        <Flex align="center" gap="var(--space-3)" wrap="wrap">
          {hasMultipleProviders && (
            <NativeSelect.Root size="sm" w="auto">
              <NativeSelect.Field
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                aria-label="Filter by AI provider"
              >
                <option value={ALL_PROVIDERS}>All Providers</option>
                {availableProviders.map(p => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          )}
          <Flex gap="var(--space-2)">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={days === opt.value ? 'gradient' : 'outline'}
                size="sm"
                onClick={() => setDays(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </Flex>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <FaSync /> Refresh
          </Button>
        </Flex>
      </Flex>

      {/* Provider breakdown pills (always visible when multiple providers) */}
      {hasMultipleProviders && (
        <Flex gap="var(--space-3)" wrap="wrap">
          {(summary?.provider_breakdown || []).map(p => (
            <Card key={p._id} flex="1" minW="140px" cursor="pointer"
              onClick={() => setSelectedProvider(p._id === selectedProvider ? ALL_PROVIDERS : p._id)}
              borderColor={selectedProvider === p._id ? 'var(--color-primary)' : undefined}
              borderWidth={selectedProvider === p._id ? '2px' : '1px'}
            >
              <CardBody padding="var(--space-3)">
                <Flex justify="space-between" align="center" mb="var(--space-1)">
                  <Text fontSize="var(--font-size-xs)" fontWeight="var(--font-weight-semibold)" color="var(--color-text-secondary)">
                    {PROVIDER_LABELS[p._id] || p._id}
                  </Text>
                  <Badge variant="subtle" colorPalette={selectedProvider === p._id ? 'blue' : 'gray'} fontSize="var(--font-size-xs)">
                    {p.requests?.toLocaleString()} req
                  </Badge>
                </Flex>
                <Flex gap="var(--space-3)">
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">
                    In: {formatTokens(p.input_tokens)}
                  </Text>
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">
                    Out: {formatTokens(p.output_tokens)}
                  </Text>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Flex>
      )}

      {/* Summary Cards */}
      <Flex gap="var(--space-4)" wrap="wrap">
        <StatCard label="Total Requests" value={totals.total_requests?.toLocaleString() || '0'} />
        <StatCard label="Input Tokens" value={formatTokens(totals.total_input_tokens)} />
        <StatCard label="Output Tokens" value={formatTokens(totals.total_output_tokens)} />
        {showCost && <StatCard label="Est. Cost" value={formatCost(totals.total_cost_estimate)} />}
        {showCost && <StatCard label="Unique Users" value={totals.unique_users?.toLocaleString() || '0'} />}
      </Flex>

      {/* Daily Breakdown */}
      {dailyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <Heading as="h3" fontSize="var(--font-size-md)" fontWeight="var(--font-weight-semibold)">
              Daily Breakdown
              {selectedProvider !== ALL_PROVIDERS && (
                <Badge variant="subtle" colorPalette="blue" ml="var(--space-2)" fontSize="var(--font-size-xs)">
                  {PROVIDER_LABELS[selectedProvider] || selectedProvider}
                </Badge>
              )}
            </Heading>
          </CardHeader>
          <CardBody>
            <Box overflowX="auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell as="th">Date</TableCell>
                    <TableCell as="th">Requests</TableCell>
                    <TableCell as="th">Input Tokens</TableCell>
                    <TableCell as="th">Output Tokens</TableCell>
                    {showCost && <TableCell as="th">Est. Cost</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyBreakdown.map(day => (
                    <TableRow key={day.date || day._id}>
                      <TableCell>{formatDate(day.date || day._id)}</TableCell>
                      <TableCell>{day.requests?.toLocaleString() || 0}</TableCell>
                      <TableCell>{formatTokens(day.input_tokens)}</TableCell>
                      <TableCell>{formatTokens(day.output_tokens)}</TableCell>
                      {showCost && <TableCell>{formatCost(day.cost_estimate)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      )}

      {/* Per-User Records */}
      <Card>
        <CardHeader>
          <Flex justify="space-between" align="center" width="100%" wrap="wrap" gap="var(--space-3)">
            <Heading as="h3" fontSize="var(--font-size-md)" fontWeight="var(--font-weight-semibold)">
              Usage Records
            </Heading>
            <FormGroup>
              <Input
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                placeholder="Filter by User ID"
                size="sm"
                maxW="240px"
              />
            </FormGroup>
          </Flex>
        </CardHeader>
        <CardBody>
          {records.length === 0 ? (
            <Text color="var(--color-text-secondary)" fontSize="var(--font-size-sm)">
              No usage records found for the selected period.
            </Text>
          ) : (
            <Box overflowX="auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell as="th">User</TableCell>
                    <TableCell as="th">Date</TableCell>
                    <TableCell as="th">Requests</TableCell>
                    <TableCell as="th">Input Tokens</TableCell>
                    <TableCell as="th">Output Tokens</TableCell>
                    <TableCell as="th">Providers</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record._id}>
                      <TableCell>
                        <Text fontSize="var(--font-size-sm)">
                          {record.user?.name || record.user?.email || record.user || 'Unknown'}
                        </Text>
                      </TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.total_requests?.toLocaleString() || 0}</TableCell>
                      <TableCell>{formatTokens(record.total_input_tokens)}</TableCell>
                      <TableCell>{formatTokens(record.total_output_tokens)}</TableCell>
                      <TableCell>
                        <Flex gap="var(--space-1)" wrap="wrap">
                          {(record.providers || []).map(p => (
                            <Badge key={p.provider} variant="outline" fontSize="var(--font-size-xs)">
                              {PROVIDER_LABELS[p.provider] || p.provider} ({p.requests})
                            </Badge>
                          ))}
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>
    </Stack>
  );
}

function StatCard({ label, value }) {
  return (
    <Card flex="1" minW="150px">
      <CardBody>
        <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">{label}</Text>
        <Text fontSize="var(--font-size-xl)" fontWeight="var(--font-weight-bold)">{value}</Text>
      </CardBody>
    </Card>
  );
}

function formatTokens(count) {
  if (count == null || count === 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatCost(cost) {
  if (cost == null || cost === 0) return '$0.00';
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
