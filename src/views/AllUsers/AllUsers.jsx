import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Box, Flex, SimpleGrid, NativeSelect } from "@chakra-ui/react";
import { FaUserShield, FaUser, FaEnvelope, FaCalendarAlt, FaFilter, FaSort, FaSortUp, FaSortDown, FaUserPlus, FaTimes } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import InviteCodeModal from "../../components/InviteCodeModal/InviteCodeModal";
import Pagination from "../../components/Pagination/Pagination";
import { Button, Card, Pill, Container, Table, TableHead, TableBody, TableRow, TableCell, EmptyState, Alert, SearchInput, Desktop, Mobile } from "../../components/design-system";
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { getAllUsers, updateUserRole } from "../../utilities/users-api";
import { handleError } from "../../utilities/error-handler";
import { logger } from "../../utilities/logger";
import { eventBus } from "../../utilities/event-bus";
import { USER_ROLES, USER_ROLE_DISPLAY_NAMES } from "../../utilities/user-roles";
import { isSuperAdmin } from "../../utilities/permissions";
import { createFilter } from "../../utilities/trie";
import { lang } from "../../lang.constants";
import styles from "./AllUsers.module.css";

function StatCard({ icon, value, label, colorScheme }) {
  const bgMap = { primary: 'var(--color-primary)', success: 'var(--color-success)', info: 'var(--color-info)' };

  return (
    <Flex
      align="center"
      gap={{ base: '3', md: '4' }}
      bg="var(--color-bg-primary)"
      borderRadius="var(--radius-lg)"
      p={{ base: '3', md: '4', lg: '6' }}
      boxShadow="var(--shadow-sm)"
      transition="var(--transition-normal)"
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)' }}
    >
      <Flex
        align="center"
        justify="center"
        flexShrink={0}
        w={{ base: '45px', md: '50px', lg: '60px' }}
        h={{ base: '45px', md: '50px', lg: '60px' }}
        borderRadius="full"
        bg={bgMap[colorScheme]}
        color="white"
        fontSize={{ base: 'var(--font-size-lg)', lg: 'var(--font-size-xl)' }}
      >
        {icon}
      </Flex>
      <Box flex="1">
        <Box
          fontSize={{ base: 'var(--font-size-lg)', md: 'var(--font-size-xl)', lg: 'var(--font-size-2xl)' }}
          fontWeight="700"
          color="var(--color-text-primary)"
          lineHeight="1"
        >
          {value}
        </Box>
        <Box
          fontSize="clamp(0.875rem, 1.25vw, 1rem)"
          color="var(--color-text-muted)"
          mt="1"
        >
          {label}
        </Box>
      </Box>
    </Flex>
  );
}

export default function AllUsers() {
  const { user } = useUser();
  const { experiences, destinations } = useData();
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

  const fetchAllUsers = useCallback(async () => {
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
  }, []);

  const filterAndSortUsers = useCallback(() => {
    let result = [...users];

    // Filter by search term using trie for O(m) performance
    if (searchTerm && userTrieFilter) {
      result = userTrieFilter.filter(searchTerm, { rankResults: true });
    } else if (searchTerm) {
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
    setCurrentPage(1);
  }, [users, searchTerm, roleFilter, sortField, sortDirection, userTrieFilter]);

  // Compute paginated users from filtered results
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  }, [filteredUsers.length]);

  // Memoize role stats to avoid recalculating on every render
  const stats = useMemo(() => {
    const superAdmins = users.filter(u => u.role === USER_ROLES.SUPER_ADMIN).length;
    const regularUsers = users.filter(u => u.role === USER_ROLES.REGULAR_USER).length;
    return { superAdmins, regularUsers, total: users.length };
  }, [users]);

  // Effects
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      setError(lang.current.admin.accessDenied);
      setLoading(false);
      return;
    }

    fetchAllUsers();
  }, [isCurrentUserSuperAdmin, fetchAllUsers]);

  useEffect(() => {
    filterAndSortUsers();
  }, [filterAndSortUsers]);

  // Listen for user events for real-time updates
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) return;

    const handleUserCreated = (event) => {
      const newUser = event.user;
      if (!newUser) return;

      logger.debug('[AllUsers] User created event received', { userId: newUser._id });
      setUsers(prev => {
        if (prev.some(u => u._id === newUser._id)) return prev;
        return [newUser, ...prev];
      });
    };

    const handleUserUpdated = (event) => {
      const updatedUser = event.user;
      if (!updatedUser) return;

      logger.debug('[AllUsers] User updated event received', { userId: updatedUser._id });
      setUsers(prev => {
        const index = prev.findIndex(u => u._id === updatedUser._id);
        if (index === -1) return [updatedUser, ...prev];
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
    if (sortField !== field) return <FaSort style={{ marginLeft: '0.25rem', color: 'var(--color-text-muted)' }} />;
    return sortDirection === 'asc' ?
      <FaSortUp style={{ marginLeft: '0.25rem' }} /> :
      <FaSortDown style={{ marginLeft: '0.25rem' }} />;
  };

  const handleRoleUpdate = async (userId, newRole) => {
    if (userId === user._id) {
      setError(lang.current.admin.cannotChangeOwnRole);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUpdatingUser(userId);
    setError(null);

    try {
      await updateUserRole(userId, { role: newRole });

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
        <Container>
          <Box mt="12">
            <Alert type="danger" message={lang.current.admin.accessDenied} />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageOpenGraph
        title={lang.current.page.allUsers.title}
        description={lang.current.page.allUsers.description}
        keywords="admin panel, user management, super admin, user roles"
      />

      <PageWrapper title={lang.current.admin.userManagement}>
        <Box className="profile-dropdown-view">
          <Container className="view-header">
            <Flex
              justify="space-between"
              align={{ base: 'stretch', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap="3"
              mb="6"
            >
              <Box>
                <h1 style={{ marginBottom: 'var(--space-2)' }}>
                  <FaUserShield style={{ marginRight: '0.5rem', color: 'var(--color-success)', verticalAlign: 'middle' }} />
                  {lang.current.admin.userManagement}
                </h1>
                <Box as="p" color="var(--color-text-muted)" mb="0" fontSize="clamp(0.8125rem, 1.5vw, 0.9375rem)">
                  {lang.current.admin.superAdminPanel}
                </Box>
              </Box>
              <Flex gap="2" align="center" justify={{ base: 'stretch', md: 'flex-end' }} direction={{ base: 'column', sm: 'row' }}>
                <Button
                  variant="primary"
                  onClick={() => setShowInviteModal(true)}
                >
                  <FaUserPlus style={{ marginRight: '0.25rem' }} />
                  {lang.current.invite.heading}
                </Button>
                <Button as={Link} to="/" variant="outline-secondary">
                  {lang.current.admin.backToHome}
                </Button>
              </Flex>
            </Flex>
          </Container>

          {/* Stats Cards */}
          <Container>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mb="6">
              <StatCard
                icon={<FaUser />}
                value={stats.total}
                label={getUserLabel(stats.total, 'Total User', 'Total Users')}
                colorScheme="primary"
              />
              <StatCard
                icon={<FaUserShield />}
                value={stats.superAdmins}
                label={getUserLabel(stats.superAdmins, 'Super Admin', 'Super Admins')}
                colorScheme="success"
              />
              <StatCard
                icon={<FaUser />}
                value={stats.regularUsers}
                label={getUserLabel(stats.regularUsers, 'Regular User', 'Regular Users')}
                colorScheme="info"
              />
            </SimpleGrid>

            {/* Alerts */}
            {error && <Box mb="6"><Alert type="danger" message={error} dismissible /></Box>}

            {/* Users Table */}
            {loading ? (
              <Card>
                <Card.Body p="0">
                  <Table hover striped responsive>
                    <TableHead>
                      <TableRow>
                        <TableCell header>Name</TableCell>
                        <TableCell header>Email</TableCell>
                        <TableCell header>Role</TableCell>
                        <TableCell header>Joined</TableCell>
                        <TableCell header style={{ textAlign: 'end' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
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
                          <TableCell style={{ textAlign: 'end' }}>
                            <Flex gap="2" justify="flex-end" align="center">
                              <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                              <SkeletonLoader variant="rectangle" width="80px" height="32px" />
                            </Flex>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card.Body>
              </Card>
            ) : (
              <Card>
                <Flex
                  align={{ base: 'stretch', md: 'center' }}
                  direction={{ base: 'column', md: 'row' }}
                  gap={{ base: '2', md: '3' }}
                  p="4"
                  bg="var(--color-bg-secondary)"
                  borderBottom="1px solid var(--color-border-light)"
                >
                  <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                    <SearchInput
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClear={() => setSearchTerm('')}
                      placeholder={lang.current.admin.searchPlaceholder}
                      size="sm"
                    />
                  </Box>

                  <Box position="relative" w={{ base: '100%', md: 'auto' }}>
                    <Box
                      as={FaFilter}
                      position="absolute"
                      left="3"
                      top="50%"
                      transform="translateY(-50%)"
                      color="var(--color-text-tertiary)"
                      pointerEvents="none"
                      zIndex="1"
                    />
                    <NativeSelect.Root size="sm" w={{ base: '100%', md: 'auto' }}>
                      <NativeSelect.Field
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        aria-label="Filter by role"
                        pl="calc(var(--space-3) + 20px)"
                        minW="150px"
                        className={styles.filterSelect}
                      >
                        <option value="all">All Roles</option>
                        <option value={USER_ROLES.SUPER_ADMIN}>Super Admins Only</option>
                        <option value={USER_ROLES.REGULAR_USER}>Regular Users Only</option>
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Box>

                  {hasActiveFilters && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleClearFilters}
                      aria-label="Clear all filters"
                    >
                      <FaTimes style={{ marginRight: '0.25rem' }} />
                      Clear
                    </Button>
                  )}
                </Flex>
                <Card.Body p="0">
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
                          <TableCell header onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                            Name {getSortIcon('name')}
                          </TableCell>
                          <TableCell header onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                            Email {getSortIcon('email')}
                          </TableCell>
                          <TableCell header onClick={() => handleSort('role')} style={{ cursor: 'pointer' }}>
                            Role {getSortIcon('role')}
                          </TableCell>
                          <TableCell header onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                            Joined {getSortIcon('createdAt')}
                          </TableCell>
                          <TableCell header style={{ textAlign: 'end' }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedUsers.map((userData) => {
                          const isCurrentUser = userData._id === user._id;
                          return (
                            <TableRow key={userData._id} className={isCurrentUser ? 'highlight' : ''}>
                              <TableCell>
                                <Flex align="center" gap="2">
                                  <Link to={`/profile/${userData._id}`} className={styles.userNameLink}>
                                    {userData.name}
                                  </Link>
                                  {isCurrentUser && (
                                    <Pill variant="info">You</Pill>
                                  )}
                                </Flex>
                              </TableCell>
                              <TableCell>
                                <Flex align="center" gap="2" color="var(--color-text-muted)">
                                  <FaEnvelope size={14} />
                                  {userData.email}
                                </Flex>
                              </TableCell>
                              <TableCell>
                                <Pill variant={userData.role === USER_ROLES.SUPER_ADMIN ? 'success' : 'secondary'}>
                                  {userData.role === USER_ROLES.SUPER_ADMIN ? (
                                    <><FaUserShield style={{ marginRight: '0.25rem' }} /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                  ) : (
                                    <><FaUser style={{ marginRight: '0.25rem' }} /> {USER_ROLE_DISPLAY_NAMES[userData.role]}</>
                                  )}
                                </Pill>
                              </TableCell>
                              <TableCell>
                                <Flex align="center" gap="2" color="var(--color-text-muted)">
                                  <FaCalendarAlt size={14} />
                                  {userData.createdAt
                                    ? new Date(userData.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })
                                    : 'Unknown'
                                  }
                                </Flex>
                              </TableCell>
                              <TableCell>
                                <Flex gap="2" justify="flex-end" align="center">
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
                                        <FaUserShield style={{ marginRight: '0.25rem' }} />
                                        <Desktop>Super Admin</Desktop>
                                        <Mobile>SA</Mobile>
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
                                        <FaUser style={{ marginRight: '0.25rem' }} />
                                        <Desktop>Regular User</Desktop>
                                        <Mobile>RU</Mobile>
                                      </>
                                    )}
                                  </Button>
                                </Flex>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Flex justify="center" align="center" py="4" px="4">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalResults={filteredUsers.length}
                        resultsPerPage={ITEMS_PER_PAGE}
                        variant="numbers"
                      />
                    </Flex>
                  )}
                </Card.Body>
              </Card>
            )}
          </Container>
        </Box>
      </PageWrapper>

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
