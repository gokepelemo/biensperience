import "bootstrap/dist/css/bootstrap.min.css";
import * as bootstrap from "bootstrap";
import './App.css';
import React from 'react';
import { useState } from "react";
import { Route, Routes } from 'react-router-dom';
import AuthPage from "../AuthPage/AuthPage";
import AppHome from "../AppHome/AppHome";
import NavBar from "../../components/NavBar/NavBar";
import { getUser } from "../../utilities/users-service"

export default function App() {
  const [user, setUser] = useState(getUser())
  return (
    <main className="App">
      { user ?
      (<>
      <NavBar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<AppHome user={user}/>} />
      </Routes>
      </>
      )
      :
      <AuthPage setUser={setUser} />
    }
    </main>
  );
}
