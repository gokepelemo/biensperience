import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/shared/text-legibility.css";
import "./App.css";
import "@fontsource/inter";
import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { ToastProvider, useToast } from "../../contexts/ToastContext";
import { UserProvider, useUser } from "../../contexts/UserContext";
import { DataProvider } from "../../contexts/DataContext";
import { AppProvider, useApp } from "../../contexts/AppContext";
import { lang } from "../../lang.constants";
import AuthPage from "../AuthPage/AuthPage";
import AppHome from "../AppHome/AppHome";
import NavBar from "../../components/NavBar/NavBar";
import UpdateProfile from "../Profile/UpdateProfile";
import SingleExperience from "../SingleExperience/SingleExperience";
import SingleDestination from "../SingleDestination/SingleDestination";
import Destinations from "../Destinations/Destinations";
import Experiences from "../Experiences/Experiences";
import ExperiencesByTag from "../ExperiencesByTag/ExperiencesByTag";
import NewExperience from "../../components/NewExperience/NewExperience";
import UpdateExperience from "../../components/UpdateExperience/UpdateExperience";
import NewDestination from "../../components/NewDestination/NewDestination";
import UpdateDestination from "../../components/UpdateDestination/UpdateDestination";
import Profile from "../Profile/Profile";
import { logger } from "../../utilities/logger";
import AllUsers from "../AllUsers/AllUsers";
import InviteTracking from "../InviteTracking/InviteTracking";
import ResetPassword from "../ResetPassword/ResetPassword";
import ConfirmEmail from "../ConfirmEmail/ConfirmEmail";
import { handleOAuthCallback } from "../../utilities/oauth-service";
import CookieConsent from "../../components/CookieConsent/CookieConsent";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import { Helmet } from 'react-helmet-async';

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
            'description': 'Visual travel experience platform for planning and sharing adventures',
            'url': window.location.origin,
            'publisher': {
              '@type': 'Organization',
              'name': 'Biensperience'
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
  const { success, error: showError } = useToast();
  logger.debug('useToast completed');

    // Handle OAuth callback on mount
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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              <main id="main-content" className="container" role="main" aria-label={lang.en.aria.mainContent}>
                <ErrorBoundary
                  title="Page Error"
                  message="We encountered an error loading this page. Please try again or return home."
                  showHomeButton={true}
                >
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
                    <Route path="/destinations" element={<Destinations />} />
                    <Route path="/experience-types/:tagName" element={<ExperiencesByTag />} />
                    <Route path="/experiences/:experienceId" element={
                      <ErrorBoundary title="Experience Error" message="Error loading experience details.">
                        <SingleExperience />
                      </ErrorBoundary>
                    } />
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
                </ErrorBoundary>
              </main>
            </>
          ) : (
            <main id="main-content" className="container" role="main" aria-label={lang.en.aria.authentication}>
              <Routes>
                <Route path="/signup" element={<AuthPage />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
                <Route path="*" element={<AuthPage />} />
              </Routes>
            </main>
          )}
        </div>
      </>
    );
}
