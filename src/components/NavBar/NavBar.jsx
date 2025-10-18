import { NavLink } from "react-router-dom";
import "./NavBar.css"
import * as usersService from "../../utilities/users-service.js";
import { useEffect, useRef } from "react";
import { isSuperAdmin } from "../../utilities/permissions";

export default function NavBar({ user, setUser }) {
  const collapseRef = useRef(null);
  const toggleRef = useRef(null);
  const dropdownButtonRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  
  function handleLogOut() {
    usersService.logout();
    setUser(null);
  }
  
  useEffect(() => {
    const collapseEl = collapseRef.current;
    const toggleBtn = toggleRef.current;
    const dropdownButton = dropdownButtonRef.current;
    const dropdownMenu = dropdownMenuRef.current;
    
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
    
    // Custom dropdown toggle handler with smooth animations
    const handleDropdownToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!dropdownMenu || !dropdownButton) return;
      
      const isCurrentlyOpen = dropdownButton.getAttribute('aria-expanded') === 'true';
      
      if (isCurrentlyOpen) {
        // Close dropdown with ease-out animation
        dropdownMenu.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
        dropdownMenu.style.opacity = '0';
        dropdownMenu.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
          dropdownMenu.style.display = 'none';
          dropdownButton.setAttribute('aria-expanded', 'false');
        }, 200);
      } else {
        // Open dropdown with ease-in animation
        dropdownMenu.style.display = 'block';
        dropdownMenu.style.opacity = '0';
        dropdownMenu.style.transform = 'translateY(-10px)';
        dropdownMenu.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-in';
        
        // Force reflow
        void dropdownMenu.offsetHeight;
        
        requestAnimationFrame(() => {
          dropdownMenu.style.opacity = '1';
          dropdownMenu.style.transform = 'translateY(0)';
          dropdownButton.setAttribute('aria-expanded', 'true');
        });
      }
    };
    
    // Close dropdown when clicking outside
    const handleClickOutside = (e) => {
      if (!dropdownMenu || !dropdownButton) return;
      
      if (!dropdownMenu.contains(e.target) && !dropdownButton.contains(e.target)) {
        const isCurrentlyOpen = dropdownButton.getAttribute('aria-expanded') === 'true';
        
        if (isCurrentlyOpen) {
          dropdownMenu.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
          dropdownMenu.style.opacity = '0';
          dropdownMenu.style.transform = 'translateY(-10px)';
          
          setTimeout(() => {
            dropdownMenu.style.display = 'none';
            dropdownButton.setAttribute('aria-expanded', 'false');
          }, 200);
        }
      }
    };
    
    // Attach dropdown event listeners
    if (dropdownButton) {
      dropdownButton.addEventListener('click', handleDropdownToggle);
    }
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      toggleBtn.removeEventListener('click', handleToggle);
      
      if (dropdownButton) {
        dropdownButton.removeEventListener('click', handleDropdownToggle);
      }
      
      document.removeEventListener('click', handleClickOutside);
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
                ref={dropdownButtonRef}
                className="nav-link dropdown-toggle"
                type="button"
                aria-expanded="false"
                aria-haspopup="true"
                aria-label={`User menu for ${user.name}`}
              >
                {user.name}
              </button>
              <ul 
                ref={dropdownMenuRef}
                className="dropdown-menu" 
                role="menu" 
                aria-label="User account options"
                style={{ display: 'none' }}
              >
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
                {isSuperAdmin(user) && (
                  <li role="none">
                    <NavLink
                      to="/admin/users"
                      className="dropdown-item"
                      role="menuitem"
                      aria-label="Admin panel - manage all users"
                    >
                      All Users
                    </NavLink>
                  </li>
                )}
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
