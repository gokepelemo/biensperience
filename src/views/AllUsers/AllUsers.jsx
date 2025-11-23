import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Badge, Card } from "react-bootstrap";
import { FaUserShield, FaUser, FaEnvelope, FaCalendarAlt, FaSearch, FaSort, FaSortUp, FaSortDown, FaUserPlus } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import InviteCodeModal from "../../components/InviteCodeModal/InviteCodeModal";
import { Button, Container, FlexBetween, Table, TableHead, TableBody, TableRow, TableCell, FormControl } from "../../components/design-system";
import { getAllUsers, updateUserRole } from "../../utilities/users-api";
import { handleError } from "../../utilities/error-handler";
import { logger } from "../../utilities/logger";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
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

  // Check if current user is super admin
  const isCurrentUserSuperAdmin = user && isSuperAdmin(user);

  // Define helper functions
  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      logger.error('Error fetching users', { error: err.message });
      setError('Failed to load users');
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = useCallback(() => {
    let result = [...users];

    // Filter by search term
    if (searchTerm) {
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
  }, [users, searchTerm, roleFilter, sortField, sortDirection]);

  // Effects
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      setError('Access denied. Only super admins can view this page.');
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <FaSort className="ms-1" style={{ color: 'var(--bs-gray-600)' }} />;
    return sortDirection === 'asc' ?
      <FaSortUp className="ms-1" /> :
      <FaSortDown className="ms-1" />;
  };

  const handleRoleUpdate = async (userId, newRole) => {
    // Prevent changing own role
    if (userId === user._id) {
      setError(lang.en.admin.cannotChangeOwnRole);
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
      showSuccess(lang.en.admin.roleUpdated
        .replace('{name}', userName)
        .replace('{role}', USER_ROLE_DISPLAY_NAMES[newRole]));
    } catch (error) {
      setError(lang.en.alert.loginFailed);
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
          title="Access Denied"
          description="You do not have permission to access this page."
        />
        <div className="container mt-5">
          <Alert type="danger" message="Access denied. Only super admins can view this page." />
        </div>
      </>
    );
  }

  const stats = getRoleStats();

  return (
    <>
      <PageOpenGraph
        title="All Users - Admin Panel"
        description="Super admin panel for managing all users and their roles."
        keywords="admin panel, user management, super admin, user roles"
      />

      <div className="profile-dropdown-view">
        <Container className="view-header">
          <FlexBetween className="mb-4">
            <div>
              <h1 className="mb-2">
                <FaUserShield className="me-2 text-success" />
                {lang.en.admin.userManagement}
              </h1>
              <p className="header-description">{lang.en.admin.superAdminPanel}</p>
            </div>
            <div className="header-actions">
              <Button
                variant="primary"
                onClick={() => setShowInviteModal(true)}
                className="me-2"
              >
                <FaUserPlus className="me-2" />
                {lang.en.invite.heading}
              </Button>
              <Button as={Link} to="/" variant="outline-secondary">
                {lang.en.admin.backToHome}
              </Button>
            </div>
          </FlexBetween>
        </Container>

        {/* Stats Cards */}
        <Container className="mb-4">
          <div className="row mb-4">
            <div className="col-md-4 mb-3 mb-md-0">
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
            <div className="col-md-4 mb-3 mb-md-0">
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
            <div className="col-md-4">
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
          {error && <Alert type="danger" message={error} dismissible className="mb-4" />}

          {/* Filters and Search */}
          <Card className="mb-4">
            <Card.Body>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className={styles.searchBox}>
                    <FaSearch className="search-icon" />
                    <FormControl
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <select
                    className="form-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value={USER_ROLES.SUPER_ADMIN}>Super Admins Only</option>
                    <option value={USER_ROLES.REGULAR_USER}>Regular Users Only</option>
                  </select>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Users Table */}
          {loading ? (
            <Loading
              variant="centered"
              size="lg"
              message="Loading users..."
            />
          ) : (
            <Card>
              <Card.Header>
                <h2>
                  <FaUser className="me-2" />
                  Users ({filteredUsers.length}{filteredUsers.length !== users.length ? ` of ${users.length}` : ''})
                </h2>
              </Card.Header>
              <Card.Body className="p-0">
                {filteredUsers.length === 0 ? (
                  <div className="p-5" style={{ textAlign: 'center', color: 'var(--bs-gray-600)' }}>
                    <FaUser size={48} className="mb-3 opacity-50" />
                    <p className="mb-0">
                      {searchTerm || roleFilter !== 'all'
                        ? 'No users match your filters'
                        : 'No users found'}
                    </p>
                  </div>
                ) : (
                  <Table hover striped responsive>
                    <TableHead>
                      <TableRow>
                        <TableCell onClick={() => handleSort('name')} className="sortable">
                          Name {getSortIcon('name')}
                        </TableCell>
                        <TableCell onClick={() => handleSort('email')} className="sortable">
                          Email {getSortIcon('email')}
                        </TableCell>
                        <TableCell onClick={() => handleSort('role')} className="sortable">
                          Role {getSortIcon('role')}
                        </TableCell>
                        <TableCell onClick={() => handleSort('createdAt')} className="sortable">
                          Joined {getSortIcon('createdAt')}
                        </TableCell>
                        <TableCell className="text-end">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsers.map((userData) => {
                        const isCurrentUser = userData._id === user._id;
                        return (
                          <TableRow key={userData._id} className={isCurrentUser ? 'highlight' : ''}>
                            <TableCell>
                              <div className="d-flex align-items-center gap-2">
                                <Link
                                  to={`/profile/${userData._id}`}
                                  className={styles.userNameLink}
                                >
                                  {userData.name}
                                </Link>
                                {isCurrentUser && (
                                  <Badge className="badge badge-info">You</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="d-flex align-items-center" style={{ color: 'var(--bs-gray-600)' }}>
                                <FaEnvelope className="me-2" size={14} />
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
                                  <><FaUserShield className="me-1" /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                ) : (
                                  <><FaUser className="me-1" /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="d-flex align-items-center" style={{ color: 'var(--bs-gray-600)' }}>
                                <FaCalendarAlt className="me-2" size={14} />
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
                              <div className="d-flex justify-content-end gap-2">
                                <Button
                                  variant={userData.role === USER_ROLES.SUPER_ADMIN ? "success" : "outline-success"}
                                  size="sm"
                                  onClick={() => handleRoleUpdate(userData._id, USER_ROLES.SUPER_ADMIN)}
                                  disabled={
                                    updatingUser === userData._id ||
                                    userData.role === USER_ROLES.SUPER_ADMIN ||
                                    isCurrentUser
                                  }
                                  title={isCurrentUser ? "You cannot change your own role" : "Make Super Admin"}
                                >
                                  {updatingUser === userData._id ? (
                                    <Loading size="sm" showMessage={false} />
                                  ) : (
                                    <>
                                      <FaUserShield className="me-1" />
                                      <span className="d-none d-md-inline">Super Admin</span>
                                      <span className="d-inline d-md-none">SA</span>
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
                                  title={isCurrentUser ? "You cannot change your own role" : "Make Regular User"}
                                >
                                  {updatingUser === userData._id ? (
                                    <Loading size="sm" showMessage={false} />
                                  ) : (
                                    <>
                                      <FaUser className="me-1" />
                                      <span className="d-none d-md-inline">Regular User</span>
                                      <span className="d-inline d-md-none">RU</span>
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
