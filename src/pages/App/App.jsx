import "bootstrap/dist/css/bootstrap.min.css";
import * as bootstrap from "bootstrap";
import "./App.css";
import "@fontsource/inter";
import React from "react";
import { useState, useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import AuthPage from "../AuthPage/AuthPage";
import AppHome from "../AppHome/AppHome";
import NavBar from "../../components/NavBar/NavBar";
import EditProfile from "../Profile/EditProfile";
import SingleExperience from "../SingleExperience/SingleExperience";
import SingleDestination from "../SingleDestination/SingleDestination";
import Destinations from "../Destinations/Destinations";
import Experiences from "../Experiences/Experiences";
import NewExperience from "../../components/NewExperience/NewExperience";
import NewDestination from "../../components/NewDestination/NewDestination";
import Profile from "../Profile/Profile";
import { getUser } from "../../utilities/users-service";
import { getExperiences } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";

export default function App() {
  const [user, setUser] = useState(getUser());
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  async function updateData() {
    if (user) {
      let destinationsData = await getDestinations()
      setDestinations(destinationsData);
      let experiencesData = await getExperiences()
      setExperiences(experiencesData);
    }
  }
  useEffect(() => {
    async function updateData() {
      if (user) {
        await getDestinations().then(function (destinations) {
          setDestinations(destinations);
        });
        await getExperiences().then(function (experiences) {
          setExperiences(experiences);
        });
      }
    }
    updateData();
  }, [user]);
  return (
    <main className="App container container-fluid">
      {user ? (
        <>
          <NavBar user={user} setUser={setUser} />
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
              path="/profile/edit"
              element={<EditProfile user={user} setUser={setUser} />}
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
            <Route path="/logout" element={<Navigate to="/" />} />
          </Routes>
        </>
      ) : (
        <AuthPage setUser={setUser} />
      )}
    </main>
  );
}
