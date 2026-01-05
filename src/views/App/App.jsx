import React, { useCallback, useEffect, lazy, Suspense } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { ToastProvider, useToast } from "../../contexts/ToastContext";
import { UserProvider, useUser } from "../../contexts/UserContext";
import { DataProvider } from "../../contexts/DataContext";
import { AppProvider, useApp } from "../../contexts/AppContext";
import { TooltipProvider } from "../../contexts/TooltipContext";
import { PlanExperienceProvider } from "../../contexts/PlanExperienceContext";
import { NavigationIntentProvider } from "../../contexts/NavigationIntentContext";
import { ExperienceWizardProvider } from "../../contexts/ExperienceWizardContext";
import { DestinationWizardProvider } from "../../contexts/DestinationWizardContext";
import { lang } from "../../lang.constants";
import NavBar from "../../components/NavBar/NavBar";
import Loading from "../../components/Loading/Loading";
import ScrollToTop from "../../components/ScrollToTop/ScrollToTop";
import { handleOAuthCallback } from "../../utilities/oauth-service";
import { logger } from "../../utilities/logger";
import { getHydratedTheme } from '../../utilities/theme-manager';
import { getCollaboratorNotifications } from '../../utilities/notifications-api';
import { useNavigate } from 'react-router-dom';
import CookieConsent from "../../components/CookieConsent/CookieConsent";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import MultiStepPlanModal from "../../components/MultiStepPlanModal/MultiStepPlanModal";
import LegalModalsHandler from "../../components/LegalModalsHandler/LegalModalsHandler";
import { Helmet } from 'react-helmet-async';
import { Container } from "../../components/design-system";
import styles from './App.module.scss';
import { waitForCSS } from '../../utilities/css-loading';
import { initializeCSSEnvironment } from '../../utilities/css-environment-consistency';

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
const Countries = lazy(() => import("../Countries/Countries"));

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
              <TooltipProvider>
                <PlanExperienceProvider>
                  <NavigationIntentProvider>
                    <ExperienceWizardProvider>
                      <DestinationWizardProvider>
                        <AppContent />
                      </DestinationWizardProvider>
                    </ExperienceWizardProvider>
                  </NavigationIntentProvider>
                </PlanExperienceProvider>
              </TooltipProvider>
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
  const { user, updateUser, isAuthenticated } = useUser();
  logger.debug('useUser completed', { isAuthenticated });

  logger.debug('About to call useApp');
  useApp(); // Initializes app context (scroll tracking, etc.)
  logger.debug('useApp completed');

  logger.debug('About to call useToast');
  const { success, error: showError, addToast } = useToast();
  logger.debug('useToast completed');

  const navigate = useNavigate();
  const location = useLocation();

  const PENDING_HASH_STORAGE_KEY = 'bien:pendingHash';

  const applyHashToUrl = useCallback((hash, { mode } = {}) => {
    const normalized = (hash || '').startsWith('#') ? hash : `#${hash || ''}`;
    if (!normalized || normalized === '#') return;

    const nextUrl = `${window.location.pathname}${window.location.search || ''}${normalized}`;

    if (mode === 'replace') {
      window.history.replaceState(window.history.state, '', nextUrl);
    } else {
      // Default to push so the hash is represented in browser history.
      window.history.pushState(window.history.state, '', nextUrl);
    }

    // React Router listens to popstate for location updates; pushState/replaceState
    // don't emit it. Dispatching keeps router location in sync with the address bar.
    try {
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      // ignore
    }
  }, []);

  const parsePendingHash = (rawValue) => {
    if (!rawValue) return null;

    // Back-compat: older values were stored as a raw string hash
    if (rawValue.startsWith('#')) {
      return { hash: rawValue, originPath: null, targetPath: null };
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object') {
        return {
          hash: parsed.hash || null,
          originPath: parsed.originPath || null,
          targetPath: parsed.targetPath || null
        };
      }
    } catch (e) {
      // ignore
    }

    return { hash: rawValue, originPath: null, targetPath: null };
  };

  // Store intended route for post-login redirect when user is not authenticated
  // This enables deep linking - users can access protected routes after login
  useEffect(() => {
    if (!isAuthenticated) {
      const currentPath = location.pathname + location.search + location.hash;
      // Don't store auth-related paths or the home page as intended routes
      const excludedPaths = ['/', '/signup', '/reset-password', '/confirm-email'];
      const shouldStore = !excludedPaths.some(path =>
        currentPath === path || currentPath.startsWith('/reset-password/') || currentPath.startsWith('/confirm-email/')
      );

      if (shouldStore && currentPath !== '/') {
        sessionStorage.setItem('bien:intendedRoute', currentPath);
        logger.info('[Login Redirect] Stored intended route:', currentPath);
      }
    }
  }, [isAuthenticated, location]);

  // Preserve hash fragments - React Router strips them during navigation
  // This effect captures and restores hashes for deep linking
  useEffect(() => {
    // Store hash on initial load (handles direct URL paste)
    const initialHash = window.location.hash;
    if (initialHash) {
      logger.info('[Hash Preservation] Initial hash detected:', initialHash);
      // Store in localStorage to survive React Router navigation that may strip hashes
      // Save origin pathname so we only restore on the same view when possible
      try {
        const payload = JSON.stringify({ hash: initialHash, originPath: window.location.pathname });
        localStorage.setItem(PENDING_HASH_STORAGE_KEY, payload);
      } catch (e) {
        localStorage.setItem(PENDING_HASH_STORAGE_KEY, initialHash);
      }
    }

    // Global click handler to capture hashes from Link navigation
    const handleClick = (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && href.includes('#')) {
        const hashIndex = href.indexOf('#');
        const hash = href.substring(hashIndex);
        const targetPath = href.substring(0, hashIndex) || null;
        logger.info('[Hash Preservation] Captured hash from link:', hash);
        try {
          const payload = JSON.stringify({ hash, originPath: window.location.pathname, targetPath });
          localStorage.setItem(PENDING_HASH_STORAGE_KEY, payload);
        } catch (e) {
          localStorage.setItem(PENDING_HASH_STORAGE_KEY, hash);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // Restore pending hashes after route changes.
  // React Router navigation often drops the hash from the address bar; deep-link consumers
  // (like SingleExperience) may still act on the intent, but we want the URL to reflect it.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(PENDING_HASH_STORAGE_KEY);
    const stored = parsePendingHash(raw);
    const storedHash = stored?.hash || '';
    if (!storedHash) {
      if (raw) localStorage.removeItem(PENDING_HASH_STORAGE_KEY);
      return;
    }

    // If something already set a hash (e.g., destination view), don't override it.
    if (window.location.hash && window.location.hash !== storedHash) {
      localStorage.removeItem(PENDING_HASH_STORAGE_KEY);
      return;
    }

    // Avoid restoring on the auth page shell
    if (!isAuthenticated) return;

    const currentPath = `${location.pathname}${location.search || ''}`;
    const normalizedStoredHash = storedHash.startsWith('#') ? storedHash : `#${storedHash}`;

    const targetPathMatches = !!(stored?.targetPath && (stored.targetPath === currentPath || stored.targetPath === location.pathname));
    const originPathMatches = !!(stored?.originPath && stored.originPath === window.location.pathname);
    const isPlanHash = normalizedStoredHash.startsWith('#plan-');
    const isExperienceRoute = /\/experiences\//.test(location.pathname || '');

    logger.info('[Hash Preservation] Checking pending hash for restore:', {
      normalizedStoredHash,
      currentPath,
      targetPath: stored?.targetPath || null,
      originPath: stored?.originPath || null,
      targetPathMatches,
      originPathMatches,
      isPlanHash,
      isExperienceRoute
    });

    // Restore rules:
    // - If we know the intended targetPath and it matches, restore.
    // - Legacy behavior: if originPath matches, restore.
    // - Plan deep links: restore on any experience route.
    const shouldRestore = targetPathMatches || originPathMatches || (isPlanHash && isExperienceRoute);
    if (!shouldRestore) return;

    // Restore after a brief delay to ensure the destination view has mounted.
    const t = setTimeout(() => {
      try {
        if (!window.location.hash) {
          // If this was a direct-load paste (no known target), avoid polluting history.
          // Otherwise, push so back/forward reflects hash changes.
          const restoreMode = originPathMatches && !stored?.targetPath ? 'replace' : 'push';
          applyHashToUrl(normalizedStoredHash, { mode: restoreMode });
          logger.info('[Hash Preservation] Restored pending hash after navigation');
        }
      } finally {
        localStorage.removeItem(PENDING_HASH_STORAGE_KEY);
      }
    }, 50);

    return () => clearTimeout(t);
  }, [location.pathname, location.search, isAuthenticated, applyHashToUrl]);

  // Effect: wait for CSS to load and initialize environment consistency
  // This addresses production vs development timing differences
  useEffect(() => {
    const initializeCSS = async () => {
      try {
        logger.debug('Waiting for CSS to load...');
        await waitForCSS();
        logger.debug('CSS loading complete, initializing environment consistency...');
        initializeCSSEnvironment();
        logger.debug('CSS environment consistency initialized');
      } catch (error) {
        logger.warn('CSS initialization failed, continuing anyway', { error: error.message });
      }
    };

    initializeCSS();
  }, []);

  // Effect: fetch collaborator notifications on login/hard refresh
  useEffect(() => {
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        if (!isAuthenticated || !user?._id) return;
        const userId = user._id;

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
  }, [isAuthenticated, user?._id, addToast, navigate]);

  // Effect: watch for OS theme changes and set bootstrap theme attribute
  // Only attach a global OS listener when the user's preference is `system-default` or not set.
  useEffect(() => {
    const pref = getHydratedTheme();

    const setBootstrapTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', theme);
      logger.debug('Bootstrap theme updated to:', theme);
    };

    // If user has explicitly selected light/dark, respect it and don't attach OS listener here.
    if (pref && pref !== 'system-default') {
      try {
        document.documentElement.setAttribute('data-bs-theme', pref);
      } catch (e) {}
      return undefined;
    }

    // Otherwise, follow OS and attach listener
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
          const message = lang.current.notification?.auth?.oauthSuccess?.replace('{provider}', provider) || `Welcome back! You're signed in with ${provider}.`;
          success(message);

          // Redirect to intended route after OAuth login (deep linking support)
          const intendedRoute = sessionStorage.getItem('bien:intendedRoute');
          if (intendedRoute) {
            sessionStorage.removeItem('bien:intendedRoute');
            logger.info('[Login Redirect] Redirecting to intended route after OAuth:', intendedRoute);
            navigate(intendedRoute);
          }
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
        {/* Skip link for keyboard navigation - WCAG 2.1 SC 2.4.1 Bypass Blocks */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className={styles.app}>
          <CookieConsent />
          {/* Legal modals accessible via hash links (#terms, #privacy) */}
          <LegalModalsHandler />
          {/* Multi-step Plan Experience Modal - globally accessible */}
          {isAuthenticated && <MultiStepPlanModal />}
          {isAuthenticated ? (
            <>
              <NavBar />
              <Container as="main" id="main-content" role="main" aria-label={lang.current.aria.mainContent}>
                <ErrorBoundary
                  title={lang.current.modal.pageError}
                  message={lang.current.modal.errorLoadingPage}
                  showHomeButton={true}
                >
                  <ScrollToTop />
                  <Suspense fallback={<Loading variant="centered" size="lg" message={lang.current.loading.page} />}>
                    <Routes>
                      <Route path="/" element={<AppHome />} />
                      <Route path="/experiences/new" element={
                        <ErrorBoundary title={lang.current.modal.formError} message={lang.current.modal.errorLoadingForm}>
                          <NewExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/new" element={
                        <ErrorBoundary title={lang.current.modal.formError} message={lang.current.modal.errorLoadingForm}>
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
                      <Route path="/countries/:countryName" element={<Countries />} />
                      <Route path="/experience-types/:tagName" element={<ExperiencesByTag />} />
                      <Route path="/experiences/:experienceId" element={
                        <ErrorBoundary title={lang.current.modal.experienceError} message={lang.current.modal.errorLoadingExperience}>
                          <SingleExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
                      <Route path="/experiences/:experienceId/update" element={
                        <ErrorBoundary title={lang.current.modal.formError} message={lang.current.modal.errorLoadingForm}>
                          <UpdateExperience />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/:destinationId" element={
                        <ErrorBoundary title={lang.current.modal.destinationError} message={lang.current.modal.errorLoadingDestination}>
                          <SingleDestination />
                        </ErrorBoundary>
                      } />
                      <Route path="/destinations/:destinationId/update" element={
                        <ErrorBoundary title={lang.current.modal.formError} message={lang.current.modal.errorLoadingForm}>
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
            <Container as="main" id="main-content" role="main" aria-label={lang.current.aria.authentication}>
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
