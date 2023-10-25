import { NavLink } from "react-router-dom";
import * as usersService from "../../utilities/users-service.js";
export default function NavBar({ user, setUser }) {
  function handleLogOut() {
    usersService.logout();
    setUser(null);
  }
  return (
    <nav className="navbar navbar-expand-lg bg-body-secondary">
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/">
          Quick Notes
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
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink to="" onClick={handleLogOut} className="nav-link">
                Logout
              </NavLink>
            </li>
          </ul>
          <span className="navbar-text badge text-bg-primary">Signed in as: {user.name}</span>
        </div>
      </div>
    </nav>
  );
}
