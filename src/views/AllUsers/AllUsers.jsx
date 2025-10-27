import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaUserShield, FaUser, FaEnvelope, FaCalendarAlt, FaSearch, FaSort, FaSortUp, FaSortDown, FaUserPlus } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import PageMeta from "../../components/PageMeta/PageMeta";
import Alert from "../../components/Alert/Alert";
import InviteCodeModal from "../../components/InviteCodeModal/InviteCodeModal";
import { getAllUsers, updateUserRole } from "../../utilities/users-api";
import { handleError } from "../../utilities/error-handler";
import { logger } from "../../utilities/logger";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import { lang } from "../../lang.constants";
import "./AllUsers.css";

export default function AllUsers() {
  const { user } = useUser();
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
    if (sortField !== field) return <FaSort className="ms-1 text-muted" />;
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
        <PageMeta
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
      <PageMeta
        title="All Users - Admin Panel"
        description="Super admin panel for managing all users and their roles."
        keywords="admin panel, user management, super admin, user roles"
      />

      <div className="all-users-container">
        <div className="container-fluid px-4 py-4">
          {/* Header */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="mb-2">
                    <FaUserShield className="me-2 text-success" />
                    {lang.en.admin.userManagement}
                  </h1>
                  <p className="text-muted mb-0">{lang.en.admin.superAdminPanel}</p>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <FaUserPlus className="me-2" />
                    {lang.en.invite.heading}
                  </button>
                  <Link to="/" className="btn btn-outline-secondary">
                    {lang.en.admin.backToHome}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
                    {/* Stats Cards */}
          <div className="row mb-4">
            <div className="col-md-4 mb-3 mb-md-0">
              <div className="stat-card stat-card-primary">
                <div className="stat-card-icon">
                  <FaUser />
                </div>
                                <div className="stat-card-content">
                  <div className="stat-card-value">{stats.total}</div>
                  <div className="stat-card-label">{getUserLabel(stats.total, 'Total User', 'Total Users')}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3 mb-md-0">
              <div className="stat-card stat-card-success">
                <div className="stat-card-icon">
                  <FaUserShield />
                </div>
                                <div className="stat-card-content">
                  <div className="stat-card-value">{stats.superAdmins}</div>
                  <div className="stat-card-label">{getUserLabel(stats.superAdmins, 'Super Admin', 'Super Admins')}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stat-card stat-card-info">
                <div className="stat-card-icon">
                  <FaUser />
                </div>
                <div className="stat-card-content">
                  <div className="stat-card-value">{stats.regularUsers}</div>
                  <div className="stat-card-label">{getUserLabel(stats.regularUsers, 'Regular User', 'Regular Users')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && <Alert type="danger" message={error} dismissible className="mb-4" />}

          {/* Filters and Search */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="search-box">
                    <FaSearch className="search-icon" />
                    <input
                      type="text"
                      className="form-control"
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
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted">Loading users...</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  Users ({filteredUsers.length}{filteredUsers.length !== users.length ? ` of ${users.length}` : ''})
                </h5>
              </div>
              <div className="card-body p-0">
                {filteredUsers.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    <FaUser size={48} className="mb-3 opacity-50" />
                    <p className="mb-0">
                      {searchTerm || roleFilter !== 'all'
                        ? 'No users match your filters'
                        : 'No users found'}
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover users-table mb-0">
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('name')} className="sortable">
                            Name {getSortIcon('name')}
                          </th>
                          <th onClick={() => handleSort('email')} className="sortable">
                            Email {getSortIcon('email')}
                          </th>
                          <th onClick={() => handleSort('role')} className="sortable">
                            Role {getSortIcon('role')}
                          </th>
                          <th onClick={() => handleSort('createdAt')} className="sortable">
                            Joined {getSortIcon('createdAt')}
                          </th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((userData) => {
                          const isCurrentUser = userData._id === user._id;
                          return (
                            <tr key={userData._id} className={isCurrentUser ? 'current-user' : ''}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <Link
                                    to={`/profile/${userData._id}`}
                                    className="user-name-link"
                                  >
                                    {userData.name}
                                  </Link>
                                  {isCurrentUser && (
                                    <span className="badge bg-info ms-2">You</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center text-muted">
                                  <FaEnvelope className="me-2" size={14} />
                                  {userData.email}
                                </div>
                              </td>
                              <td>
                                <span className={`role-badge ${
                                  userData.role === USER_ROLES.SUPER_ADMIN
                                    ? 'role-badge-admin'
                                    : 'role-badge-user'
                                }`}>
                                  {userData.role === USER_ROLES.SUPER_ADMIN ? (
                                    <><FaUserShield className="me-1" /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                  ) : (
                                    <><FaUser className="me-1" /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                  )}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex align-items-center text-muted">
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
                              </td>
                              <td>
                                <div className="d-flex justify-content-end gap-2">
                                  <button
                                    className={`btn btn-sm role-btn ${
                                      userData.role === USER_ROLES.SUPER_ADMIN
                                        ? 'role-btn-active role-btn-admin'
                                        : 'role-btn-inactive'
                                    }`}
                                    onClick={() => handleRoleUpdate(userData._id, USER_ROLES.SUPER_ADMIN)}
                                    disabled={
                                      updatingUser === userData._id ||
                                      userData.role === USER_ROLES.SUPER_ADMIN ||
                                      isCurrentUser
                                    }
                                    title={isCurrentUser ? "You cannot change your own role" : "Make Super Admin"}
                                  >
                                    {updatingUser === userData._id ? (
                                      <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                      <>
                                        <FaUserShield className="me-1" />
                                        <span className="d-none d-md-inline">Super Admin</span>
                                        <span className="d-inline d-md-none">SA</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    className={`btn btn-sm role-btn ${
                                      userData.role === USER_ROLES.REGULAR_USER
                                        ? 'role-btn-active role-btn-user'
                                        : 'role-btn-inactive'
                                    }`}
                                    onClick={() => handleRoleUpdate(userData._id, USER_ROLES.REGULAR_USER)}
                                    disabled={
                                      updatingUser === userData._id ||
                                      userData.role === USER_ROLES.REGULAR_USER ||
                                      isCurrentUser
                                    }
                                    title={isCurrentUser ? "You cannot change your own role" : "Make Regular User"}
                                  >
                                    {updatingUser === userData._id ? (
                                      <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                      <>
                                        <FaUser className="me-1" />
                                        <span className="d-none d-md-inline">Regular User</span>
                                        <span className="d-inline d-md-none">RU</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Code Modal */}
      <InviteCodeModal
        show={showInviteModal}
        onHide={() => setShowInviteModal(false)}
      />
    </>
  );
}
