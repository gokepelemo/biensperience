import { NavLink } from "react-router-dom";
import "./NavBar.css"
import * as usersService from "../../utilities/users-service.js";
import debug from "../../utilities/debug";
import { useEffect, useRef } from "react";

export default function NavBar({ user, setUser }) {
  const collapseRef = useRef(null);
  const toggleRef = useRef(null);
  
  function handleLogOut() {
    usersService.logout();
    setUser(null);
  }
  
  useEffect(() => {
    const collapseEl = collapseRef.current;
    const toggleBtn = toggleRef.current;
    
    if (!collapseEl || !toggleBtn) return;
    
    // Custom toggle handler for mobile collapse
    const handleToggle = (e) => {
      e.preventDefault();
      
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Close the menu
        collapseEl.style.height = collapseEl.scrollHeight + 'px';
        collapseEl.classList.remove('show');
        collapseEl.classList.add('collapsing');
        
        // Force reflow to trigger transition
        void collapseEl.offsetHeight;
        
        collapseEl.style.height = '0';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.add('collapsed');
        
        setTimeout(() => {
          collapseEl.classList.remove('collapsing');
          collapseEl.style.height = '';
        }, 350);
      } else {
        // Open the menu
        collapseEl.classList.add('collapsing');
        collapseEl.style.height = '0';
        
        // Force reflow to trigger transition
        void collapseEl.offsetHeight;
        
        const height = collapseEl.scrollHeight;
        collapseEl.style.height = height + 'px';
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.classList.remove('collapsed');
        
        setTimeout(() => {
          collapseEl.classList.remove('collapsing');
          collapseEl.classList.add('show');
          collapseEl.style.height = '';
        }, 350);
      }
    };
    
    toggleBtn.addEventListener('click', handleToggle);
    
    // Initialize Bootstrap Dropdown for the user menu
    // Import dynamically to avoid bundle bloat
    let dropdownInstance = null;
    
    import('bootstrap/js/dist/dropdown').then((module) => {
      const Dropdown = module.default;
      const dropdownToggle = document.querySelector('.navbar .dropdown-toggle');
      
      if (dropdownToggle) {
        // Initialize dropdown
        dropdownInstance = new Dropdown(dropdownToggle);
        debug.log('Dropdown initialized successfully');
      }
    }).catch(err => {
      console.error('Failed to initialize dropdown:', err);
    });
    
    return () => {
      toggleBtn.removeEventListener('click', handleToggle);
      // Cleanup dropdown instance
      if (dropdownInstance && typeof dropdownInstance.dispose === 'function') {
        dropdownInstance.dispose();
      }
    };
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
          ref={toggleRef}
          className="navbar-toggler collapsed"
          type="button"
          aria-controls="navbarText"
          aria-expanded="false"
          aria-label="Toggle navigation menu"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div ref={collapseRef} className="collapse navbar-collapse" id="navbarText">
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
