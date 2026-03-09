import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, Pill } from "../../components/design-system";
import { FaUserShield, FaUser, FaEnvelope, FaCalendarAlt, FaFilter, FaSort, FaSortUp, FaSortDown, FaUserPlus } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import InviteCodeModal from "../../components/InviteCodeModal/InviteCodeModal";
import Pagination from "../../components/Pagination/Pagination";
import { Button, Container, FlexBetween, Table, TableHead, TableBody, TableRow, TableCell, EmptyState, Alert, SearchInput } from "../../components/design-system";
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { getAllUsers, updateUserRole } from "../../utilities/users-api";
import { handleError } from "../../utilities/error-handler";
import { logger } from "../../utilities/logger";
import { eventBus } from "../../utilities/event-bus";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import { createFilter } from "../../utilities/trie";
import { lang } from "../../lang.constants";
import styles from "./AllUsers.module.scss";

export default function AllUsers() {
  const { user } = useUser();
  const { experiences, destinations } = useData();
  const { registerH1, clearActionButtons } = useApp();
  const { success: showSuccess } = useToast();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const hasActiveFilters = searchTerm.trim() || roleFilter !== 'all';

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter('all');
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Check if current user is super admin
  const isCurrentUserSuperAdmin = user && isSuperAdmin(user);

  // Build trie index for fast user search
  const userTrieFilter = useMemo(() => {
    if (!users || users.length === 0) return null;
    return createFilter({
      fields: [
        { path: 'name', score: 100 },
        { path: 'email', score: 80 },
      ]
    }).buildIndex(users);
  }, [users]);

  // Define helper functions
  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      logger.error('Error fetching users', { error: err.message });
      setError(lang.current.admin.failedToLoadUsers);
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = useCallback(() => {
    let result = [...users];

    // Filter by search term using trie for O(m) performance
    if (searchTerm && userTrieFilter) {
      result = userTrieFilter.filter(searchTerm, { rankResults: true });
    } else if (searchTerm) {
      // Fallback to linear search if trie not available
      const term = searchTerm.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }

    // Filter by role
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle date sorting
      if (sortField === 'createdAt') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUsers(result);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [users, searchTerm, roleFilter, sortField, sortDirection, userTrieFilter]);

  // Compute paginated users from filtered results
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  }, [filteredUsers.length]);

  // Effects
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      setError(lang.current.admin.accessDenied);
      setLoading(false);
      return;
    }

    fetchAllUsers();
  }, [isCurrentUserSuperAdmin]);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, roleFilter, sortField, sortDirection, filterAndSortUsers]);

  // Register h1 for navbar integration
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

    return () => clearActionButtons();
  }, [registerH1, clearActionButtons]);

  // Listen for user events for real-time updates
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) return;

    // Handle user created - add new user to the list
    const handleUserCreated = (event) => {
      const newUser = event.user;
      if (!newUser) return;

      logger.debug('[AllUsers] User created event received', { userId: newUser._id });
      setUsers(prev => {
        // Avoid duplicates
        if (prev.some(u => u._id === newUser._id)) return prev;
        return [newUser, ...prev];
      });
    };

    // Handle user updated - update user in the list
    const handleUserUpdated = (event) => {
      const updatedUser = event.user;
      if (!updatedUser) return;

      logger.debug('[AllUsers] User updated event received', { userId: updatedUser._id });
      setUsers(prev => {
        const index = prev.findIndex(u => u._id === updatedUser._id);
        if (index === -1) {
          // User not in list yet - might be a new user, add them
          return [updatedUser, ...prev];
        }
        const updated = [...prev];
        updated[index] = { ...updated[index], ...updatedUser };
        return updated;
      });
    };

    const unsubCreate = eventBus.subscribe('user:created', handleUserCreated);
    const unsubUpdate = eventBus.subscribe('user:updated', handleUserUpdated);

    return () => {
      unsubCreate();
      unsubUpdate();
    };
  }, [isCurrentUserSuperAdmin]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <FaSort className={styles.sortIconMuted} />;
    return sortDirection === 'asc' ?
      <FaSortUp className={styles.sortIcon} /> :
      <FaSortDown className={styles.sortIcon} />;
  };

  const handleRoleUpdate = async (userId, newRole) => {
    // Prevent changing own role
    if (userId === user._id) {
      setError(lang.current.admin.cannotChangeOwnRole);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUpdatingUser(userId);
    setError(null);

    try {
      await updateUserRole(userId, { role: newRole });

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u._id === userId
            ? { ...u, role: newRole, isSuperAdmin: newRole === USER_ROLES.SUPER_ADMIN }
            : u
        )
      );

      const userName = users.find(u => u._id === userId)?.name;
      showSuccess(lang.current.admin.roleUpdated
        .replace('{name}', userName)
        .replace('{role}', USER_ROLE_DISPLAY_NAMES[newRole]));
    } catch (error) {
      setError(lang.current.alert.loginFailed);
      handleError(error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleStats = () => {
    const superAdmins = users.filter(u => u.role === USER_ROLES.SUPER_ADMIN).length;
    const regularUsers = users.filter(u => u.role === USER_ROLES.REGULAR_USER).length;
    return { superAdmins, regularUsers, total: users.length };
  };

  // Helper function for singular/plural labels
  const getUserLabel = (count, singular, plural) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  if (!isCurrentUserSuperAdmin) {
    return (
      <>
        <PageOpenGraph
          title={lang.current.modal.accessDenied}
          description={lang.current.admin.accessDenied}
        />
        <div className={`container ${styles.accessDeniedWrapper}`}>
          <Alert type="danger" message={lang.current.admin.accessDenied} />
        </div>
      </>
    );
  }

  const stats = getRoleStats();

  return (
    <>
      <PageOpenGraph
        title={lang.current.page.allUsers.title}
        description={lang.current.page.allUsers.description}
        keywords="admin panel, user management, super admin, user roles"
      />

      <div className="profile-dropdown-view">
        <Container className="view-header">
          <FlexBetween className={styles.headerRow}>
            <div>
              <h1 className={styles.pageTitle}>
                <FaUserShield className={styles.titleIcon} />
                {lang.current.admin.userManagement}
              </h1>
              <p className="header-description">{lang.current.admin.superAdminPanel}</p>
            </div>
            <div className="header-actions">
              <Button
                variant="primary"
                onClick={() => setShowInviteModal(true)}
                className={styles.inviteButton}
              >
                <FaUserPlus className={styles.iconGapSm} />
                {lang.current.invite.heading}
              </Button>
              <Button as={Link} to="/" variant="outline-secondary">
                {lang.current.admin.backToHome}
              </Button>
            </div>
          </FlexBetween>
        </Container>

        {/* Stats Cards */}
        <Container className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div>
              <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
                <div className={styles.statCardIcon}>
                  <FaUser />
                </div>
                <div className={styles.statCardContent}>
                  <div className={styles.statCardValue}>{stats.total}</div>
                  <div className={styles.statCardLabel}>{getUserLabel(stats.total, 'Total User', 'Total Users')}</div>
                </div>
              </div>
            </div>
            <div>
              <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
                <div className={styles.statCardIcon}>
                  <FaUserShield />
                </div>
                <div className={styles.statCardContent}>
                  <div className={styles.statCardValue}>{stats.superAdmins}</div>
                  <div className={styles.statCardLabel}>{getUserLabel(stats.superAdmins, 'Super Admin', 'Super Admins')}</div>
                </div>
              </div>
            </div>
            <div>
              <div className={`${styles.statCard} ${styles.statCardInfo}`}>
                <div className={styles.statCardIcon}>
                  <FaUser />
                </div>
                <div className={styles.statCardContent}>
                  <div className={styles.statCardValue}>{stats.regularUsers}</div>
                  <div className={styles.statCardLabel}>{getUserLabel(stats.regularUsers, 'Regular User', 'Regular Users')}</div>
                </div>
              </div>
            </div>
          </div>
        </Container>

          {/* Alerts */}
          {error && <Alert type="danger" message={error} dismissible className={styles.alertSpacing} />}

          {/* Users Table */}
          {loading ? (
            <Card>
              <Card.Body className={styles.cardBodyFlush}>
                <Table hover striped responsive>
                  <TableHead>
                    <TableRow>
                      <TableCell header>Name</TableCell>
                      <TableCell header>Email</TableCell>
                      <TableCell header>Role</TableCell>
                      <TableCell header>Joined</TableCell>
                      <TableCell header className={styles.textEnd}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Skeleton table rows */}
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <SkeletonLoader variant="text" width="120px" height="16px" />
                        </TableCell>
                        <TableCell>
                          <SkeletonLoader variant="text" width="180px" height="16px" />
                        </TableCell>
                        <TableCell>
                          <SkeletonLoader variant="text" width="100px" height="20px" />
                        </TableCell>
                        <TableCell>
                          <SkeletonLoader variant="text" width="80px" height="16px" />
                        </TableCell>
                        <TableCell className={styles.textEnd}>
                          <div className={styles.actionsCell}>
                            <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                            <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <div className={styles.searchFilterBar}>
                <SearchInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClear={() => setSearchTerm('')}
                  placeholder={lang.current.admin.searchPlaceholder}
                  size="sm"
                  className={styles.searchInputWrapper}
                />

                <div className={styles.filterWrapper}>
                  <FaFilter className={styles.filterIcon} />
                  <select
                    className={styles.filterSelect}
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    aria-label="Filter by role"
                  >
                    <option value="all">All Roles</option>
                    <option value={USER_ROLES.SUPER_ADMIN}>Super Admins Only</option>
                    <option value={USER_ROLES.REGULAR_USER}>Regular Users Only</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className={styles.clearFiltersButton}
                    onClick={handleClearFilters}
                    aria-label="Clear all filters"
                  >
                    <FaTimes />
                    Clear
                  </button>
                )}
              </div>
              <Card.Body className={styles.cardBodyFlush}>
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    variant="users"
                    title={searchTerm || roleFilter !== 'all' ? lang.current.admin.noUsersMatch : lang.current.admin.noUsersFound}
                    description={searchTerm || roleFilter !== 'all'
                      ? "Try adjusting your search terms or filters to find more users."
                      : "No users have been registered yet."}
                    primaryAction={searchTerm || roleFilter !== 'all' ? "Clear Filters" : null}
                    onPrimaryAction={searchTerm || roleFilter !== 'all' ? handleClearFilters : null}
                    size="md"
                    compact
                  />
                ) : (
                  <Table hover striped responsive>
                    <TableHead>
                      <TableRow>
                        <TableCell header onClick={() => handleSort('name')} className="sortable">
                          Name {getSortIcon('name')}
                        </TableCell>
                        <TableCell header onClick={() => handleSort('email')} className="sortable">
                          Email {getSortIcon('email')}
                        </TableCell>
                        <TableCell header onClick={() => handleSort('role')} className="sortable">
                          Role {getSortIcon('role')}
                        </TableCell>
                        <TableCell header onClick={() => handleSort('createdAt')} className="sortable">
                          Joined {getSortIcon('createdAt')}
                        </TableCell>
                        <TableCell header className={styles.textEnd}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedUsers.map((userData) => {
                        const isCurrentUser = userData._id === user._id;
                        return (
                          <TableRow key={userData._id} className={isCurrentUser ? 'highlight' : ''}>
                            <TableCell>
                              <div className={styles.userNameCell}>
                                <Link
                                  to={`/profile/${userData._id}`}
                                  className={styles.userNameLink}
                                >
                                  {userData.name}
                                </Link>
                                {isCurrentUser && (
                                  <Pill className="badge badge-info">You</Pill>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={styles.mutedInfoCell}>
                                <FaEnvelope size={14} />
                                {userData.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`${styles.roleBadge} ${
                                userData.role === USER_ROLES.SUPER_ADMIN
                                  ? styles.roleBadgeAdmin
                                  : styles.roleBadgeUser
                              }`}>
                                {userData.role === USER_ROLES.SUPER_ADMIN ? (
                                  <><FaUserShield /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                ) : (
                                  <><FaUser /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className={styles.mutedInfoCell}>
                                <FaCalendarAlt size={14} />
                                {userData.createdAt
                                  ? new Date(userData.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })
                                  : 'Unknown'
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={styles.actionsCell}>
                                <Button
                                  variant={userData.role === USER_ROLES.SUPER_ADMIN ? "success" : "outline-success"}
                                  size="sm"
                                  onClick={() => handleRoleUpdate(userData._id, USER_ROLES.SUPER_ADMIN)}
                                  disabled={
                                    updatingUser === userData._id ||
                                    userData.role === USER_ROLES.SUPER_ADMIN ||
                                    isCurrentUser
                                  }
                                  title={isCurrentUser ? lang.current.admin.cannotChangeOwnRole : lang.current.admin.makeSuperAdmin}
                                >
                                  {updatingUser === userData._id ? (
                                    <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                                  ) : (
                                    <>
                                      <FaUserShield className={styles.iconGapSm} />
                                      <span className={styles.desktopOnly}>Super Admin</span>
                                      <span className={styles.mobileOnly}>SA</span>
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant={userData.role === USER_ROLES.REGULAR_USER ? "primary" : "outline-primary"}
                                  size="sm"
                                  onClick={() => handleRoleUpdate(userData._id, USER_ROLES.REGULAR_USER)}
                                  disabled={
                                    updatingUser === userData._id ||
                                    userData.role === USER_ROLES.REGULAR_USER ||
                                    isCurrentUser
                                  }
                                  title={isCurrentUser ? lang.current.admin.cannotChangeOwnRole : lang.current.admin.makeRegularUser}
                                >
                                  {updatingUser === userData._id ? (
                                    <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                                  ) : (
                                    <>
                                      <FaUser className={styles.iconGapSm} />
                                      <span className={styles.desktopOnly}>Regular User</span>
                                      <span className={styles.mobileOnly}>RU</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.paginationWrapper}>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalResults={filteredUsers.length}
                      resultsPerPage={ITEMS_PER_PAGE}
                      variant="numbers"
                    />
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Invite Code Modal */}
        <InviteCodeModal
          show={showInviteModal}
          onHide={() => setShowInviteModal(false)}
          experiences={experiences}
          destinations={destinations}
        />
    </>
  );
}
