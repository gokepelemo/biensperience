# AI Agent Guidelines for Biensperience

This document provides guidelines for AI coding agents (like Claude, Cursor, GitHub Copilot, etc.) working on the Biensperience codebase.

For the development log and architectural decisions, see [CLAUDE.md](./CLAUDE.md).

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Code Style & Conventions](#code-style--conventions)
3. [Architecture Patterns](#architecture-patterns)
4. [Component Guidelines](#component-guidelines)
5. [API Development](#api-development)
6. [State Management](#state-management)
7. [Security Best Practices](#security-best-practices)
8. [Testing Requirements](#testing-requirements)
9. [Common Workflows](#common-workflows)
10. [Debugging Tips](#debugging-tips)
11. [Do's and Don'ts](#dos-and-donts)

---

## Integrating with Beads (dependency‑aware task planning)

**🚨 CRITICAL: Use bd for ALL task tracking instead of TodoWrite**

Beads provides persistent, dependency-aware task management through the `bd` CLI tool. TodoWrite tool state is lost between sessions - bd persists forever.

### Why bd > TodoWrite

| Feature | bd | TodoWrite |
|---------|-----|-----------|
| **Persistence** | ✅ Survives restarts | ❌ Lost between sessions |
| **Dependencies** | ✅ Track blockers | ❌ No dependencies |
| **Context Storage** | ✅ Rich notes/decisions | ❌ Simple strings |
| **Git Integration** | ✅ Link commits | ❌ No integration |
| **History** | ✅ Full audit trail | ❌ No history |
| **Search/Filter** | ✅ Tags, status, date | ❌ Linear list |

### Essential bd Commands for Agents

**Every Session Start**:
```bash
bd ready              # What should I work on?
bd status             # What's currently in progress?
bd show <id>          # Read full context for an issue
```

**Creating Tasks**:
```bash
# Simple task
bd new "Fix race condition in permission test"

# With full context (RECOMMENDED)
bd new "Fix permission enforcer race condition test" \
  -m "Test calls resource.save() after enforcer already saved atomically.

File: tests/api/permission-enforcer-security.test.js:559-586
Root cause: Manual save() after atomic findOneAndUpdate
Fix: Remove lines 577-583 and 598-604"

# With dependencies
bd new "Create dashboard UI" --depends-on bd-123

# With tags
bd new "Optimize queries" --tag performance --tag database
```

**Working on Tasks**:
```bash
bd start <id>         # Mark as started
bd edit <id>          # Add notes, context, decisions
bd finish <id>        # Mark complete
bd finish <id> -m "Summary of what was done"
```

**Managing Blockers**:
```bash
bd block <id> "Waiting for user to provide requirements"
bd unblock <id>
```

### Context Storage Pattern

**ALWAYS store implementation context in bd, not in markdown files or TodoWrite**

```bash
# As you implement, capture decisions
bd edit bd-456

# In editor, add:
# Implementation Notes
# -------------------
# Files modified:
# - tests/api/permission-enforcer-security.test.js:559-586
#   Removed manual save() calls after atomic operations
#
# Decision: Use enforcer's atomic findOneAndUpdate instead of
# document.save() to prevent race conditions
#
# Testing: Race condition test now passes (line 559-628)
# Performance: ~310ms per operation (acceptable)
#
# Follow-up: Consider caching for high-volume scenarios

# When done
bd finish bd-456 -m "Race condition test fixed. Removed double-save pattern."

# Link git commit
git commit -m "fix: Remove double-save in race condition test

Test was calling resource.save() after enforcer already saved
atomically with findOneAndUpdate. This caused both concurrent
operations to potentially succeed when they should compete.

Refs: bd-456"
```

### Agent Workflow Integration

**Start of Session**:
```bash
# 1. Check what to work on
bd ready

# 2. If continuing existing work
bd status
bd show bd-123  # Read full context

# 3. If starting new work
bd start bd-123
```

**During Implementation**:
```bash
# Store context immediately (don't wait until done)
bd edit bd-123

# Add to notes:
# - Files being modified
# - Decisions made (why this approach?)
# - Blockers encountered
# - Performance metrics
# - Test results

# Break down complex tasks
bd new "Sub-task 1" --depends-on bd-123
bd new "Sub-task 2" --depends-on bd-123
```

**After Completing Work**:
```bash
# 1. Finish with summary
bd finish bd-123 -m "Permission enforcer security audit complete.
- All 4 controllers verified using enforcer exclusively
- ESLint rules blocking direct mutations
- Activity model logging all changes
- 24/25 security tests passing

Files:
- documentation/PERMISSIONS_SECURITY_VERIFICATION.md (430 lines)
- documentation/PERMISSIONS_SECURITY_SUMMARY.md (quick reference)
- tests/api/permission-enforcer-security.test.js (fixes)

Test results: 188/201 passing (93.5%)"

# 2. Create follow-up tasks
bd new "Fix remaining 13 test failures" --depends-on bd-123 --tag testing

# 3. Link commits
git commit -m "docs: Add permissions security verification

Complete audit of permission-enforcer system with detailed
verification of all security requirements.

Closes: bd-123"

# 4. Update CLAUDE.md if major feature
# (Add entry to "Recent Major Changes" section)
```

### Integration with Documentation

**bd for WIP, .md for Architecture**:

```bash
# While implementing
bd new "Add rate limiting to permission mutations"
bd start bd-789
bd edit bd-789  # Store implementation notes

# After complete
bd finish bd-789 -m "Rate limiting added. 100 req/min per user."

# THEN update CLAUDE.md for posterity
# Add to "Recent Major Changes" section:
### Permission Mutation Rate Limiting (Nov 1, 2025)

**Issue**: bd-789
**Status**: Complete

[Architecture documentation...]
```

**Reference bd issues in CLAUDE.md**:
```markdown
### Permission Security Hardening (Nov 1, 2025)

**Issues**: bd-120, bd-121, bd-122, bd-123
**Status**: Complete

**Problem**: Scattered permission mutations, no audit trail...
```

### Common bd Commands Quick Reference

```bash
# Viewing
bd ready              # Next available tasks
bd status             # Active issues
bd show <id>          # Full issue details
bd list               # All issues
bd list --tag <tag>   # Filter by tag

# Creating
bd new "description"                    # Create issue
bd new "desc" -m "long description"    # With body
bd new "desc" --depends-on <id>        # With dependency
bd new "desc" --tag <tag>              # With tag

# Updating
bd start <id>         # Mark started
bd finish <id>        # Mark finished
bd finish <id> -m "summary"            # With summary
bd block <id> "why"   # Mark blocked
bd unblock <id>       # Unblock
bd edit <id>          # Edit in editor

# Organizing
bd depends <id> <dep_id>               # Add dependency
bd tag <id> <tag>                      # Add tag
bd priority <id> <high|medium|low>     # Set priority

# Help
bd help               # All commands
bd help <command>     # Command help
```

### Migration: TodoWrite → bd

If you have existing TodoWrite todos, convert immediately:

```bash
# Instead of TodoWrite
bd new "Fix permission enforcer race condition test"
bd new "Fix high load pressure test timeout"
bd new "Run full test suite to verify fixes"
bd new "Verify all controllers use PermissionEnforcer"
bd new "Create permissions security verification report"

# Mark first as started
bd start bd-1

# As you complete each
bd finish bd-1 -m "Race condition test fixed"
bd start bd-2
# ... continue ...
```

**NEVER maintain both TodoWrite and bd - choose bd exclusively**

### Example: Complete Feature Flow

```bash
# 1. User requests feature
bd new "Implement permission monitoring dashboard" \
  -m "User requested real-time dashboard for permission changes.

Requirements:
- WebSocket for real-time updates
- Filter by resource/user/action
- Export to CSV
- Admin-only access"

# 2. Break down into sub-tasks
bd new "Create monitoring API endpoints" --depends-on bd-456
bd new "Create WebSocket event system" --depends-on bd-456
bd new "Create dashboard React component" --depends-on bd-457 --depends-on bd-458
bd new "Add admin authorization" --depends-on bd-456

# 3. Work on first ready task
bd ready  # Shows bd-457
bd start bd-457

# 4. Implement and capture context
bd edit bd-457
# Add: Implementation approach, files modified, decisions made

# 5. Complete task
bd finish bd-457 -m "API endpoints created.
Files: controllers/api/monitoring.js, tests/api/monitoring.test.js"

git commit -m "feat: Add permission monitoring endpoints

Refs: bd-457"

# 6. Continue with next tasks
bd ready  # Shows bd-458
bd start bd-458
# ... repeat ...

# 7. Complete parent task
bd finish bd-456 -m "Dashboard complete and tested.
- Real-time WebSocket updates
- CSV export working
- Admin-only access enforced
- 15 tests added"

# 8. Update CLAUDE.md
# (If major feature worth documenting)
```

### Pro Tips

1. **Store context early and often** - Don't wait until done to document decisions
2. **Use rich descriptions** - Include file paths, line numbers, why decisions were made
3. **Link commits** - Always reference bd issues in commit messages (`Refs: bd-123`)
4. **Break down large tasks** - Create sub-issues with dependencies for complex work
5. **Use tags** - Organize with `--tag bug`, `--tag feature`, `--tag performance`, etc.
6. **Block when stuck** - `bd block bd-123 "reason"` makes blockers visible

**Note to Agent:** bd is your persistent memory across sessions. TodoWrite state is lost when you restart - bd state persists forever. Use bd exclusively for all task tracking and context storage.

## Project Overview

**Biensperience** is a travel experience planning application built with the MERN stack (MongoDB, Express, React, Node.js).

### Key Features
- User authentication (JWT + OAuth 2.0)
- Destination and experience management
- Collaborative planning with permissions
- Photo uploads to AWS S3
- Role-based access control (Super Admin, Regular User)
- Social login (Facebook, Google, X/Twitter)

### Tech Stack
- **Frontend**: React 18.2, React Bootstrap 2.9, React Router 6.17
- **Backend**: Express 4.18, Mongoose 7.6, Passport 0.7
- **Database**: MongoDB
- **Storage**: AWS S3
- **Authentication**: JWT + OAuth 2.0
- **Testing**: Jest 27.5, React Testing Library, Supertest 7.1

---

## Super Admin UI Conventions

### Emoji Indicators for Restricted Access

**Convention**: Use emoji indicators instead of verbose text to signify features, fields, or components that are only accessible to super administrators.

**Preferred Emoji**: 🔐 (lock with key)

**Alternative Emojis** (context-dependent):
- 👑 - For super admin roles/permissions (crown = authority)
- ⚙️ - For admin settings/configuration
- 🛡️ - For security-related admin features

### Implementation Guidelines

#### 🚨 CRITICAL: Single Activity Tracker Pattern

**DO NOT create separate activity trackers for different domains**

When implementing activity tracking for new features (auth, payments, notifications, etc.), **ALWAYS extend the existing `utilities/activity-tracker.js`** instead of creating domain-specific trackers.

**Why This Matters:**
- Single source of truth for ALL activity tracking
- Consistent metadata capture across all domains
- Prevents code duplication and maintenance burden
- All activities queryable from one unified location
- Shared utility functions (extractMetadata, extractActor, etc.)

**Pattern to Follow:**
```javascript
// ✅ CORRECT: Add to utilities/activity-tracker.js
async function trackLogin(options) {
  const { user, req, method } = options;

  Activity.create({
    timestamp: new Date(),
    action: 'user_login',
    actor: extractActor(user),  // Reuse existing utility
    resource: { id: user._id, type: 'User', name: user.name },
    metadata: {
      ...extractMetadata(req),  // Reuse existing utility
      loginMethod: method
    },
    status: 'success',
    tags: ['auth', 'login', method]
  }).catch(err => {
    backendLogger.error('Failed to track login', {
      error: err.message,
      userId: user._id
    });
  });
}

// Export with organized groups
module.exports = {
  // Resource tracking
  trackCreate,
  trackUpdate,
  trackDelete,

  // Auth tracking
  trackLogin,
  trackFailedLogin,
  trackOAuthAuth,

  // Utilities (shared)
  extractMetadata,
  extractActor
};
```

**❌ WRONG: Creating separate files**
```javascript
// DON'T create these:
// utilities/auth-activity-tracker.js
// utilities/payment-activity-tracker.js
// utilities/notification-activity-tracker.js
```

**Required Practices:**
1. All tracking functions in ONE file: `utilities/activity-tracker.js`
2. Group related functions with comments (// Auth tracking, // Payment tracking)
3. Reuse existing utilities (extractMetadata, extractActor, generateRollbackToken)
4. All tracking MUST be non-blocking (fire-and-forget with .catch())
5. Consistent Activity schema for all create() calls
6. Follow same error handling pattern

---

#### ✅ DO: Use emojis in form labels with accessibility

```jsx
// GOOD: Concise with tooltip for accessibility
{isSuperAdmin(user) && (
  <Form.Group className="mb-4">
    <Form.Check
      label={
        <>
          Email Confirmed <span className="text-warning" title="Super Admin Only">🔐</span>
        </>
      }
      // ...
    />
  </Form.Group>
)}
```

#### ✅ DO: Maintain consistent FormField styling

```jsx
// GOOD: Consistent with other form fields
<FormField
  name="internalNotes"
  label={<>Internal Notes <span className="text-warning" title="Super Admin Only">🔐</span></>}
  type="textarea"
  value={formData.internalNotes}
  onChange={handleChange}
/>
```

#### ✅ DO: Use consistent color coding

```jsx
// Standard admin features: text-warning (gold/yellow)
<span className="text-warning" title="Super Admin Only">🔐</span>

// Critical/dangerous admin actions: text-danger (red)
<span className="text-danger" title="Dangerous Action - Super Admin Only">🔐</span>
```

#### ❌ DON'T: Use verbose text labels

```jsx
// BAD: Takes up space, breaks visual consistency
<Form.Check
  label="Email Confirmed (Super Admin Only)"
/>

// GOOD: Use emoji instead
<Form.Check
  label={<>Email Confirmed <span className="text-warning" title="Super Admin Only">🔐</span></>}
/>
```

#### ❌ DON'T: Omit accessibility attributes

```jsx
// BAD: No context for screen readers
<span>🔐</span>

// GOOD: Include title for accessibility
<span className="text-warning" title="Super Admin Only">🔐</span>
```

### Where to Apply Super Admin Indicators

1. **Form Fields** - Any field that only super admins can see/modify
2. **Action Buttons** - Buttons for admin-only operations
3. **Section Headers** - Sections containing admin controls
4. **Navigation Items** - Menu items leading to admin areas
5. **Table Columns** - Data columns only visible to admins

### Examples

**Form Field**:
```jsx
<FormField
  name="systemSettings"
  label={<>System Settings <span className="text-warning" title="Super Admin Only">🔐</span></>}
/>
```

**Button**:
```jsx
<button className="btn btn-danger">
  Delete All Data 🔐
</button>
```

**Section Header**:
```jsx
<div className="card-header">
  <h5>Super Admin Permissions 🔐</h5>
</div>
```

---

## Code Style & Conventions


### Logging Convention

**🚨 CRITICAL: NEVER USE console.log, console.warn, OR console.error DIRECTLY IN ANY CODE**

**ALWAYS use the provided logging utility (`logger.js` or `backend-logger.js`) for all backend logging.**

- Do NOT use `console.log`, `console.error`, or similar methods directly in backend code.
- Use appropriate logging levels to reduce verbosity:
  - `ERROR`: Critical errors only
  - `WARN`: Warnings and errors
  - `INFO`: Important application events
  - `DEBUG`: Development debugging info (default)
  - `TRACE`: Detailed trace information (most verbose)
- Example:
  ```javascript
  const logger = require('../../utilities/logger');
  logger.info('User updated successfully');
  logger.debug('Form data saved', { formId, userId: userId ? 'provided' : 'none' });
  logger.error('Failed to update user', error);
  ```
- For frontend debugging, use the `debug` utility (respects DEBUG env var).

### JavaScript/JSX

**Naming Conventions**
```javascript
// Components: PascalCase
export default function ExperienceCard({ experience }) { ... }

// Functions: camelCase
function handleAddExperience() { ... }

// Constants: SCREAMING_SNAKE_CASE
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGULAR_USER: 'regular_user'
};

// Files: kebab-case or PascalCase (components)
// src/utilities/cookie-utils.js
// src/components/ExperienceCard/ExperienceCard.jsx
```

**Import Order**
```javascript
// 1. React and third-party libraries
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Form } from "react-bootstrap";

// 2. Components
import Alert from "../../components/Alert/Alert";
import FormField from "../../components/FormField/FormField";

// 3. Utilities and services
import { getUser } from "../../utilities/users-service";
import { getAllDestinations } from "../../utilities/destinations-api";

// 4. Styles
import "./Destinations.css";
```

**Function Structure**
```javascript
export default function MyComponent({ prop1, prop2, updateData }) {
  // 1. State declarations
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Derived state and computations
  const user = getUser();
  const isOwner = user && data.user === user._id;

  // 3. useEffect hooks
  useEffect(() => {
    fetchData();
  }, []);

  // 4. Event handlers
  async function fetchData() {
    try {
      setLoading(true);
      const result = await getData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // 5. Conditional rendering
  if (loading) return <div>Loading...</div>;
  if (error) return <Alert type="danger" message={error} />;

  // 6. JSX return
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### CSS

**File Structure**
```css
/* Component-specific styles in ComponentName.css */

/* 1. Container/wrapper styles */
.destinations-container {
  padding: 2rem;
}

/* 2. Element styles (alphabetical) */
.destination-card {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.destination-title {
  font-size: 1.5rem;
  color: var(--purple-600);
}

/* 3. State styles (hover, active, disabled) */
.destination-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 4. Responsive styles (mobile-first) */
@media (max-width: 768px) {
  .destinations-container {
    padding: 1rem;
  }
}
```

**Client-Side Data Encryption**

**ALWAYS encrypt data stored on the client side using the Web Crypto API.**

```javascript
// ✅ GOOD: Use crypto-utils for encryption (Web Crypto API)
import { encryptData, decryptData } from '../utilities/crypto-utils';

const encrypted = await encryptData(formData, userId);
localStorage.setItem('form_data', encrypted);

// ❌ BAD: Store sensitive data unencrypted
localStorage.setItem('form_data', JSON.stringify(formData));
```

**Use CSS Variables**
```css
/* Defined in src/styles/theme.css */
--purple-100: #f3e8ff;
--purple-600: #9333ea;
--border-radius-base: 8px;
--transition-standard: 0.3s ease;

/* Usage */
.my-element {
  background: var(--purple-100);
  border-radius: var(--border-radius-base);
  transition: all var(--transition-standard);
}
```

---

## Architecture Patterns

### Frontend Structure

```
src/
├── components/          # Reusable components
│   ├── Alert/
│   │   ├── Alert.jsx
│   │   └── Alert.css
│   ├── FormField/
│   │   └── FormField.jsx
│   └── Modal/
│       ├── Modal.jsx
│       ├── Modal.css
│       └── Modal.md
├── views/               # Page-level components
│   ├── Destinations/
│   │   ├── Destinations.jsx
│   │   └── Destinations.css
│   └── Profile/
│       ├── Profile.jsx
│       └── Profile.css
├── utilities/           # Helper functions and API clients
│   ├── destinations-api.js
│   ├── cookie-utils.js
│   ├── form-persistence.js    # Form data persistence with encryption
│   ├── useFormPersistence.js  # React hook for form persistence
│   └── permissions.js
├── contexts/            # React contexts
│   └── ToastContext.jsx
└── styles/              # Global styles
    ├── theme.css
    └── shared/
        ├── animations.css
        └── typography.css
```

### Backend Structure

```
server/
├── config/              # Configuration files
│   └── passport.js      # Passport OAuth strategies
├── controllers/         # Business logic
│   └── api/
│       ├── destinations.js
│       ├── experiences.js
│       └── plans.js
├── models/              # Mongoose schemas
│   ├── destination.js
│   ├── experience.js
│   ├── plan.js
│   └── user.js
├── routes/              # Express routes
│   └── api/
│       ├── destinations.js
│       ├── auth.js
│       └── users.js
├── utilities/           # Backend helpers
│   ├── permissions.js
│   ├── permission-enforcer.js
│   ├── logger.js
│   └── controller-helpers.js
├── tests/               # Test files
│   └── api/
│       ├── permissions.test.js
│       └── plans.test.js
└── app.js               # Express app setup
```

### Data Flow Pattern

```
User Action
    ↓
React Component
    ↓
API Utility Function (src/utilities/*-api.js)
    ↓
sendRequest (with JWT token)
    ↓
Express Route (routes/api/*.js)
    ↓
Permission Enforcer Middleware
    ↓
Controller (controllers/api/*.js)
    ↓
Mongoose Model
    ↓
MongoDB
    ↓
Response back through chain
    ↓
Component updates state
    ↓
UI re-renders
```

---

## Component Guidelines

### Use Existing Components

**ALWAYS check for existing components before creating new ones.**

**ALWAYS perform a full stack trace to ensure existing abstracted utilities or components can't be used before creating new ones.**

**FAVOR REFACTORING over band-aid approaches or new components/utilities.**

```javascript
// ✅ GOOD: Use existing Alert component
import Alert from "../../components/Alert/Alert";

function MyComponent() {
  return <Alert type="success" message="Operation successful!" />;
}

// ❌ BAD: Creating manual Bootstrap alert markup
function MyComponent() {
  return (
    <div className="alert alert-success" role="alert">
      Operation successful!
    </div>
  );
}
```

### Reusable Component Checklist

When creating a new reusable component:

1. **Props API**: Clear, documented props with PropTypes or JSDoc
2. **Defaults**: Sensible default values
3. **Flexibility**: Support common variations (size, type, etc.)
4. **Accessibility**: ARIA labels, keyboard navigation, focus management
5. **Responsive**: Mobile-first design
6. **Documentation**: Usage examples in comments or `.md` file

**Example: FormField Component**
```javascript
/**
 * Unified Bootstrap form field component
 *
 * @param {string} name - Field name/id
 * @param {string} label - Field label text
 * @param {string} type - Input type (text, email, password, etc.)
 * @param {string} value - Field value
 * @param {function} onChange - Change handler
 * @param {string} [placeholder] - Placeholder text
 * @param {boolean} [required] - Whether field is required
 * @param {string} [tooltip] - Tooltip content
 * @param {string} [helpText] - Help text below field
 * @param {boolean} [isValid] - Validation state
 * @param {string} [validFeedback] - Valid state message
 * @param {string} [invalidFeedback] - Invalid state message
 */
export default function FormField({
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  tooltip,
  helpText,
  isValid,
  isInvalid,
  validFeedback,
  invalidFeedback,
  prepend,
  append,
  ...props
}) {
  // Component implementation
}
```

### Bootstrap Integration

**Use React Bootstrap components when possible**
```javascript
import { Button, Form, Modal, Alert } from "react-bootstrap";

// ✅ GOOD: React Bootstrap
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

// ❌ BAD: Manual Bootstrap classes (unless necessary)
<button className="btn btn-primary" onClick={handleClick}>
  Click Me
</button>
```

### Loading States and Placeholders

**Always reserve space during loading to prevent jarring transitions**

```javascript
// ✅ GOOD: UsersListDisplay with loading placeholders
<UsersListDisplay
  owner={planOwner}
  users={planCollaborators}
  loading={planOwnerLoading || planCollaboratorsLoading}
  messageKey="PlanningExperience"
/>

// ❌ BAD: No loading state, causes layout shifts
{!loading && (
  <UsersListDisplay
    owner={planOwner}
    users={planCollaborators}
    messageKey="PlanningExperience"
  />
)}
```

**Key Loading State Patterns**:
1. **Reserve Space**: Use `loading` prop to show placeholders that match final content size
2. **Multiple Placeholders**: Show expected number of items during loading (e.g., all collaborator avatars)
3. **Consistent Styling**: Loading placeholders should match final component appearance
4. **Smooth Transitions**: Use subtle animations (pulse, fade) to indicate loading state

**Example: UsersListDisplay Loading Enhancement**
```javascript
// Shows multiple blank avatar placeholders during loading
// Prevents layout shifts when collaborator data loads
// Uses pulse animation for visual feedback
<UsersListDisplay
  loading={true}  // Shows blank avatars for expected count
  owner={owner}
  users={users}   // Count used to determine placeholder count
/>
```

---

## API Development

### Controller Pattern

**Use standardized controller helpers for consistency**

```javascript
// controllers/api/experiences.js
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const { enforcePermission } = require('../../utilities/permission-enforcer');

// List experiences (public)
async function index(req, res) {
  try {
    const experiences = await Experience.find({ public: true })
      .populate('destination', 'name slug')
      .sort({ createdAt: -1 });

    return successResponse(res, experiences);
  } catch (error) {
    return errorResponse(res, error, 'Error fetching experiences');
  }
}

// Update experience (requires permission)
async function update(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check permissions
    const canEdit = await enforcePermission(
      req.user,
      experience,
      'collaborator'
    );

    if (!canEdit) {
      return errorResponse(res, null, 'Insufficient permissions', 403);
    }

    // Update logic
    Object.assign(experience, req.body);
    await experience.save();

    return successResponse(res, experience, 'Experience updated successfully');
  } catch (error) {
    return errorResponse(res, error, 'Error updating experience');
  }
}

module.exports = { index, update };
```

### Permission Enforcement

**Always check permissions on protected routes**

```javascript
const { enforcePermission, isOwner, hasRole } = require('../../utilities/permissions');

// Check if user is owner
if (!isOwner(req.user, resource)) {
  return errorResponse(res, null, 'Only the owner can perform this action', 403);
}

// Check if user has at least collaborator permission
const hasPermission = await enforcePermission(req.user, resource, 'collaborator');
if (!hasPermission) {
  return errorResponse(res, null, 'Insufficient permissions', 403);
}

// Check if user has role level
const canManageUsers = hasRole(req.user, 'owner', resource);
```

### API Response Format

**Use consistent response format**

```javascript
// Success response
{
  success: true,
  data: { ... },
  message: "Operation successful" // optional
}

// Error response
{
  success: false,
  error: "Error message",
  details: { ... } // optional, for validation errors
}
```

---

## State Management

### Component State

**Use local state for component-specific data**

```javascript
function ExperienceCard({ experience, updateData }) {
  const [isAdded, setIsAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Optimistic UI update pattern
  async function handleAddExperience() {
    // 1. Store previous state
    const previousState = isAdded;

    // 2. Optimistic update
    setIsAdded(true);
    setLoading(true);

    try {
      // 3. API call
      await addExperience(experience._id);

      // 4. Refresh parent data
      if (updateData) {
        await updateData();
      }
    } catch (error) {
      // 5. Revert on error
      setIsAdded(previousState);
      console.error('Error adding experience:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleAddExperience} disabled={loading}>
      {isAdded ? 'Remove' : 'Add'}
    </Button>
  );
}
```

### Context Usage

**Use contexts sparingly for truly global state**

Current contexts:
- `ToastContext` - Toast notifications

```javascript
import { useToast } from "../../contexts/ToastContext";

function MyComponent() {
  const { success, error, warning } = useToast();

  async function handleSave() {
    try {
      await saveData();
      success('Data saved successfully!');
    } catch (err) {
      error('Failed to save data');
    }
  }

  return <Button onClick={handleSave}>Save</Button>;
}
```

### Parent-Child Data Sync

**Pass updateData callback for parent data refresh**

```javascript
// Parent component
function Experiences() {
  const [experiences, setExperiences] = useState([]);

  async function fetchExperiences() {
    const data = await getAllExperiences();
    setExperiences(data);
  }

  useEffect(() => {
    fetchExperiences();
  }, []);

  return (
    <div>
      {experiences.map(exp => (
        <ExperienceCard
          key={exp._id}
          experience={exp}
          updateData={fetchExperiences} // Pass refresh function
        />
      ))}
    </div>
  );
}
```

---

## Email Verification Middleware

### Overview

The application implements email verification requirements for content creation to prevent spam and ensure valid user contacts.

### Middleware Implementation

**File**: `utilities/email-verification-middleware.js`

The middleware checks if users have verified their email before allowing them to create or update content.

```javascript
const { requireEmailVerification } = require('../../utilities/email-verification-middleware');

// Apply to protected routes
router.post('/experiences', ensureLoggedIn, requireEmailVerification, modificationLimiter, create);
router.put('/experiences/:id', ensureLoggedIn, requireEmailVerification, modificationLimiter, update);
```

### Protected Routes

Email verification is required for:
- POST `/api/experiences` - Create experience
- PUT `/api/experiences/:id` - Update experience
- POST `/api/destinations` - Create destination
- PUT `/api/destinations/:id` - Update destination

### Exempt Users

The following users bypass email verification:
1. **OAuth Users** - Automatically verified (Facebook, Google, X/Twitter)
2. **Super Admins** - Full system access
3. **Read Operations** - Viewing content doesn't require verification

### Error Response

When email verification fails, the API returns:

```json
{
  "error": "Email verification required. Please check your email for a verification link.",
  "code": "EMAIL_NOT_VERIFIED",
  "details": {
    "userEmail": "user@example.com",
    "message": "You must verify your email address before creating or updating content."
  }
}
```

**HTTP Status**: 403 Forbidden

### Frontend Handling

Components should handle the `EMAIL_NOT_VERIFIED` error code:

```javascript
try {
  await createExperience(newExperience);
  success('Experience created!');
  navigate(`/experiences/${experience._id}`);
} catch (err) {
  const errorMsg = handleError(err, { context: 'Create experience' });

  // Check for email verification error
  if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
    setError(err.response.data.error || lang.en.alert.emailNotVerifiedMessage);
  } else {
    setError(errorMsg);
  }
}
```

**Display**: Show Alert component with descriptive message and keep form editable for retry.

### User Model Fields

Email verification uses these User model fields:

```javascript
{
  emailConfirmed: {
    type: Boolean,
    default: false  // Local accounts require verification
  },
  emailConfirmationToken: {
    type: String,
    sparse: true    // Unique verification token
  },
  emailConfirmationExpires: {
    type: Date      // 24-hour expiration
  }
}
```

### When to Use

Apply `requireEmailVerification` middleware to routes that:
1. Create new content (experiences, destinations)
2. Update existing content
3. Need to ensure valid user email addresses

**Don't apply** to routes that:
1. Read/view content
2. User authentication (login/signup)
3. Profile updates (users can update profile to fix email)

---

## Security Best Practices

### Permissions Enforcement

Always use the permissions enforcer utility for every value creating action on the frontend and the API.

### Input Sanitization

**ALWAYS sanitize user input**

```javascript
const { sanitizeText, sanitizeHtml } = require('../../utilities/sanitize');

// Backend: Sanitize before saving
const destination = new Destination({
  name: sanitizeText(req.body.name),
  description: sanitizeHtml(req.body.description),
  city: sanitizeText(req.body.city)
});

// Frontend: Use sanitizeText for plain text
import { sanitizeText } from "../../utilities/sanitize";

function handleSubmit(e) {
  e.preventDefault();
  const sanitizedName = sanitizeText(formData.name);
  // Use sanitizedName
}
```

### Authentication Checks

**Verify user authentication on protected routes**

```javascript
// Backend middleware
function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Usage
router.put('/destinations/:id', ensureLoggedIn, update);
```

**Frontend route protection**

```javascript
// src/views/App/App.jsx
<Route path="/profile" element={
  user ? <Profile user={user} setUser={setUser} /> : <Navigate to="/login" />
} />
```

### XSS Prevention

**Never use dangerouslySetInnerHTML without sanitization**

```javascript
import DOMPurify from 'dompurify';

// ✅ GOOD: Sanitize HTML before rendering
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userContent)
}} />

// ❌ BAD: Direct HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ BEST: Use text content when possible (React auto-escapes)
<div>{userContent}</div>
```

### CSRF Protection

**CSRF token included in all state-changing requests**

```javascript
// Frontend: sendRequest utility handles CSRF automatically
// src/utilities/send-request.js
export default async function sendRequest(url, method = 'GET', payload = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };

  if (payload) {
    options.body = JSON.stringify(payload);
  }

  // CSRF token handled by backend middleware
  const res = await fetch(url, options);
  // ...
}
```

### Permission Checks

**Check permissions at BOTH frontend and backend**

```javascript
// Frontend: Hide/disable UI for unauthorized actions
import { isSuperAdmin, isOwner } from "../../utilities/permissions";

function ExperienceActions({ experience, user }) {
  const canEdit = isOwner(user, experience);
  const canManagePermissions = isSuperAdmin(user);

  return (
    <>
      {canEdit && <Button onClick={handleEdit}>Edit</Button>}
      {canManagePermissions && <Button onClick={handlePermissions}>Manage Permissions</Button>}
    </>
  );
}

// Backend: ALWAYS enforce permissions
const { enforcePermission } = require('../../utilities/permission-enforcer');

async function update(req, res) {
  const experience = await Experience.findById(req.params.id);

  const canEdit = await enforcePermission(req.user, experience, 'collaborator');
  if (!canEdit) {
    return errorResponse(res, null, 'Insufficient permissions', 403);
  }

  // Proceed with update
}
```

---

## Testing Requirements

### Frontend Tests (React Testing Library)

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('handles button click', async () => {
    const mockClick = jest.fn();
    render(<MyComponent onClick={mockClick} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Backend API Tests (Jest + Supertest)

```javascript
const request = require('supertest');
const app = require('../../app');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../../models/user');
const Experience = require('../../models/experience');

describe('Experiences API', () => {
  let mongoServer;
  let authToken;
  let userId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test user and get auth token
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    userId = user._id;
    authToken = user.generateToken();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Experience.deleteMany({});
  });

  describe('GET /api/experiences', () => {
    it('returns list of experiences', async () => {
      const response = await request(app)
        .get('/api/experiences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/experiences', () => {
    it('creates new experience with valid data', async () => {
      const experienceData = {
        name: 'Test Experience',
        description: 'Test Description',
        type: 'attraction'
      };

      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(experienceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(experienceData.name);
    });

    it('returns 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/experiences')
        .send({ name: 'Test' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
```

### Test Coverage Requirements

- **New Features**: 80%+ coverage required
- **Critical Paths**: 100% coverage (authentication, permissions, payments)
- **Utilities**: 90%+ coverage (helpers, formatters, validators)

**Run tests:**
```bash
# Frontend
npm test

# Backend API
npm run test:api

# Backend with debug logs
npm run test:api:debug

# Coverage report
npm run test:api:coverage
```

---

## Common Workflows

### Adding a New Feature

1. **Create feature branch**
   ```bash
   git checkout -b feat/feature-name
   ```

2. **Update CLAUDE.md** (if major feature)
   - Document architectural decisions
   - Note breaking changes
   - Add migration notes

3. **Write tests first** (TDD approach preferred)
   ```bash
   npm run test:api:watch  # For backend
   npm test -- --watch     # For frontend
   ```

4. **Implement feature**
   - Follow existing patterns
   - Use existing components/utilities
   - Add proper error handling

5. **Test thoroughly**
   - Unit tests
   - Integration tests
   - Manual testing in browser

6. **Create pull request**
   - Clear description
   - List testing steps
   - Reference related issues

### Adding a New Component

1. **Check for existing similar components**
   ```bash
   ls src/components/
   ```

2. **Create component directory**
   ```bash
   mkdir src/components/MyComponent
   touch src/components/MyComponent/MyComponent.jsx
   touch src/components/MyComponent/MyComponent.css
   ```

3. **Use template structure**
   ```javascript
   import { useState } from "react";
   import "./MyComponent.css";

   /**
    * MyComponent description
    *
    * @param {Object} props - Component props
    * @param {string} props.title - Component title
    */
   export default function MyComponent({ title }) {
     const [state, setState] = useState(null);

     return (
       <div className="my-component">
         <h2>{title}</h2>
       </div>
     );
   }
   ```

4. **Add to exports** (if reusable)
   ```javascript
   // src/components/index.js
   export { default as MyComponent } from './MyComponent/MyComponent';
   ```

### Adding a New API Endpoint

1. **Define route**
   ```javascript
   // routes/api/resources.js
   const router = require('express').Router();
   const { index, show, create, update, destroy } = require('../../controllers/api/resources');
   const { ensureLoggedIn } = require('../../config/ensureLoggedIn');

   router.get('/', index);                          // Public
   router.get('/:id', show);                        // Public
   router.post('/', ensureLoggedIn, create);        // Protected
   router.put('/:id', ensureLoggedIn, update);      // Protected
   router.delete('/:id', ensureLoggedIn, destroy);  // Protected

   module.exports = router;
   ```

2. **Create controller**
   ```javascript
   // controllers/api/resources.js
   const Resource = require('../../models/resource');
   const { successResponse, errorResponse } = require('../../utilities/controller-helpers');

   async function index(req, res) {
     try {
       const resources = await Resource.find({});
       return successResponse(res, resources);
     } catch (error) {
       return errorResponse(res, error, 'Error fetching resources');
     }
   }

   module.exports = { index };
   ```

3. **Add frontend API utility**
   ```javascript
   // src/utilities/resources-api.js
   import sendRequest from './send-request';

   const BASE_URL = '/api/resources';

   export async function getAllResources() {
     return await sendRequest(BASE_URL);
   }

   export async function getResource(id) {
     return await sendRequest(`${BASE_URL}/${id}`);
   }

   export async function createResource(data) {
     return await sendRequest(BASE_URL, 'POST', data);
   }
   ```

4. **Write tests**
   ```javascript
   // tests/api/resources.test.js
   describe('Resources API', () => {
     // Test cases
   });
   ```

---

## Debugging Tips

### Frontend Debugging

**Use debug utility**
```javascript
import debug from "../../utilities/debug";

function MyComponent() {
  useEffect(() => {
    debug.log('Component mounted');
    debug.log('Props:', props);
  }, []);

  // Logs only appear when REACT_APP_DEBUG=true
}
```

**React DevTools**
- Install React DevTools browser extension
- Inspect component props and state
- Profile component renders

### Backend Debugging


**Logging Utility Enforcement**

- All backend logging must use the logging utility (`logger.js` or `backend-logger.js`).
- Never use `console.log` or `console.error` directly in backend code.
- Use appropriate logging levels to reduce verbosity:
  - `ERROR`: Critical errors only
  - `WARN`: Warnings and errors  
  - `INFO`: Important application events
  - `DEBUG`: Development debugging info (default)
  - `TRACE`: Detailed trace information (most verbose)
- For frontend, use the `debug` utility for development logs.

**Code Review Checklist:**
- Check that all logging uses the logging utility.
- Reject any direct use of `console.log` or `console.error` in backend code.
- Verify appropriate logging levels are used (avoid TRACE in production code).

**Debug mode**
```bash
# Run with debug logging
npm run test:api:debug

# Or set environment variable
DEBUG=true npm start
```

### MongoDB Queries

**Log queries in development**
```javascript
mongoose.set('debug', true);  // Shows all queries in console
```

**Check query performance**
```javascript
const query = Model.find({ ... });
const explain = await query.explain();
console.log(explain);
```

---

## Do's and Don'ts

### ✅ Do's

1. **Use existing components and utilities**
   - Check `src/components/` before creating new components
   - Check `src/utilities/` for existing helper functions
   - Reuse Bootstrap components via React Bootstrap
   - **ALWAYS perform a full stack trace to ensure existing abstracted utilities or components can't be used before creating new ones**

2. **Favor refactoring over band-aid approaches**
   - Refactor existing code rather than creating new components/utilities when possible
   - Improve existing abstractions instead of duplicating functionality
   - Consolidate similar components rather than maintaining multiple variants

2. **Follow established patterns**
   - Study similar existing code before implementing
   - Use controller helpers for API responses
   - Follow file/folder naming conventions

3. **Write tests**
   - Add tests for new features
   - Update tests when changing functionality
   - Aim for 80%+ coverage

4. **Handle errors gracefully**
   - Use try-catch blocks
   - Show user-friendly error messages
   - Log errors for debugging

5. **Sanitize user input**
   - Always sanitize before saving to database
   - Use DOMPurify for HTML content
   - Validate input on both frontend and backend

6. **Check permissions**
   - Frontend: Hide unauthorized UI elements
   - Backend: Enforce permissions on every protected route

7. **Document complex code**
   - Add JSDoc comments for functions
   - Document non-obvious logic
   - Update CLAUDE.md for major changes

8. **Optimize performance**
   - Use useCallback for event handlers
   - Implement pagination for large lists
   - Use proper MongoDB indexes

### ❌ Don'ts

1. **Don't duplicate code**
   - Extract reusable components
   - Create utility functions for repeated logic
   - Use inheritance/composition

2. **Don't skip error handling**
   - Never assume API calls will succeed
   - Always have try-catch for async operations
   - Provide fallback UI for error states

3. **Don't bypass security**
   - Never skip permission checks
   - Don't trust frontend validation alone
   - Always sanitize user input
   - **Always encrypt client-side data using Web Crypto API**

4. **Don't use console.log in production**
   - Use debug utility (respects DEBUG env var)
   - Use logger for backend (supports levels)
   - Remove debugging console.logs before commit

5. **Don't hardcode values**
   - Use environment variables for config
   - Use constants for repeated values
   - Extract magic numbers to named constants

6. **Don't ignore TypeScript/PropTypes**
   - Add PropTypes for component props
   - Consider TypeScript for new complex features
   - Document expected prop shapes

7. **Don't mix concerns**
   - Keep business logic in controllers
   - Keep API calls in utility functions
   - Keep components focused on UI

8. **Don't commit secrets**
   - Never commit `.env` file
   - Use `.env.example` for documentation
   - Rotate keys if accidentally committed

---

## Quick Reference

### Common Imports

```javascript
// React & Routing
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

// React Bootstrap
import { Button, Form, Modal, Alert } from "react-bootstrap";

// Components
import Alert from "../../components/Alert/Alert";
import FormField from "../../components/FormField/FormField";
import Modal from "../../components/Modal/Modal";

// Utilities
import { getUser } from "../../utilities/users-service";
import sendRequest from "../../utilities/send-request";
import { sanitizeText } from "../../utilities/sanitize";
import { formatCurrency } from "../../utilities/currency-utils";
import { normalizeUrl } from "../../utilities/url-utils";
import { isSuperAdmin, isOwner } from "../../utilities/permissions";

// Backend
const logger = require('../../utilities/logger');
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const { enforcePermission } = require('../../utilities/permission-enforcer');
```

### Common Patterns

```javascript
// Async API call with error handling
async function fetchData() {
  try {
    setLoading(true);
    setError(null);
    const data = await getData();
    setData(data);
  } catch (err) {
    setError(err.message);
    console.error('Error:', err);
  } finally {
    setLoading(false);
  }
}

// Optimistic UI update
async function handleAction() {
  const previousState = state;
  setState(newState);

  try {
    await apiCall();
    if (updateData) await updateData();
  } catch (error) {
    setState(previousState);
    console.error(error);
  }
}

// Permission check
if (!isOwner(user, resource)) {
  return <Alert type="danger" message="Insufficient permissions" />;
}

// Conditional rendering
if (loading) return <div>Loading...</div>;
if (error) return <Alert type="danger" message={error} />;
if (!data) return <Alert type="info" message="No data found" />;
```

---

## Additional Resources

### Documentation
- [CLAUDE.md](./CLAUDE.md) - Development log and architectural decisions
- [documentation/](./documentation/) - Detailed feature documentation
- [style-guide.md](./style-guide.md) - UI/UX style guide

### External References
- [React Documentation](https://react.dev/)
- [React Bootstrap](https://react-bootstrap.github.io/)
- [Express.js](https://expressjs.com/)
- [Mongoose](https://mongoosejs.com/)
- [Jest Testing](https://jestjs.io/)

---

*Last Updated: October 18, 2025*
