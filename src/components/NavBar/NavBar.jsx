import { NavLink } from "react-router-dom";
import "./NavBar.css"
import * as usersService from "../../utilities/users-service.js";
export default function NavBar({ user, setUser }) {
  function handleLogOut() {
    usersService.logout();
    setUser(null);
  }
  return (
    <nav className="navbar navbar-expand-lg bg-dark border-bottom border-body" data-bs-theme="dark">
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/">
          Biensperience <button className="btn btn-light btn-sm logo">+</button>
        </NavLink>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarText"
          aria-controls="navbarText"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarText">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 d-flex">
            <li className="nav-item">
              <NavLink to="/destinations" className="nav-link">
                Destinations
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/experiences" className="nav-link">
                Experiences
              </NavLink>
            </li>
            <li className="nav-item dropdown">
              <NavLink
                className="nav-link dropdown-toggle"
                href="#"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {user.name}
              </NavLink>
              <ul className="dropdown-menu">
                <li>
                  <NavLink to="/profile"
                    className="dropdown-item"
                  >
                    Profile
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/destinations/new"
                    className="dropdown-item"
                  >
                    New Destination
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/experiences/new"
                    className="dropdown-item"
                  >
                    New Experience
                  </NavLink>
                </li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <NavLink
                    to="/logout"
                    onClick={handleLogOut}
                    className="dropdown-item"
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
