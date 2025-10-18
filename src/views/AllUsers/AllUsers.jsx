import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageMeta from "../../components/PageMeta/PageMeta";
import Alert from "../../components/Alert/Alert";
import { getUser } from "../../utilities/users-service";
import { getAllUsers, updateUserRole } from "../../utilities/users-api";
import { handleError } from "../../utilities/error-handler";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import "./AllUsers.css";

export default function AllUsers({ updateData }) {
  const user = getUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [error, setError] = useState(null);

  // Check if current user is super admin
  const isCurrentUserSuperAdmin = user && isSuperAdmin(user);

  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      setError('Access denied. Only super admins can view this page.');
      setLoading(false);
      return;
    }

    fetchAllUsers();
  }, [isCurrentUserSuperAdmin]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId, newRole) => {
    setUpdatingUser(userId);
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
    } catch (error) {
      handleError(error);
    } finally {
      setUpdatingUser(null);
    }
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

  return (
    <>
      <PageMeta
        title="All Users - Admin Panel"
        description="Super admin panel for managing all users and their roles."
        keywords="admin panel, user management, super admin, user roles"
      />

      <div className="container mt-4">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1>All Users</h1>
              <Link to="/" className="btn btn-secondary">
                ← Back to Home
              </Link>
            </div>

            {error && (
              <Alert type="danger" message={error} className="mb-4" />
            )}

            {loading ? (
              <div className="text-center">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">User Management ({users.length} users)</h5>
                </div>
                <div className="card-body p-0">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-muted">
                      No users found
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((userData) => (
                            <tr key={userData._id}>
                              <td>
                                <Link
                                  to={`/profile/${userData._id}`}
                                  className="text-decoration-none"
                                >
                                  {userData.name}
                                </Link>
                              </td>
                              <td>{userData.email}</td>
                              <td>
                                <span className={`badge ${
                                  userData.role === USER_ROLES.SUPER_ADMIN
                                    ? 'bg-success'
                                    : 'bg-secondary'
                                }`}>
                                  {USER_ROLE_DISPLAY_NAMES[userData.role] || 'Unknown'}
                                </span>
                              </td>
                              <td>
                                {userData.createdAt
                                  ? new Date(userData.createdAt).toLocaleDateString()
                                  : 'Unknown'
                                }
                              </td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className={`btn ${
                                      userData.role === USER_ROLES.SUPER_ADMIN
                                        ? 'btn-success'
                                        : 'btn-outline-success'
                                    }`}
                                    onClick={() => handleRoleUpdate(userData._id, USER_ROLES.SUPER_ADMIN)}
                                    disabled={updatingUser === userData._id || userData.role === USER_ROLES.SUPER_ADMIN}
                                    title="Make Super Admin"
                                  >
                                    {updatingUser === userData._id ? '...' : 'SA'}
                                  </button>
                                  <button
                                    className={`btn ${
                                      userData.role === USER_ROLES.REGULAR_USER
                                        ? 'btn-secondary'
                                        : 'btn-outline-secondary'
                                    }`}
                                    onClick={() => handleRoleUpdate(userData._id, USER_ROLES.REGULAR_USER)}
                                    disabled={updatingUser === userData._id || userData.role === USER_ROLES.REGULAR_USER}
                                    title="Make Regular User"
                                  >
                                    {updatingUser === userData._id ? '...' : 'RU'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}