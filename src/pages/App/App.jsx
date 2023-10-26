import "bootstrap/dist/css/bootstrap.min.css";
import * as bootstrap from "bootstrap";
import "./App.css";
import "@fontsource/inter";
import React from "react";
import { useState } from "react";
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

export default function App() {
  const [user, setUser] = useState(getUser());
  return (
    <main className="App container container-fluid">
      {user ? (
        <>
          <NavBar user={user} setUser={setUser} />
          <Routes>
            <Route path="/" element={<AppHome user={user} />} />
            {/* temporary routes for creating experiences and destinations */}
            <Route path="/experiences/new" element={<NewExperience />} />
            <Route path="/destinations/new" element={<NewDestination />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/profile/:profileId" element={<Profile />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route
              path="/experiences/:experienceId"
              element={<SingleExperience />}
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
