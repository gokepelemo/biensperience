import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import "@fontsource/inter";
import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { ToastProvider, useToast } from "../../contexts/ToastContext";
import { UserProvider, useUser } from "../../contexts/UserContext";
import { DataProvider } from "../../contexts/DataContext";
import { AppProvider } from "../../contexts/AppContext";
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
import AllUsers from "../AllUsers/AllUsers";
import { handleOAuthCallback } from "../../utilities/oauth-service";
import CookieConsent from "../../components/CookieConsent/CookieConsent";

/**
 * Main application component wrapper
 * Provides all context providers in the correct order
 */
export default function App() {
  return (
    <ToastProvider>
      <UserProvider>
        <AppProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </AppProvider>
      </UserProvider>
    </ToastProvider>
  );
}

/**
 * App content component that uses contexts
 * Separated from App to allow hooks usage
 */
function AppContent() {
  const { user, updateUser, isAuthenticated } = useUser();
  const { success, error: showError } = useToast();

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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="App">
        <CookieConsent />
        {isAuthenticated ? (
          <>
            <NavBar />
            <main id="main-content" className="container" role="main" aria-label="Main content">
              <Routes>
                <Route path="/" element={<AppHome />} />
                <Route path="/experiences/new" element={<NewExperience />} />
                <Route path="/destinations/new" element={<NewDestination />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:profileId" element={<Profile />} />
                <Route path="/profile/update" element={<UpdateProfile />} />
                <Route path="/admin/users" element={<AllUsers />} />
                <Route path="/experiences" element={<Experiences />} />
                <Route path="/destinations" element={<Destinations />} />
                <Route path="/experience-types/:tagName" element={<ExperiencesByTag />} />
                <Route path="/experiences/:experienceId" element={<SingleExperience />} />
                <Route path="/experiences/:experienceId/update" element={<UpdateExperience />} />
                <Route path="/destinations/:destinationId" element={<SingleDestination />} />
                <Route path="/destinations/:destinationId/update" element={<UpdateDestination />} />
                <Route path="/logout" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </>
        ) : (
          <main id="main-content" className="container" role="main" aria-label="Authentication">
            <Routes>
              <Route path="/signup" element={<AuthPage />} />
              <Route path="*" element={<AuthPage />} />
            </Routes>
          </main>
        )}
      </div>
    </>
  );
}
