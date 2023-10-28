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
import SingleExperience from "../SingleExperience/SingleExperience";
import SingleDestination from "../SingleDestination/SingleDestination";
import Destinations from "../Destinations/Destinations";
import Experiences from "../Experiences/Experiences";
import NewExperience from "../../components/NewExperience/NewExperience";
import NewDestination from "../../components/NewDestination/NewDestination";
import Profile from "../Profile/Profile";
import { getUser } from "../../utilities/users-service";
import { getUserData } from "../../utilities/users-api";
import { getExperiences } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";

export default function App() {
  const [user, setUser] = useState(getUser());
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [render, setRender] = useState(0);
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    async function updateData() {
      if (user) {
        let destinationsData = await getDestinations();
        let experiencesData = await getExperiences();
        setDestinations(destinationsData);
        setExperiences(experiencesData);
      }
    }
    updateData();
  }, [user, render]);
  return (
    <main className="App container container-fluid">
      {user ? (
        <>
          <NavBar user={user} setUser={setUser} />
          <Routes>
            <Route path="/" element={<AppHome user={user} />} />
            {/* temporary routes for creating experiences and destinations */}
            <Route
              path="/experiences/new"
              element={<NewExperience render={render} setRender={setRender} />}
            />
            <Route
              path="/destinations/new"
              element={<NewDestination render={render} setRender={setRender} />}
            />
            <Route
              path="/profile"
              element={
                <Profile
                  user={user}
                  setUser={setUser}
                  destinations={destinations}
                  experiences={experiences}
                  render={render}
                  setRender={setRender}
                />
              }
            />
            <Route path="/profile/:profileId" element={<Profile />} />
            <Route
              path="/experiences"
              element={
                <Experiences
                  experiences={experiences}
                  user={user}
                  setUser={setUser}
                  render={render}
                  setRender={setRender}
                />
              }
            />
            <Route
              path="/destinations"
              element={<Destinations destinations={destinations} />}
            />
            <Route
              path="/experiences/:experienceId"
              element={
                <SingleExperience
                  user={user}
                  setUser={setUser}
                  experiences={experiences}
                />
              }
            />
            <Route
              path="/destinations/:destinationId"
              element={<SingleDestination />}
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
