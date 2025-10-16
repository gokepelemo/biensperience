import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import "@fontsource/inter";
import React from "react";
import { useState, useEffect, useCallback } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { ToastProvider } from "../../contexts/ToastContext";
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
import { getUser } from "../../utilities/users-service";
import { getExperiences } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import { handleOAuthCallback } from "../../utilities/oauth-service";
import { useToast } from "../../contexts/ToastContext";
import CookieConsent from "../../components/CookieConsent/CookieConsent";

/**
 * Main application component that handles routing and global state management.
 * Manages user authentication, destinations, and experiences data across the app.
 *
 * @returns {JSX.Element} The main application component with routing
 */
export default function App() {
  const [user, setUser] = useState(getUser());
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const { success, error: showError } = useToast();

  /**
   * Fetches and updates destinations and experiences data from the API.
   * Used as a callback to refresh data after mutations.
   *
   * @async
   * @returns {Promise<void>}
   */
  const updateData = useCallback(async () => {
    if (user) {
      try {
        const [destinationsData, experiencesData] = await Promise.all([
          getDestinations(),
          getExperiences()
        ]);
        setDestinations(destinationsData);
        setExperiences(experiencesData || []);
      } catch (error) {
        console.error('Failed to update data:', error);
        // Don't clear existing data on error
      }
    }
  }, [user]);

  // Handle OAuth callback on mount
  useEffect(() => {
    const processOAuth = async () => {
      try {
        const result = await handleOAuthCallback();
        if (result) {
          const { user: oauthUser, provider } = result;
          setUser(oauthUser);
          success(`Successfully signed in with ${provider}!`);
          // Data will be fetched by the updateData effect
        }
      } catch (err) {
        showError(err.message || 'Authentication failed');
      }
    };

    processOAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateData();
  }, [updateData]);

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="App">
        <CookieConsent />
        {user ? (
          <>
            <NavBar user={user} setUser={setUser} />
            <main id="main-content" className="container" role="main" aria-label="Main content">
              <Routes>
            <Route
              path="/"
              element={
                <AppHome
                  user={user}
                  destinations={destinations}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/experiences/new"
              element={<NewExperience updateData={updateData} />}
            />
            <Route
              path="/destinations/new"
              element={<NewDestination updateData={updateData} />}
            />
            <Route
              path="/profile"
              element={
                <Profile
                  user={user}
                  destinations={destinations}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/profile/:profileId"
              element={
                <Profile
                  user={user}
                  destinations={destinations}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/profile/update"
              element={<UpdateProfile user={user} setUser={setUser} updateData={updateData} />}
            />
            <Route
              path="/experiences"
              element={
                <Experiences
                  user={user}
                  setUser={setUser}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/destinations"
              element={
                <Destinations
                  destinations={destinations}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/experience-types/:tagName"
              element={
                <ExperiencesByTag
                  user={user}
                  setUser={setUser}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/experiences/:experienceId"
              element={
                <SingleExperience
                  user={user}
                  experiences={experiences}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/experiences/:experienceId/update"
              element={
                <UpdateExperience
                  user={user}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/destinations/:destinationId"
              element={
                <SingleDestination
                  destinations={destinations}
                  experiences={experiences}
                  user={user}
                  setUser={setUser}
                  updateData={updateData}
                />
              }
            />
            <Route
              path="/destinations/:destinationId/update"
              element={
                <UpdateDestination
                  user={user}
                  updateData={updateData}
                />
              }
            />
            <Route path="/logout" element={<Navigate to="/" />} />
          </Routes>
        </main>
          </>
        ) : (
          <main id="main-content" className="container" role="main" aria-label="Authentication">
            <Routes>
              <Route path="/signup" element={<AuthPage setUser={setUser} />} />
              <Route path="*" element={<AuthPage setUser={setUser} />} />
            </Routes>
          </main>
        )}
      </div>
    </ToastProvider>
  );
}
