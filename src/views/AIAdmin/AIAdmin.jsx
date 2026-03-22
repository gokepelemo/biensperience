/**
 * AI Admin Page
 *
 * Admin interface for managing AI provider configs, policies, usage analytics,
 * and task routing. Requires super_admin role + ai_admin feature flag.
 *
 * @module views/AIAdmin
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Tabs, Flex, Text as ChakraText } from '@chakra-ui/react';
import { FaRobot, FaShieldAlt, FaChartBar, FaRoute, FaBrain } from 'react-icons/fa';
import { useUser } from '../../contexts/UserContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { isSuperAdmin } from '../../utilities/permissions';
import { hasFeatureFlag } from '../../utilities/feature-flags';
import { Container, Alert } from '../../components/design-system';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import AIAdminProviders from './AIAdminProviders';
import AIAdminPolicies from './AIAdminPolicies';
import AIAdminUsage from './AIAdminUsage';
import AIAdminRouting from './AIAdminRouting';
import AIAdminClassifier from './AIAdminClassifier';
import { logger } from '../../utilities/logger';

export default function AIAdmin() {
  const { user } = useUser();
  const { registerH1, updatePageTitle, clearActionButtons } = useApp();
  const [activeTab, setActiveTab] = useState('providers');

  const isAuthorized = user && isSuperAdmin(user) && hasFeatureFlag(user, 'ai_admin');

  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);
    updatePageTitle('AI Administration');
    return () => clearActionButtons();
  }, [registerH1, updatePageTitle, clearActionButtons]);

  if (!isAuthorized) {
    return (
      <Container>
        <PageOpenGraph title="AI Admin" description="AI gateway administration" />
        <Alert variant="warning">
          You do not have permission to access this page. This page requires super admin access and the ai_admin feature flag.
        </Alert>
      </Container>
    );
  }

  const tabs = [
    { value: 'providers', label: 'Providers', icon: <FaRobot /> },
    { value: 'policies', label: 'Policies', icon: <FaShieldAlt /> },
    { value: 'usage', label: 'Usage', icon: <FaChartBar /> },
    { value: 'routing', label: 'Routing', icon: <FaRoute /> },
    { value: 'classifier', label: 'Classifier', icon: <FaBrain /> }
  ];

  return (
    <Container>
      <PageOpenGraph title="AI Admin" description="AI gateway administration" />

      <Box py="var(--space-6)">
        <h1 className="visually-hidden">AI Administration</h1>
        <Tabs.Root
          value={activeTab}
          onValueChange={(e) => setActiveTab(e.value)}
          variant="line"
          size="md"
        >
          <Tabs.List>
            {tabs.map(tab => (
              <Tabs.Trigger key={tab.value} value={tab.value}>
                <Flex align="center" gap="var(--space-2)">
                  {tab.icon}
                  <ChakraText>{tab.label}</ChakraText>
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
        </Tabs.Root>
      </Box>
    </Container>
  );
}
