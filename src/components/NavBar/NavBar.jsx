import { NavLink, useLocation } from "react-router-dom";
import "./NavBar.css"
import { useEffect, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import SearchBar from "../SearchBar/SearchBar";
import ActionButtons from "../ActionButtons/ActionButtons";
import { lang } from "../../lang.constants";

export default function NavBar() {
  const collapseRef = useRef(null);
  const toggleRef = useRef(null);
  const dropdownButtonRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const navbarRef = useRef(null);

  const { logoutUser, getDisplayName, isSuperAdmin: isSuper, user } = useUser();
  const { getExperience, getDestination } = useData();
  const {
    isScrolled,
    h1Visible,
    h1Text,
    showActionButtons,
    actionButtons,
    showH1InNavbar,
  } = useApp();
  const location = useLocation();

  // Determine brand text based on current route and context
  const getBrandText = () => {
    // Check if we're on an update route
    const path = location.pathname;
    
    if (path.includes('/update')) {
      if (path.startsWith('/experiences/') && path.endsWith('/update')) {
        // Extract experience ID from path
        const experienceId = path.split('/')[2];
        const experience = getExperience(experienceId);
        if (experience) {
          return `Update: ${experience.name}`;
        }
      } else if (path.startsWith('/destinations/') && path.endsWith('/update')) {
        // Extract destination ID from path
        const destinationId = path.split('/')[2];
        const destination = getDestination(destinationId);
        if (destination) {
          return `Update: ${destination.name}`;
        }
      } else if (path === '/profile/update') {
        return `Update: ${user?.name || 'Profile'}`;
      }
    }
    
    // Default logic: show h1 text when scrolled past h1, otherwise show Biensperience
    return (!h1Visible && h1Text && showH1InNavbar) ? h1Text : 'Biensperience';
  };

  function handleLogOut() {
    logoutUser();
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
      ref={navbarRef}
      className={`navbar navbar-expand-lg bg-dark border-bottom border-body ${isScrolled ? 'sticky' : ''}`}
      data-bs-theme="dark"
      role="navigation"
      aria-label={lang.en.aria.mainNavigation}
    >
      <div className="container-fluid">
        <div className="navbar-brand-wrapper">
          <NavLink
            className="navbar-brand"
            to="/"
            aria-label={lang.en.aria.biensperienceHome}
          >
            <button className="btn btn-light btn-sm logo" aria-hidden="true">✚</button>
            <span className="brand-text">
              {getBrandText()}
            </span>
          </NavLink>
        </div>

        <button
          ref={toggleRef}
          className="navbar-toggler collapsed"
          type="button"
          aria-controls="navbarText"
          aria-expanded="false"
          aria-label={lang.en.aria.toggleNavigationMenu}
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
                aria-label={lang.en.aria.browseDestinations}
              >
                Destinations
              </NavLink>
            </li>
            <li className="nav-item" role="none">
              <NavLink
                to="/experiences"
                className="nav-link"
                role="menuitem"
                aria-label={lang.en.aria.browseExperiences}
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
                aria-label={`User menu for ${getDisplayName()}`}
              >
                {getDisplayName()}
              </button>
              <ul
                ref={dropdownMenuRef}
                className="dropdown-menu"
                role="menu"
                aria-label={lang.en.aria.userAccountOptions}
                style={{ display: 'none' }}
              >
                <li role="none">
                  <NavLink
                    to="/profile"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label={lang.en.aria.viewYourProfile}
                  >
                    Profile
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/invites"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label={lang.en.aria.trackYourInviteCodes}
                  >
                    Invites
                  </NavLink>
                </li>
                {isSuper() && (
                  <li role="none">
                    <NavLink
                      to="/admin/users"
                      className="dropdown-item"
                      role="menuitem"
                      aria-label={lang.en.aria.adminPanelManageUsers}
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
                    aria-label={lang.en.aria.createNewDestination}
                  >
                    New Destination
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/experiences/new"
                    className="dropdown-item"
                    role="menuitem"
                    aria-label={lang.en.aria.createNewExperience}
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
                    aria-label={lang.en.aria.logOutOfAccount}
                  >
                    Logout
                  </NavLink>
                </li>
              </ul>
            </li>
          </ul>

          {/* Search Bar */}
          <div className="navbar-search">
            <SearchBar placeholder="Search..." className="navbar-search-input" />
          </div>

          {/* Dynamic Action Buttons - shown when scrolled past h1 */}
          {showActionButtons && actionButtons.length > 0 && (
            <div className="navbar-actions fade-in">
              <ActionButtons buttons={actionButtons} compact={true} />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
