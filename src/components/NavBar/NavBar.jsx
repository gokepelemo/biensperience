import { NavLink } from "react-router-dom";
import "./NavBar.css"
import * as usersService from "../../utilities/users-service.js";
import { useEffect } from "react";

export default function NavBar({ user, setUser }) {
  function handleLogOut() {
    usersService.logout();
    setUser(null);
  }
  
  // Initialize Bootstrap dropdowns
  useEffect(() => {
    // Dynamically import Bootstrap's Dropdown component
    import('bootstrap/js/dist/dropdown').then((module) => {
      const Dropdown = module.default;
      const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
      dropdownElementList.map(function (dropdownToggleEl) {
        return new Dropdown(dropdownToggleEl);
      });
    });
  }, []);
  
  return (
    <nav
      className="navbar navbar-expand-lg bg-dark border-bottom border-body"
      data-bs-theme="dark"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container-fluid">
        <NavLink
          className="navbar-brand"
          to="/"
          aria-label="Biensperience home"
        >
          Biensperience <button className="btn btn-light btn-sm logo" aria-hidden="true">✚</button>
        </NavLink>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarText"
          aria-controls="navbarText"
          aria-expanded="false"
          aria-label="Toggle navigation menu"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarText">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 d-flex" role="menubar">
            <li className="nav-item" role="none">
              <NavLink
                to="/destinations"
                className="nav-link"
                role="menuitem"
                aria-label="Browse destinations"
              >
                Destinations
              </NavLink>
            </li>
            <li className="nav-item" role="none">
              <NavLink
                to="/experiences"
                className="nav-link"
                role="menuitem"
                aria-label="Browse experiences"
              >
                Experiences
              </NavLink>
            </li>
            <li className="nav-item dropdown" role="none">
              <button
                className="nav-link dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-haspopup="true"
                aria-label={`User menu for ${user.name}`}
              >
                {user.name}
              </button>
              <ul className="dropdown-menu" role="menu" aria-label="User account options">
                <li role="none">
                  <NavLink
                    to="/profile"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label="View your profile"
                  >
                    Profile
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/destinations/new"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label="Create a new destination"
                  >
                    New Destination
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/experiences/new"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label="Create a new experience"
                  >
                    New Experience
                  </NavLink>
                </li>
                <li role="none">
                  <hr className="dropdown-divider" aria-hidden="true" />
                </li>
                <li role="none">
                  <NavLink
                    to="/logout"
                    onClick={handleLogOut}
                    className="dropdown-item"
                    role="menuitem"
                    aria-label="Log out of your account"
                  >
                    Logout
                  </NavLink>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
