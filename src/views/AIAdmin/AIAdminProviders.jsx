/**
 * AI Admin Providers Tab
 *
 * Manage AI provider configurations - enable/disable, update models, endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Flex, Badge, Switch, Stack, Input, Textarea } from '@chakra-ui/react';
import { FaEdit, FaSave } from 'react-icons/fa';
import { Button, Card, CardHeader, CardBody, Alert } from '../../components/design-system';
import { Text, Heading } from '../../components/design-system';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { getProviders, updateProvider } from '../../utilities/ai-admin-api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';

/* ------------------------------------------------------------------ */
/* Provider brand config: colors + inline SVG logos                    */
/* ------------------------------------------------------------------ */

const PROVIDER_BRANDS = {
  openai: {
    color: '#10a37f',
    bg: 'rgba(16, 163, 127, 0.06)',
    border: 'rgba(16, 163, 127, 0.35)',
    logo: (
      <svg viewBox="0 0 320 320" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-label="OpenAI logo">
        <path d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z" fill="currentColor"/>
      </svg>
    )
  },
  anthropic: {
    color: '#cc785c',
    bg: 'rgba(204, 120, 92, 0.06)',
    border: 'rgba(204, 120, 92, 0.35)',
    logo: (
      <svg viewBox="0 0 96 96" width="28" height="28" xmlns="http://www.w3.org/2000/svg" fill="none" aria-label="Anthropic logo">
        <path fill="currentColor" d="m55.1553 15.728 25.733 64.5443h14.1116L69.2669 15.728H55.1553Z" strokeWidth="1"/>
        <path fill="currentColor" d="m25.3015 54.7311 8.805-22.6826 8.8051 22.6826H25.3015ZM26.729 15.728 1 80.2723h14.3861l5.262-13.5544h26.9177l5.2611 13.5544h14.3862L41.484 15.728H26.729Z" strokeWidth="1"/>
      </svg>
    )
  },
  mistral: {
    color: '#ff7000',
    bg: 'rgba(255, 112, 0, 0.06)',
    border: 'rgba(255, 112, 0, 0.35)',
    logo: (
      <svg viewBox="0 0 129 91" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-label="Mistral logo">
        <rect x="18.292" y="0" width="18.293" height="18.123" fill="#ffd800"/>
        <rect x="91.473" y="0" width="18.293" height="18.123" fill="#ffd800"/>
        <rect x="18.292" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
        <rect x="73.181" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
        <rect x="18.292" y="36.243" width="91.476" height="18.122" fill="#ff8205"/>
        <rect x="18.292" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
        <rect x="54.883" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
        <rect x="91.473" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
        <rect x="0" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
        <rect x="73.181" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
      </svg>
    )
  },
  gemini: {
    color: '#4285f4',
    bg: 'rgba(66, 133, 244, 0.06)',
    border: 'rgba(66, 133, 244, 0.35)',
    logo: (
      <svg viewBox="0 0 65 65" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-label="Google Gemini logo">
        <defs>
          <linearGradient id="gemini-grad" x1="18.45" y1="43.42" x2="52.15" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4285f4"/>
            <stop offset="0.5" stopColor="#9b72cb"/>
            <stop offset="1" stopColor="#d96570"/>
          </linearGradient>
        </defs>
        <path d="M57.865 29.011C52.865 26.859 48.49 23.906 44.74 20.157C40.99 16.407 38.037 12.031 35.885 7.031C35.059 5.115 34.395 3.146 33.886 1.126C33.72.466 33.128.001 32.448.001C31.767.001 31.175.466 31.009 1.126C30.5 3.146 29.836 5.113 29.01 7.031C26.858 12.031 23.905 16.407 20.156 20.157C16.406 23.906 12.03 26.859 7.03 29.011C5.114 29.837 3.144 30.501 1.125 31.01C.465 31.176 0 31.768 0 32.449C0 33.129.465 33.721 1.125 33.887C3.144 34.396 5.112 35.06 7.03 35.886C12.03 38.038 16.405 40.991 20.156 44.74C23.907 48.49 26.858 52.866 29.01 57.866C29.836 59.782 30.5 61.752 31.009 63.771C31.175 64.431 31.767 64.896 32.448 64.896C33.128 64.896 33.72 64.431 33.886 63.771C34.395 61.752 35.059 59.784 35.885 57.866C38.037 52.866 40.99 48.492 44.74 44.74C48.489 40.991 52.865 38.038 57.865 35.886C59.781 35.06 61.751 34.396 63.77 33.887C64.43 33.721 64.895 33.129 64.895 32.449C64.895 31.768 64.43 31.176 63.77 31.01C61.751 30.501 59.783 29.837 57.865 29.011Z" fill="url(#gemini-grad)"/>
      </svg>
    )
  }
};

const getProviderBrand = (key) => PROVIDER_BRANDS[key] || { color: '#666', bg: 'transparent', border: '#ddd', logo: null };

export default function AIAdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { success: showSuccess, error: showError } = useToast();

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getProviders();
      setProviders(result?.data?.providers || []);
    } catch (err) {
      logger.error('[AIAdminProviders] Failed to load providers', { error: err.message });
      setError('Failed to load provider configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleToggleEnabled = useCallback(async (provider) => {
    try {
      await updateProvider(provider._id, { enabled: !provider.enabled });
      setProviders(prev => prev.map(p =>
        p._id === provider._id ? { ...p, enabled: !p.enabled } : p
      ));
      showSuccess(`${provider.display_name} ${!provider.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showError('Failed to update provider');
    }
  }, [showSuccess, showError]);

  const handleEdit = useCallback((provider) => {
    setEditingId(provider._id);
    setEditForm({
      default_model: provider.default_model,
      valid_models: (provider.valid_models || []).join(', '),
      endpoint: provider.endpoint,
      priority: provider.priority || 0
    });
  }, []);

  const handleSaveEdit = useCallback(async (providerId) => {
    try {
      setSaving(true);
      const data = {
        default_model: editForm.default_model,
        valid_models: editForm.valid_models.split(',').map(m => m.trim()).filter(Boolean),
        endpoint: editForm.endpoint,
        priority: parseInt(editForm.priority, 10) || 0
      };
      const result = await updateProvider(providerId, data);
      setProviders(prev => prev.map(p =>
        p._id === providerId ? { ...p, ...(result?.data?.provider || {}) } : p
      ));
      setEditingId(null);
      showSuccess('Provider updated');
    } catch (err) {
      showError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [editForm, showSuccess, showError]);

  if (loading) {
    return (
      <Stack gap="var(--space-4)">
        {[1, 2, 3, 4].map(i => (
          <SkeletonLoader key={i} height="120px" />
        ))}
      </Stack>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <Stack gap="var(--space-4)">
      <Heading as="h2" fontSize="var(--font-size-lg)" fontWeight="var(--font-weight-semibold)">
        Provider Configurations
      </Heading>
      <Text color="var(--color-text-secondary)" fontSize="var(--font-size-sm)">
        Manage AI providers, enable/disable access, and configure allowed models.
        API keys are stored in environment variables for security.
      </Text>

      {providers.map(provider => {
        const brand = getProviderBrand(provider.provider);
        return (
        <Card
          key={provider._id || provider.provider}
          opacity={provider.configured ? 1 : 0.5}
          borderLeft="4px solid"
          borderLeftColor={brand.color}
          bg={provider.configured ? brand.bg : 'transparent'}
          overflow="hidden"
        >
          <CardHeader py="var(--space-2)" px="var(--space-3)">
            <Flex justify="space-between" align="center" width="100%">
              <Flex align="center" gap="var(--space-3)">
                <Box color={brand.color} flexShrink={0}>{brand.logo}</Box>
                <Heading as="h3" fontSize="var(--font-size-md)" fontWeight="var(--font-weight-semibold)">
                  {provider.display_name}
                </Heading>
                {!provider.configured ? (
                  <Badge
                    colorPalette="gray"
                    variant="subtle"
                    fontSize="var(--font-size-xs)"
                  >
                    Not Configured
                  </Badge>
                ) : (
                  <Badge
                    colorPalette={provider.enabled ? 'green' : 'red'}
                    variant="subtle"
                    fontSize="var(--font-size-xs)"
                  >
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                )}
              </Flex>
              <Flex align="center" gap="var(--space-3)">
                {provider.configured && provider._id && (
                  <>
                    <Switch.Root
                      checked={provider.enabled}
                      onCheckedChange={() => handleToggleEnabled(provider)}
                    >
                      <Switch.HiddenInput />
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Root>
                    {editingId !== provider._id && (
                      <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                        <FaEdit /> Edit
                      </Button>
                    )}
                  </>
                )}
              </Flex>
            </Flex>
          </CardHeader>

          <CardBody py="var(--space-2)" px="var(--space-3)">
            {!provider.configured ? (
              <Text fontSize="var(--font-size-sm)" color="var(--color-text-secondary)">
                Set the <Text as="span" fontFamily="mono" fontWeight="var(--font-weight-medium)">{provider.env_key_name}</Text> environment variable to enable this provider.
              </Text>
            ) : editingId === provider._id ? (
              <Stack gap="var(--space-3)">
                <Box>
                  <Text fontSize="var(--font-size-sm)" fontWeight="var(--font-weight-medium)" mb="var(--space-1)">
                    Endpoint
                  </Text>
                  <Input
                    value={editForm.endpoint}
                    onChange={(e) => setEditForm(prev => ({ ...prev, endpoint: e.target.value }))}
                    size="sm"
                  />
                </Box>
                <Box>
                  <Text fontSize="var(--font-size-sm)" fontWeight="var(--font-weight-medium)" mb="var(--space-1)">
                    Default Model
                  </Text>
                  <Input
                    value={editForm.default_model}
                    onChange={(e) => setEditForm(prev => ({ ...prev, default_model: e.target.value }))}
                    size="sm"
                  />
                </Box>
                <Box>
                  <Text fontSize="var(--font-size-sm)" fontWeight="var(--font-weight-medium)" mb="var(--space-1)">
                    Valid Models (comma-separated)
                  </Text>
                  <Textarea
                    value={editForm.valid_models}
                    onChange={(e) => setEditForm(prev => ({ ...prev, valid_models: e.target.value }))}
                    size="sm"
                    rows={3}
                  />
                </Box>
                <Box>
                  <Text fontSize="var(--font-size-sm)" fontWeight="var(--font-weight-medium)" mb="var(--space-1)">
                    Priority (lower = higher priority)
                  </Text>
                  <Input
                    type="number"
                    value={editForm.priority}
                    onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                    size="sm"
                    min={0}
                  />
                </Box>
                <Flex gap="var(--space-2)" pt="var(--space-2)">
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => handleSaveEdit(provider._id)}
                    disabled={saving}
                  >
                    <FaSave /> {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </Flex>
              </Stack>
            ) : (
              <Stack gap="var(--space-2)">
                <Flex gap="var(--space-6)" wrap="wrap">
                  <Box>
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Provider Key</Text>
                    <Text fontSize="var(--font-size-sm)" fontFamily="mono">{provider.provider}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Default Model</Text>
                    <Text fontSize="var(--font-size-sm)" fontFamily="mono">{provider.default_model}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">API Key Env Var</Text>
                    <Text fontSize="var(--font-size-sm)" fontFamily="mono">{provider.env_key_name}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)">Priority</Text>
                    <Text fontSize="var(--font-size-sm)">{provider.priority}</Text>
                  </Box>
                </Flex>
                <Box>
                  <Text fontSize="var(--font-size-xs)" color="var(--color-text-secondary)" mb="var(--space-1)">
                    Valid Models ({(provider.valid_models || []).length})
                  </Text>
                  <Flex gap="var(--space-1)" wrap="wrap">
                    {(provider.valid_models || []).map(model => (
                      <Badge key={model} variant="outline" fontSize="var(--font-size-xs)">
                        {model}
                      </Badge>
                    ))}
                  </Flex>
                </Box>
              </Stack>
            )}
          </CardBody>
        </Card>
        );
      })}
    </Stack>
  );
}
