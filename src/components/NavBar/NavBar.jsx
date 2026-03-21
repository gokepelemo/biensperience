/**
 * NavBar Component — Chakra UI Native
 *
 * Migrated from Bootstrap + manual JS collapse/dropdown to Chakra UI v3:
 * - Box/Flex for layout
 * - Drawer for mobile hamburger menu
 * - Menu for user dropdown
 * - No Bootstrap class dependencies
 *
 * Migration: P4.1 — biensperience-dd5f
 */

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useCallback, useState, useId } from "react";
import { Box, Flex, Drawer, Portal, Menu } from "@chakra-ui/react";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import { useDestinationWizard } from "../../contexts/DestinationWizardContext";
import SearchBar from "../SearchBar/SearchBar";
import ActionButtons from "../ActionButtons/ActionButtons";
import BiensperienceLogo from "../BiensperienceLogo/BiensperienceLogo";
import FollowerRequestsModal from "../FollowerRequestsModal";
import { getFollowRequestCount } from "../../utilities/follows-api";
import { eventBus } from "../../utilities/event-bus";
import { lang } from "../../lang.constants";
import {
  FaUser, FaTicketAlt, FaUsers, FaMapMarkerAlt, FaStar,
  FaSignOutAlt, FaUserPlus, FaBars, FaTimes, FaChevronDown,
  FaCog, FaRobot
} from "react-icons/fa";
import styles from "./NavBar.module.css";

export default function NavBar() {
  const drawerId = useId();
  const { logoutUser, getDisplayName, isSuperAdmin: isSuper, user } = useUser();
  const { getExperience, getDestination } = useData();
  const { openExperienceWizard } = useExperienceWizard();
  const { openDestinationWizard } = useDestinationWizard();

  const [logoHovered, setLogoHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Follower requests state
  const [showFollowerRequests, setShowFollowerRequests] = useState(false);
  const [followerRequestCount, setFollowerRequestCount] = useState(0);

  const hasPrivateProfile = user?.preferences?.profileVisibility === 'private';

  const {
    h1Visible,
    h1Text,
    showActionButtons,
    actionButtons,
    showH1InNavbar,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const isShowingH1 = !h1Visible && h1Text && showH1InNavbar;

  const handleBrandClick = useCallback(() => {
    if (isShowingH1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  }, [isShowingH1, navigate]);

  const getBrandText = () => {
    const path = location.pathname;
    if (path.includes('/update')) {
      if (path.startsWith('/experiences/') && path.endsWith('/update')) {
        const experienceId = path.split('/')[2];
        const experience = getExperience(experienceId);
        if (experience) return `Update: ${experience.name}`;
      } else if (path.startsWith('/destinations/') && path.endsWith('/update')) {
        const destinationId = path.split('/')[2];
        const destination = getDestination(destinationId);
        if (destination) return `Update: ${destination.name}`;
      } else if (path === '/profile/update') {
        return `Update: ${user?.name || 'Profile'}`;
      }
    }
    return (!h1Visible && h1Text && showH1InNavbar) ? h1Text : 'Biensperience';
  };

  function handleLogOut() {
    logoutUser();
  }

  const handleRequestCountChange = useCallback((count) => {
    setFollowerRequestCount(count);
  }, []);

  // Fetch follower request count for private profiles
  useEffect(() => {
    if (!user || !hasPrivateProfile) {
      setFollowerRequestCount(0);
      return;
    }
    const fetchCount = async () => {
      try {
        const count = await getFollowRequestCount();
        setFollowerRequestCount(count);
      } catch (err) {
        // Silent fail
      }
    };
    fetchCount();

    const handleNewRequest = () => fetchCount();
    const handleRequestAccepted = () => setFollowerRequestCount(prev => Math.max(0, prev - 1));
    const handleRequestRejected = () => setFollowerRequestCount(prev => Math.max(0, prev - 1));

    const unsub1 = eventBus.subscribe('follow:request:created', handleNewRequest);
    const unsub2 = eventBus.subscribe('follow:request:accepted', handleRequestAccepted);
    const unsub3 = eventBus.subscribe('follow:request:rejected', handleRequestRejected);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user, hasPrivateProfile]);

  const isRouteActive = (prefix) => location.pathname.startsWith(prefix);

  /* ── Render: desktop nav links ───────────────────────────────── */

  const renderDesktopNavLinks = () => (
    <ul className={styles.navList}>
      <li>
        <NavLink
          to="/destinations"
          className={`${styles.navLink} ${isRouteActive('/destinations') ? styles.navLinkActive : ''}`}
          aria-label={lang.current.aria.browseDestinations}
        >
          Destinations
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/experiences"
          className={`${styles.navLink} ${isRouteActive('/experiences') ? styles.navLinkActive : ''}`}
          aria-label={lang.current.aria.browseExperiences}
        >
          Experiences
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/dashboard"
          className={styles.navLink}
          aria-label={lang.current.aria.viewDashboard}
        >
          Dashboard
        </NavLink>
      </li>

      {/* User dropdown */}
      <li>
        <Menu.Root positioning={{ placement: 'bottom-end', strategy: 'fixed' }}>
          <Menu.Trigger asChild>
            <button
              type="button"
              className={styles.navLink}
              aria-haspopup="true"
              aria-label={lang.current.aria.userMenuFor.replace('{name}', getDisplayName())}
            >
              {getDisplayName()}
              <FaChevronDown
                size={10}
                className={styles.chevron}
              />
            </button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content className={styles.dropdownMenu}>
                {renderDropdownItems(false)}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </li>
    </ul>
  );

  /* ── Render: dropdown items (desktop only) ────────────────── */

  const renderDropdownItems = (isMobile) => {
    const closeMenu = isMobile ? closeMobile : () => {};
    return (
      <>
        <Menu.Item value="profile" asChild className={styles.dropdownItem}>
          <NavLink to="/profile" onClick={closeMenu} aria-label={lang.current.aria.viewYourProfile}>
            <FaUser className={styles.dropdownIcon} />
            <span>Profile</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item value="invites" asChild className={styles.dropdownItem}>
          <NavLink to="/invites" onClick={closeMenu} aria-label={lang.current.aria.trackYourInviteCodes}>
            <FaTicketAlt className={styles.dropdownIcon} />
            <span>Invites</span>
          </NavLink>
        </Menu.Item>
        {hasPrivateProfile && (
          <Menu.Item
            value="follower-requests"
            className={styles.dropdownItem}
            onClick={() => { closeMenu(); setShowFollowerRequests(true); }}
            aria-label="View follower requests"
          >
            <FaUserPlus className={styles.dropdownIcon} />
            <span>Follower Requests</span>
            {followerRequestCount > 0 && (
              <span className={styles.badge} aria-label={`${followerRequestCount} pending`}>
                {followerRequestCount}
              </span>
            )}
          </Menu.Item>
        )}
        <Menu.Item
          value="new-destination"
          className={styles.dropdownItem}
          onClick={() => { closeMenu(); openDestinationWizard(); }}
          aria-label={lang.current.aria.createNewDestination}
        >
          <FaMapMarkerAlt className={styles.dropdownIcon} />
          <span>New Destination</span>
        </Menu.Item>
        <Menu.Item
          value="new-experience"
          className={styles.dropdownItem}
          onClick={() => { closeMenu(); openExperienceWizard(); }}
          aria-label={lang.current.aria.createNewExperience}
        >
          <FaStar className={styles.dropdownIcon} />
          <span>New Experience</span>
        </Menu.Item>
        {isSuper() && (
          <>
            <Menu.Separator className={styles.dropdownDivider} />
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel className={styles.dropdownGroupLabel}>
                <FaCog className={styles.dropdownIcon} />
                <span>Admin</span>
              </Menu.ItemGroupLabel>
              <Menu.Item value="admin-users" asChild className={styles.dropdownItem}>
                <NavLink to="/admin/users" onClick={closeMenu} aria-label={lang.current.aria.adminPanelManageUsers}>
                  <FaUsers className={styles.dropdownIcon} />
                  <span>Users</span>
                </NavLink>
              </Menu.Item>
              <Menu.Item value="admin-ai" asChild className={styles.dropdownItem}>
                <NavLink to="/admin/ai" onClick={closeMenu} aria-label={lang.current.aria.adminPanelManageAI}>
                  <FaRobot className={styles.dropdownIcon} />
                  <span>AI</span>
                </NavLink>
              </Menu.Item>
            </Menu.ItemGroup>
          </>
        )}
        <Menu.Separator className={styles.dropdownDivider} />
        <Menu.Item
          value="logout"
          asChild
          className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`}
        >
          <NavLink
            to="/logout"
            onClick={(e) => { closeMenu(); handleLogOut(); }}
            aria-label={lang.current.aria.logOutOfAccount}
          >
            <FaSignOutAlt className={styles.dropdownIcon} />
            <span>Logout</span>
          </NavLink>
        </Menu.Item>
      </>
    );
  };

  /* ── Render: mobile nav within Drawer ─────────────────────── */

  const renderMobileNavContent = () => (
    <Flex direction="column" gap="1" py="2">
      {/* Search */}
      <Box px="4" pt="2" pb="1" w="full">
        <SearchBar
          placeholder={lang.current.placeholder.search}
          onResultSelect={closeMobile}
        />
      </Box>

      {/* Entity title when scrolled past h1 */}
      {isShowingH1 && (
        <Box
          as="button"
          type="button"
          className={styles.mobileEntityTitle}
          onClick={() => {
            closeMobile();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label={lang.current.aria.scrollToTop}
        >
          {h1Text}
        </Box>
      )}

      {/* Nav links */}
      <NavLink
        to="/destinations"
        onClick={closeMobile}
        className={`${styles.mobileNavLink} ${isRouteActive('/destinations') ? styles.mobileNavLinkActive : ''}`}
        aria-label={lang.current.aria.browseDestinations}
      >
        Destinations
      </NavLink>
      <NavLink
        to="/experiences"
        onClick={closeMobile}
        className={`${styles.mobileNavLink} ${isRouteActive('/experiences') ? styles.mobileNavLinkActive : ''}`}
        aria-label={lang.current.aria.browseExperiences}
      >
        Experiences
      </NavLink>
      <NavLink
        to="/dashboard"
        onClick={closeMobile}
        className={styles.mobileNavLink}
        aria-label={lang.current.aria.viewDashboard}
      >
        Dashboard
      </NavLink>

      <Box h="1px" bg="border" mx="4" my="2" />

      {/* User menu items (flat on mobile — no dropdown nesting) */}
      <NavLink
        to="/profile"
        onClick={closeMobile}
        className={styles.mobileNavLink}
        aria-label={lang.current.aria.viewYourProfile}
      >
        <FaUser className={styles.mobileIcon} />
        Profile
      </NavLink>
      <NavLink
        to="/invites"
        onClick={closeMobile}
        className={styles.mobileNavLink}
        aria-label={lang.current.aria.trackYourInviteCodes}
      >
        <FaTicketAlt className={styles.mobileIcon} />
        Invites
      </NavLink>
      {hasPrivateProfile && (
        <button
          type="button"
          onClick={() => { closeMobile(); setShowFollowerRequests(true); }}
          className={`${styles.mobileNavLink} ${styles.mobileButton}`}
          aria-label="View follower requests"
        >
          <FaUserPlus className={styles.mobileIcon} />
          Follower Requests
          {followerRequestCount > 0 && (
            <span className={styles.badge} aria-label={`${followerRequestCount} pending`}>
              {followerRequestCount}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => { closeMobile(); openDestinationWizard(); }}
        className={`${styles.mobileNavLink} ${styles.mobileButton}`}
        aria-label={lang.current.aria.createNewDestination}
      >
        <FaMapMarkerAlt className={styles.mobileIcon} />
        New Destination
      </button>
      <button
        type="button"
        onClick={() => { closeMobile(); openExperienceWizard(); }}
        className={`${styles.mobileNavLink} ${styles.mobileButton}`}
        aria-label={lang.current.aria.createNewExperience}
      >
        <FaStar className={styles.mobileIcon} />
        New Experience
      </button>
      {isSuper() && (
        <>
          <Box h="1px" bg="border" mx="4" my="2" />
          <Box px="4" py="1">
            <Flex align="center" gap="2" className={styles.mobileGroupLabel}>
              <FaCog className={styles.mobileIcon} />
              <span>Admin</span>
            </Flex>
          </Box>
          <NavLink
            to="/admin/users"
            onClick={closeMobile}
            className={styles.mobileNavLink}
            aria-label={lang.current.aria.adminPanelManageUsers}
            style={{ paddingLeft: '2.5rem' }}
          >
            <FaUsers className={styles.mobileIcon} />
            Users
          </NavLink>
          <NavLink
            to="/admin/ai"
            onClick={closeMobile}
            className={styles.mobileNavLink}
            aria-label={lang.current.aria.adminPanelManageAI}
            style={{ paddingLeft: '2.5rem' }}
          >
            <FaRobot className={styles.mobileIcon} />
            AI
          </NavLink>
        </>
      )}

      <Box h="1px" bg="border" mx="4" my="2" />

      <NavLink
        to="/logout"
        onClick={(e) => { closeMobile(); handleLogOut(); }}
        className={`${styles.mobileNavLink} ${styles.logoutLink}`}
        aria-label={lang.current.aria.logOutOfAccount}
      >
        <FaSignOutAlt className={styles.mobileIcon} />
        Logout
      </NavLink>

      {/* Dynamic action buttons */}
      {showActionButtons && actionButtons.length > 0 && (
        <Flex justify="center" px="4" py="2" className="animation-fade-in">
          <ActionButtons buttons={actionButtons} compact={true} />
        </Flex>
      )}
    </Flex>
  );

  /* ── Main render ─────────────────────────────────────────────── */

  return (
    <>
      <Box
        as="nav"
        role="navigation"
        aria-label={lang.current.aria.mainNavigation}
        position="fixed"
        top="0"
        left="0"
        right="0"
        zIndex="sticky"
        bg="bg"
        borderBottom="1px solid"
        borderColor={{ base: 'transparent', lg: 'border' }}
        boxShadow="0 2px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)"
        minH="68px"
        h="68px"
        transition="box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)"
        css={{ willChange: 'transform, opacity', contain: 'layout style' }}
      >
        <Flex align="center" h="full" w="full" px="3" mx="auto">
          {/* ─── Brand ─── */}
          <Flex
            align="center"
            gap={{ base: '0', lg: '1' }}
            flexShrink={0}
            css={{
              '@media (max-width: 991.98px)': {
                flex: '1 1 auto',
                justifyContent: 'center',
              },
            }}
          >
            <NavLink
              to="/"
              aria-label={lang.current.aria.biensperienceHome}
              title="Biensperience"
              className={styles.logoLink}
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
            >
              <BiensperienceLogo
                type={logoHovered ? "engine" : "clean"}
                width={36}
                height={36}
                className={styles.logo}
                aria-hidden="true"
              />
            </NavLink>

            <Box
              as="button"
              type="button"
              onClick={handleBrandClick}
              aria-label={isShowingH1 ? lang.current.aria.scrollToTop : lang.current.aria.biensperienceHome}
              className={styles.brandButton}
            >
              <Box as="span" display={{ base: 'none', lg: 'inline' }}>{getBrandText()}</Box>
              <Box as="span" display={{ base: 'inline', lg: 'none' }}>Biensperience</Box>
            </Box>
          </Flex>

          {/* ─── Desktop nav ─── */}
          <Flex
            display={{ base: 'none', lg: 'flex' }}
            align="center"
            flex="1"
          >
            {renderDesktopNavLinks()}

            {/* Search */}
            <Box className={styles.desktopSearch}>
              <SearchBar
                placeholder={lang.current.placeholder.search}
                onResultSelect={() => {}}
              />
            </Box>

            {/* Action buttons */}
            {showActionButtons && actionButtons.length > 0 && (
              <Flex align="center" gap="2" flexShrink={0} ml="2" className="animation-fade-in">
                <ActionButtons buttons={actionButtons} compact={true} />
              </Flex>
            )}
          </Flex>

          {/* ─── Mobile hamburger ─── */}
          <Box
            as="button"
            type="button"
            display={{ base: 'flex', lg: 'none' }}
            alignItems="center"
            justifyContent="center"
            position="absolute"
            right="3"
            top="50%"
            css={{
              transform: 'translateY(-50%)',
              '&:focus': { boxShadow: '0 0 0 0.2rem rgba(102,126,234,0.5)' },
              '&:active': { background: 'var(--color-bg-hover)' },
              '&:hover, &:active': { transform: 'translateY(-50%) !important' },
            }}
            zIndex="20"
            border="1px solid"
            borderColor="border"
            borderRadius="md"
            bg="transparent"
            p="2"
            minW="var(--btn-height-md)"
            minH="var(--btn-height-md)"
            cursor="pointer"
            aria-label={lang.current.aria.toggleNavigationMenu}
            aria-expanded={mobileOpen}
            aria-controls={drawerId}
            onClick={() => setMobileOpen(prev => !prev)}
          >
            {mobileOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </Box>
        </Flex>
      </Box>

      {/* ─── Mobile Drawer ─── */}
      <Drawer.Root
        open={mobileOpen}
        onOpenChange={(e) => setMobileOpen(e.open)}
        placement="bottom"
      >
        <Portal>
          <Drawer.Backdrop className={styles.drawerBackdrop} />
          <Drawer.Positioner className={styles.drawerPositioner}>
            <Drawer.Content
              id={drawerId}
              className={styles.drawerContent}
            >
              <Drawer.Body p="0">
                {renderMobileNavContent()}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* ─── Follower Requests Modal ─── */}
      <FollowerRequestsModal
        show={showFollowerRequests}
        onClose={() => setShowFollowerRequests(false)}
        onRequestCountChange={handleRequestCountChange}
      />
    </>
  );
}
