import React, { useEffect, lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { ToastProvider, useToast } from "../../contexts/ToastContext";
import { UserProvider, useUser } from "../../contexts/UserContext";
import { DataProvider } from "../../contexts/DataContext";
import { AppProvider, useApp } from "../../contexts/AppContext";
import { lang } from "../../lang.constants";
import NavBar from "../../components/NavBar/NavBar";
import Loading from "../../components/Loading/Loading";
import ScrollToTop from "../../components/ScrollToTop/ScrollToTop";
import { handleOAuthCallback } from "../../utilities/oauth-service";
import { logger } from "../../utilities/logger";
import { getCollaboratorNotifications } from '../../utilities/notifications-api';
import { useNavigate } from 'react-router-dom';
import CookieConsent from "../../components/CookieConsent/CookieConsent";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import { Helmet } from 'react-helmet-async';
import { Container } from "../../components/design-system";

// Lazy load components for better performance
const AuthPage = lazy(() => import("../AuthPage/AuthPage"));
const AppHome = lazy(() => import("../AppHome/AppHome"));
const UpdateProfile = lazy(() => import("../Profile/UpdateProfile"));
const SingleExperience = lazy(() => import("../SingleExperience/SingleExperience"));
const SingleDestination = lazy(() => import("../SingleDestination/SingleDestination"));
const Destinations = lazy(() => import("../Destinations/Destinations"));
const Experiences = lazy(() => import("../Experiences/Experiences"));
const ExperiencesByTag = lazy(() => import("../ExperiencesByTag/ExperiencesByTag"));
const NewExperience = lazy(() => import("../../components/NewExperience/NewExperience"));
const UpdateExperience = lazy(() => import("../../components/UpdateExperience/UpdateExperience"));
const NewDestination = lazy(() => import("../../components/NewDestination/NewDestination"));
const UpdateDestination = lazy(() => import("../../components/UpdateDestination/UpdateDestination"));
const Profile = lazy(() => import("../Profile/Profile"));
const AllUsers = lazy(() => import("../AllUsers/AllUsers"));
const InviteTracking = lazy(() => import("../InviteTracking/InviteTracking"));
const ResetPassword = lazy(() => import("../ResetPassword/ResetPassword"));
const ConfirmEmail = lazy(() => import("../ConfirmEmail/ConfirmEmail"));
const Dashboard = lazy(() => import("../Dashboard/Dashboard"));

logger.info('App.jsx loaded');

/**
 * Main application component wrapper
 * Provides all context providers in the correct order
 */
export default function App() {
  logger.debug('App component function called');
  return (
    <HelmetProvider>
      <Helmet>
        {/* Basic meta tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#9333ea" />

        {/* Open Graph defaults */}
        <meta property="og:site_name" content="Biensperience" />
        <meta property="og:type" content="website" />

        {/* Twitter Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@biensperience" />

        {/* Schema.org defaults */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': 'Biensperience',
            'alternateName': 'Biensperience Travel Planning Platform',
            'description': 'Visual travel experience platform for planning and sharing adventures. Discover curated destinations, create your travel bucket list, and organize your adventures with fellow travelers.',
            'url': window.location.origin,
            'publisher': {
              '@type': 'Organization',
              'name': 'Biensperience',
              'description': 'A platform connecting travelers and adventurers worldwide',
              'url': window.location.origin,
              'logo': `${window.location.origin}/logo.png`,
              'sameAs': [
                'https://twitter.com/biensperience'
              ]
            },
            'potentialAction': {
              '@type': 'SearchAction',
              'target': `${window.location.origin}/experiences?search={search_term_string}`,
              'query-input': 'required name=search_term_string'
            },
            'about': {
              '@type': 'Thing',
              'name': 'Travel Planning',
              'description': 'Planning and organizing travel experiences and adventures'
            },
            'audience': {
              '@type': 'Audience',
              'audienceType': 'Travelers and adventurers'
            }
          })}
        </script>
      </Helmet>

      <ToastProvider>
        <UserProvider>
          <AppProvider>
            <DataProvider>
              <AppContent />
            </DataProvider>
          </AppProvider>
        </UserProvider>
      </ToastProvider>
    </HelmetProvider>
  );
}

/**
 * App content component that uses contexts
 * Separated from App to allow hooks usage
 */
function AppContent() {
  logger.debug('AppContent component function called');

  logger.debug('About to call useUser');
  const { updateUser, isAuthenticated } = useUser();
  logger.debug('useUser completed', { isAuthenticated });

  logger.debug('About to call useApp');
  const { isScrolled } = useApp();
  logger.debug('useApp completed');

  logger.debug('About to call useToast');
  const { success, error: showError, addToast } = useToast();
  logger.debug('useToast completed');

  const navigate = useNavigate();

  // Preserve hash fragments - React Router strips them during navigation
  // This effect captures and restores hashes for deep linking
  useEffect(() => {
    // Store hash on initial load (handles direct URL paste)
    const initialHash = window.location.hash;
    if (initialHash) {
      logger.info('[Hash Preservation] Initial hash detected:', initialHash);
      // Store in sessionStorage to survive React Router processing
      sessionStorage.setItem('pendingHash', initialHash);
    }

    // Restore hash after a brief delay to ensure component has mounted
    const storedHash = sessionStorage.getItem('pendingHash');
    if (storedHash && window.location.hash !== storedHash) {
      logger.info('[Hash Preservation] Restoring hash:', storedHash);
      setTimeout(() => {
        window.location.hash = storedHash;
        sessionStorage.removeItem('pendingHash');
      }, 50);
    }

    // Global click handler to capture hashes from Link navigation
    const handleClick = (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && href.includes('#')) {
        const hashIndex = href.indexOf('#');
        const hash = href.substring(hashIndex);
        logger.info('[Hash Preservation] Captured hash from link:', hash);
        sessionStorage.setItem('pendingHash', hash);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // Effect: fetch collaborator notifications on login/hard refresh
  useEffect(() => {
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        if (!isAuthenticated) return;
        const user = JSON.parse(localStorage.getItem('bien_user')) || null;
        const userId = user?._id;
        if (!userId) return;

        const raw = await getCollaboratorNotifications(userId, { limit: 10 });
        const activities = Array.isArray(raw) ? raw : (raw?.data || []);

        const seenKey = `seen_activities_${userId}`;
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch (e) { seen = []; }

        const newIds = [];

        activities.forEach(act => {
          if (!mounted) return;
          if (!act || !act._id) return;
          if (seen.includes(act._id)) return;

          const message = act.reason || `${act.actor?.name || 'Someone'} added you as a collaborator to ${act.resource?.name || 'an experience'}`;
          addToast({
            message,
            header: 'New collaborator',
            type: 'primary',
            duration: 10000,
            actions: [
              {
                label: 'View',
                onClick: () => {
                  if (act.resource && (act.resource.id || act.resource._id)) {
                    const id = act.resource.id || act.resource._id;
                    navigate(`/experiences/${id}`);
                  }
                  const cur = JSON.parse(localStorage.getItem(seenKey) || '[]');
                  cur.push(act._id);
                  localStorage.setItem(seenKey, JSON.stringify(cur));
                },
                variant: 'primary'
              }
            ]
          });

          newIds.push(act._id);
        });

        if (mounted && newIds.length > 0) {
          const cur = JSON.parse(localStorage.getItem(seenKey) || '[]');
          const merged = Array.from(new Set([...cur, ...newIds]));
          localStorage.setItem(seenKey, JSON.stringify(merged));
        }
      } catch (err) {
        logger.error('Failed to fetch collaborator notifications', { error: err?.message || err });
      }
    };

    fetchNotifications();

    return () => { mounted = false; };
  }, [isAuthenticated, addToast, navigate]);

  // Effect: watch for OS theme changes and set bootstrap theme attribute
  useEffect(() => {
    const setBootstrapTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', theme);
      logger.debug('Bootstrap theme updated to:', theme);
    };

    setBootstrapTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setBootstrapTheme();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Effect: handle OAuth callback once on mount
  useEffect(() => {
    const processOAuth = async () => {
      try {
        const result = await handleOAuthCallback();
        if (result) {
          const { user: oauthUser, provider } = result;
          updateUser(oauthUser);
          success(`Successfully signed in with ${provider}!`);
        }
      } catch (err) {
        showError(err.message || 'Authentication failed');
      }
    };

    processOAuth();
    // Intentionally leave deps empty to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    return (
      <>
        {isAuthenticated && !isScrolled && (
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
        )}
        <div className="App">
          <CookieConsent />
          {isAuthenticated ? (
            <>
              <NavBar />
              <Container as="main" id="main-content" role="main" aria-label={lang.en.aria.mainContent}>
                <ErrorBoundary
                  title="Page Error"
                  message="We encountered an error loading this page. Please try again or return home."
                  showHomeButton={true}
                >
                  <ScrollToTop />
                  <Suspense fallback={<Loading variant="centered" size="lg" message="Loading page..." />}>
                    <Routes>
                      <Route path="/" element={<AppHome />} />
                      <Route path="/experiences/new" element={
                        <ErrorBoundary title="Form Error" message="Error loading the new experience form.">
                          <NewExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/new" element={
                        <ErrorBoundary title="Form Error" message="Error loading the new destination form.">
                          <NewDestination />
                        </ErrorBoundary>
                      } />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:profileId" element={<Profile />} />
                      <Route path="/profile/update" element={<UpdateProfile />} />
                      <Route path="/profile/:userId/update" element={<UpdateProfile />} />
                      <Route path="/invites" element={<InviteTracking />} />
                      <Route path="/admin/users" element={<AllUsers />} />
                      <Route path="/experiences" element={<Experiences />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/destinations" element={<Destinations />} />
                      <Route path="/experience-types/:tagName" element={<ExperiencesByTag />} />
                      <Route path="/experiences/:experienceId" element={
                        <ErrorBoundary title="Experience Error" message="Error loading experience details.">
                          <SingleExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
                      <Route path="/experiences/:experienceId/update" element={
                        <ErrorBoundary title="Form Error" message="Error loading the update experience form.">
                          <UpdateExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/:destinationId" element={
                        <ErrorBoundary title="Destination Error" message="Error loading destination details.">
                          <SingleDestination />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/:destinationId/update" element={
                        <ErrorBoundary title="Form Error" message="Error loading the update destination form.">
                          <UpdateDestination />
                        </ErrorBoundary>
                      } />
                      <Route path="/logout" element={<Navigate to="/" />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Container>
            </>
          ) : (
            <Container as="main" id="main-content" role="main" aria-label={lang.en.aria.authentication}>
              <Suspense fallback={<Loading variant="centered" size="lg" /> }>
                <Routes>
                  <Route path="/signup" element={<AuthPage />} />
                  <Route path="/reset-password/:token" element={<ResetPassword />} />
                  <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
                  <Route path="*" element={<AuthPage />} />
                </Routes>
              </Suspense>
            </Container>
          )}
        </div>
      </>
    );
}
