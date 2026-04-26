/**
 * AI Admin Page
 *
 * Admin interface for managing AI provider configs, policies, usage analytics,
 * and task routing. Requires super_admin role + ai_admin feature flag.
 *
 * @module views/AIAdmin
 */

import { useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { FaRobot, FaShieldAlt, FaChartBar, FaRoute, FaBrain, FaCog } from 'react-icons/fa';
import { useUser } from '../../contexts/UserContext';
import { isSuperAdmin } from '../../utilities/permissions';
import { hasFeatureFlag } from '../../utilities/feature-flags';
import { Container, Alert, Tabs, Text } from '../../components/design-system';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import PageWrapper from '../../components/PageWrapper/PageWrapper';
import AIAdminProviders from './AIAdminProviders';
import AIAdminPolicies from './AIAdminPolicies';
import AIAdminUsage from './AIAdminUsage';
import AIAdminRouting from './AIAdminRouting';
import AIAdminClassifier from './AIAdminClassifier';

const TABS = [
  { value: 'providers', label: 'Providers', icon: <FaRobot /> },
  { value: 'policies', label: 'Policies', icon: <FaShieldAlt /> },
  { value: 'usage', label: 'Usage', icon: <FaChartBar /> },
  { value: 'routing', label: 'Routing', icon: <FaRoute /> },
  { value: 'classifier', label: 'Classifier', icon: <FaBrain /> }
];

export default function AIAdmin() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('providers');

  const isAuthorized = user && isSuperAdmin(user) && hasFeatureFlag(user, 'ai_admin');

  if (!isAuthorized) {
    return (
      <Container>
        <PageOpenGraph title="AI Admin" description="AI gateway administration" />
        <Box mt="12">
          <Alert variant="warning">
            You do not have permission to access this page. This page requires super admin access and the ai_admin feature flag.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <>
      <PageOpenGraph title="AI Admin" description="AI gateway administration" />
      <PageWrapper title="AI">
        <Container>
          <Box pt="var(--space-6)" pb="var(--space-3)">
            <h1 style={{ marginBottom: 'var(--space-2)' }}>
              <FaCog
                style={{
                  marginRight: '0.5rem',
                  color: 'var(--color-primary)',
                  verticalAlign: 'middle'
                }}
              />
              AI
            </h1>
            <Text
              color="var(--color-text-muted)"
              fontSize="clamp(0.8125rem, 1.5vw, 0.9375rem)"
              mb="0"
            >
              Configure AI providers, policies, routing rules, and the intent classifier. Review usage analytics across the platform.
            </Text>
          </Box>

          <Tabs
            activeKey={activeTab}
            onSelect={setActiveTab}
            variant="line"
            size="md"
          >
            <Tabs.List>
              {TABS.map(tab => (
                <Tabs.Trigger key={tab.value} value={tab.value}>
                  <Flex align="center" gap="var(--space-2)">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </Flex>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Box pt="var(--space-6)">
              <Tabs.Content value="providers">
                <AIAdminProviders />
              </Tabs.Content>
              <Tabs.Content value="policies">
                <AIAdminPolicies />
              </Tabs.Content>
              <Tabs.Content value="usage">
                <AIAdminUsage />
              </Tabs.Content>
              <Tabs.Content value="routing">
                <AIAdminRouting />
              </Tabs.Content>
              <Tabs.Content value="classifier">
                <AIAdminClassifier />
              </Tabs.Content>
            </Box>
          </Tabs>
        </Container>
      </PageWrapper>
    </>
  );
}
