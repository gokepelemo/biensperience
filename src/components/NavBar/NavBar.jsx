import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./NavBar.module.scss";
import { useEffect, useRef, useCallback } from "react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import SearchBar from "../SearchBar/SearchBar";
import ActionButtons from "../ActionButtons/ActionButtons";
import { lang } from "../../lang.constants";
import { FaUser, FaTicketAlt, FaUsers, FaMapMarkerAlt, FaStar, FaSignOutAlt } from "react-icons/fa";

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
  const navigate = useNavigate();

  // Check if brand text is showing the h1 element (not "Biensperience")
  const isShowingH1 = !h1Visible && h1Text && showH1InNavbar;

  // Handle brand text click - scroll to top if showing h1, navigate home otherwise
  const handleBrandClick = useCallback(() => {
    if (isShowingH1) {
      // Scroll to top of page smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Navigate to home
      navigate('/');
    }
  }, [isShowingH1, navigate]);

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
        collapseEl.classList.remove('collapse', 'show');
        collapseEl.classList.add('collapsing');

        // Force reflow to trigger transition
        void collapseEl.offsetHeight;

        collapseEl.style.height = '0';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.add('collapsed');

        setTimeout(() => {
          collapseEl.classList.remove('collapsing');
          collapseEl.classList.add('collapse');
          collapseEl.style.height = '';
        }, 350);
      } else {
        // Open the menu
        // First, remove the collapse class to make element visible for measurement
        collapseEl.classList.remove('collapse');
        collapseEl.classList.add('collapsing');
        collapseEl.style.height = '0';
        collapseEl.style.display = 'flex'; // Ensure visible for measurement

        // Force reflow to ensure element is rendered
        void collapseEl.offsetHeight;

        // Now measure the actual content height
        const height = collapseEl.scrollHeight;
        collapseEl.style.height = height + 'px';
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.classList.remove('collapsed');

        setTimeout(() => {
          collapseEl.classList.remove('collapsing');
          collapseEl.classList.add('collapse', 'show');
          collapseEl.style.height = '';
          collapseEl.style.display = ''; // Let CSS handle display
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
      className={`${styles.navbar} navbar navbar-expand-lg border-bottom border-body ${styles.sticky}`}
      data-bs-theme="dark"
      role="navigation"
      aria-label={lang.current.aria.mainNavigation}
    >
      <div className="container-fluid">
        <div className={styles.navbarBrandWrapper}>
          {/* Logo - navigates to home */}
          <NavLink
            className={styles.logoLink}
            to="/"
            aria-label={lang.current.aria.biensperienceHome}
          >
            <button className={`btn btn-light btn-sm ${styles.logo}`} aria-hidden="true">✚</button>
          </NavLink>
          {/* Brand text - scrolls to top when showing h1, navigates home otherwise */}
          <button
            type="button"
            className={`${styles.brandText} ${styles.brandTextButton}`}
            onClick={handleBrandClick}
            aria-label={isShowingH1 ? "Scroll to top of page" : lang.current.aria.biensperienceHome}
          >
            {getBrandText()}
          </button>
        </div>

        <button
          ref={toggleRef}
          className="navbar-toggler collapsed"
          type="button"
          aria-controls="navbarText"
          aria-expanded="false"
          aria-label={lang.current.aria.toggleNavigationMenu}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div ref={collapseRef} className={`collapse navbar-collapse ${styles.navbarCollapse}`} id="navbarText">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 d-flex" role="menubar">
            <li className="nav-item" role="none">
              <NavLink
                to="/destinations"
                className={({ isActive }) => {
                  // Active if on /destinations or any /destinations/* route
                  const isDestinationsRoute = location.pathname.startsWith('/destinations');
                  return `nav-link ${isDestinationsRoute ? 'active' : ''}`;
                }}
                role="menuitem"
                aria-label={lang.current.aria.browseDestinations}
              >
                Destinations
              </NavLink>
            </li>
            <li className="nav-item" role="none">
              <NavLink
                to="/experiences"
                className={({ isActive }) => {
                  // Active if on /experiences or any /experiences/* route
                  const isExperiencesRoute = location.pathname.startsWith('/experiences');
                  return `nav-link ${isExperiencesRoute ? 'active' : ''}`;
                }}
                role="menuitem"
                aria-label={lang.current.aria.browseExperiences}
              >
                Experiences
              </NavLink>
            </li>
            <li className="nav-item" role="none">
              <NavLink
                to="/dashboard"
                className="nav-link"
                role="menuitem"
                aria-label="View dashboard"
              >
                Dashboard
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
                aria-label={lang.current.aria.userAccountOptions}
              >
                <li role="none">
                  <NavLink
                    to="/profile"
                    className={`dropdown-item ${styles.dropdownItem}`}
                    role="menuitem"
                    aria-label={lang.current.aria.viewYourProfile}
                  >
                    <FaUser className={styles.dropdownIcon} />
                    <span>Profile</span>
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/invites"
                    className={`dropdown-item ${styles.dropdownItem}`}
                    role="menuitem"
                    aria-label={lang.current.aria.trackYourInviteCodes}
                  >
                    <FaTicketAlt className={styles.dropdownIcon} />
                    <span>Invites</span>
                  </NavLink>
                </li>
                {isSuper() && (
                  <li role="none">
                    <NavLink
                      to="/admin/users"
                      className={`dropdown-item ${styles.dropdownItem}`}
                      role="menuitem"
                      aria-label={lang.current.aria.adminPanelManageUsers}
                    >
                      <FaUsers className={styles.dropdownIcon} />
                      <span>All Users</span>
                    </NavLink>
                  </li>
                )}
                <li role="none">
                  <NavLink
                    to="/destinations/new"
                    className={`dropdown-item ${styles.dropdownItem}`}
                    role="menuitem"
                    aria-label={lang.current.aria.createNewDestination}
                  >
                    <FaMapMarkerAlt className={styles.dropdownIcon} />
                    <span>New Destination</span>
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/experiences/new"
                    className={`dropdown-item ${styles.dropdownItem}`}
                    role="menuitem"
                    aria-label={lang.current.aria.createNewExperience}
                  >
                    <FaStar className={styles.dropdownIcon} />
                    <span>New Experience</span>
                  </NavLink>
                </li>
                <li role="none">
                  <hr className="dropdown-divider" aria-hidden="true" />
                </li>
                <li role="none">
                  <NavLink
                    to="/logout"
                    onClick={handleLogOut}
                    className={`dropdown-item ${styles.dropdownItem} ${styles.dropdownItemLogout}`}
                    role="menuitem"
                    aria-label={lang.current.aria.logOutOfAccount}
                  >
                    <FaSignOutAlt className={styles.dropdownIcon} />
                    <span>Logout</span>
                  </NavLink>
                </li>
              </ul>
            </li>
          </ul>

          {/* Search Bar */}
          <div className={styles.navbarSearch}>
            <SearchBar placeholder="Search..." className="navbar-search-input" />
          </div>

          {/* Dynamic Action Buttons - shown when scrolled past h1 */}
          {showActionButtons && actionButtons.length > 0 && (
            <div className={`${styles.navbarActions} animation-fade-in`}>
              <ActionButtons buttons={actionButtons} compact={true} />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
