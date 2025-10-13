# Copilot Instructions

## Platform Purpose
Biensperience is a visual travel experience platform that enables users to plan experiences and share their plans with other users who can plan similar experiences. Users can create detailed travel plans with checklists, photos, and hierarchical plan items, then share these experiences to inspire and guide others in planning their own adventures.

## Architecture & Technology Stack
- **Frontend**: React 18 with React Router, Bootstrap 5, React Icons
- **Backend**: Node.js with Express.js, MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: AWS S3 for image uploads
- **Security**: Helmet, CORS, rate limiting, input sanitization
- **Deployment**: PM2 process manager, DigitalOcean App Platform

## Data Models & Relationships
- **Experience**: Core entity with name, destination, plan_items (hierarchical), photo, user relationships, permissions array
- **Destination**: Travel locations with fuzzy matching for duplicates, permissions array
- **Photo**: Image assets stored in AWS S3 with metadata, caption, and permissions array. Visibility rules: empty permissions (only owner) = public; additional permissions = limited visibility. Contributors can view, collaborators can edit. (S3-hosted only; external URLs should not have s3_key field)
- **Plan**: User-specific instances of experience plans with point-in-time snapshots of plan items. Each plan includes completion status, costs, and collaborative features. Plans are created when users "plan" an experience and deleted when they remove the plan.
- **User**: Authentication and profile management with experience relationships
- **Plan Items**: Hierarchical checklist items with photos, URLs, cost estimates, and planning days

## Permissions Framework
### Overview
The platform implements a comprehensive role-based permissions system enabling collaborative content creation and management. Resources (destinations and experiences) support multiple permission levels with inheritance and circular dependency prevention.

### Permission Roles
- **Owner**: Full control over resource (edit, delete, manage permissions)
- **Collaborator**: Can edit content but cannot manage permissions or delete
- **Contributor**: Can view and create derivative works (fork/clone) but cannot edit original

### Dual Ownership Model (Backwards Compatibility)
Resources maintain **both** ownership fields for backwards compatibility:
1. **`user` field**: Legacy ObjectId reference for fast lookups and existing queries
2. **`permissions` array**: New structured permissions for collaborative features

**IMPORTANT**: When creating new resources, ALWAYS populate both fields:
```javascript
// In create functions
req.body.user = req.user._id;  // Legacy field
req.body.permissions = [{       // New structured permissions
  _id: req.user._id,
  entity: 'user',
  type: 'owner'
}];
```

### Permission Schema Structure
```javascript
permissions: [{
  _id: ObjectId,           // User ID or Resource ID
  entity: String,          // 'user' | 'destination' | 'experience'
  type: String,            // 'owner' | 'collaborator' | 'contributor'
  granted_at: Date,        // When permission was granted
  granted_by: ObjectId     // Who granted the permission
}]
```

### Permission Inheritance
Resources can inherit permissions from related resources (e.g., experience inherits from destination):
- **Maximum depth**: 3 levels to prevent performance issues
- **Circular dependency prevention**: BFS algorithm detects cycles
- **Inheritance rules**: Collaborator and contributor permissions flow down the hierarchy

### Permission Checking
Use the `utilities/permissions.js` module for all permission operations:

**Check if user is owner** (checks both fields):
```javascript
const { isOwner } = require('../utilities/permissions');
if (!isOwner(resource, userId)) {
  throw new APIError('Unauthorized', 403);
}
```

**Check specific permission**:
```javascript
const { hasPermission } = require('../utilities/permissions');
if (!hasPermission(resource, userId, 'collaborator')) {
  throw new APIError('Insufficient permissions', 403);
}
```

**Resolve inherited permissions**:
```javascript
const { resolvePermissions } = require('../utilities/permissions');
const allPermissions = await resolvePermissions(experience, Experience, Destination);
```

### API Endpoints for Permission Management
Each resource type has 4 permission endpoints:
- `POST /api/:resource/:id/permissions/collaborator` - Add collaborator
- `DELETE /api/:resource/:id/permissions/collaborator/:userId` - Remove collaborator
- `POST /api/:resource/:id/permissions/contributor` - Add contributor
- `DELETE /api/:resource/:id/permissions/contributor/:userId` - Remove contributor

### Security Rules
1. **Only owners** can modify permissions
2. **Cannot remove last owner** from a resource
3. **Cannot grant higher permissions** than you have
4. **Circular dependencies** are automatically prevented
5. **Validate all user IDs** before adding permissions

### Automatic Contributor Assignment
Users automatically become contributors when they interact with resources:
- **Destinations**: Favoriting a destination adds contributor permission
- **Experiences**: Planning an experience adds contributor permission
- Removing favorites/plans removes contributor permission (unless they're owner/collaborator)

### Plan Model and Lifecycle
Plans represent user-specific instances of experience plans with point-in-time snapshots:

**Creation (Automatic)**:
- Created when user (including experience owners) clicks "Plan Experience" button
- Backend: `POST /api/plans/experience/:experienceId` with optional `planned_date`
- Frontend: `createPlan(experienceId, plannedDate)` called in `handleAddExperience()`
- User automatically becomes contributor to the experience
- **Note**: Experience owners can now create plans for their own experiences to track personal completion alongside managing the template

**Deletion (Automatic)**:
- Deleted when user clicks "Remove" to unplan experience
- Backend: `DELETE /api/plans/:id`
- Frontend: `deletePlan(planId)` called in `handleExperience()`
- Contributor permission removed (unless user is owner/collaborator)

**Deletion Protection**: Experiences cannot be deleted if other users have created plans for them

**Ownership Transfer**: If deletion blocked, owner can transfer ownership to a user with an active plan instead

**Structure**: Contains snapshot of all plan items from the experience at creation time

**Permissions**: Supports owner and collaborator roles for shared planning

**Collaboration**: Plan owners can add collaborators to work together on their plan

**Collaborator Display**: At the top of the "My Plan" tab, collaborators are shown as "Collaborators: A, B, C, and D" with profile links to their user pages

**Tracking**: Each plan item tracks completion status, actual costs, and planning days

**Isolation**: Changes to original experience plan items don't affect existing user plans

**UI Integration**:
- "My Plan" tab appears in SingleExperience view after user creates plan
- Tab navigation switches between "Experience Plan Items" and "My Plan"
- Tab visible to all users who have created a plan (including experience owners)
- **Dropdown selector**: When user has access to multiple plans (collaborative), dropdown shows:
  - "My Plan" for user's own plan
  - "[Owner Name]'s Plan" for collaborative plans
- **Sync button**: Appears when plan has diverged from experience plan items
  - Detects changes: items added/removed, text/URL/cost/days modified
  - Updates plan with latest experience snapshot while preserving completion status and user costs
  - Shows warning alert with "Sync Plan" button

### ExperienceCard Auto-Fetch (Plan Status Detection)
The ExperienceCard component automatically detects and displays plan status without requiring parent components to pass plan data:

**Three-Tier State System**:
1. **Initialize from userPlans prop** (if passed by parent)
2. **Fetch from API** (when userPlans empty or not passed)
3. **Update immediately** (on user create/delete actions)

**Key Features**:
- Lazy loading: Only fetches plan status when needed
- Immediate feedback: Button state updates instantly on user action
- No parent changes needed: Works automatically across all views
- Memory efficient: Cleanup on unmount prevents leaks
- Resilient: Falls back gracefully on API errors

**Implementation**:
```javascript
// Auto-fetch plan status when userPlans not provided
useEffect(() => {
  if (userPlans.length > 0 || localPlanState !== null) return;
  
  const plans = await getUserPlans();
  const hasPlan = plans.some(plan => 
    plan.experience?._id === experience._id
  );
  setLocalPlanState(hasPlan);
}, [experience._id, userPlans.length, localPlanState]);
```

**Usage in Views**: No action required - ExperienceCard handles everything
- Profile.jsx: Auto-fetches plan status
- Experiences.jsx: Auto-fetches plan status
- AppHome.jsx: Auto-fetches plan status
- ExperiencesByTag.jsx: Auto-fetches plan status
- SingleDestination.jsx: Auto-fetches plan status

**Planned Date Behavior**:
- Plans created from ExperienceCard have `planned_date: null` (no default)
- Users set planned date on SingleExperience view
- Backend does not default to today's date

### Experience Ownership Transfer
When an experience cannot be deleted due to active user plans, owners can transfer ownership:
- **Endpoint**: `PUT /api/experiences/:id/transfer-ownership`
- **Requirements**: New owner must have an active plan for the experience
- **Process**:
  1. Validates new owner has plan for the experience
  2. Updates experience `user` field to new owner
  3. Updates permissions array (removes old owner's owner role, adds new owner's)
  4. Previous owner becomes contributor (retains view access)
- **Security**: Only current owner can transfer ownership
- **Frontend**: `transferOwnership(experienceId, newOwnerId)` in experiences-api.js

### Permission Enforcement at API Level
The PermissionEnforcer is integrated at the API level for consistent entity-level permission checks:
- **Usage**: Use `getEnforcer()` to get singleton instance with model references
- **Methods**: `canView()`, `canEdit()`, `canDelete()`, `canManagePermissions()`
- **Benefits**: Automatic inheritance resolution, consistent error messages, unified permission logic
- **Example**:
```javascript
const enforcer = getEnforcer({ Destination, Experience });
const permCheck = await enforcer.canEdit({
  userId: req.user._id,
  resource: experience
});
if (!permCheck.allowed) {
  return res.status(403).json({ 
    error: 'Not authorized',
    message: permCheck.reason 
  });
}
```

### Photo Visibility Rules
Photos implement permission-based visibility control:
- **Public Photo**: Permissions array contains only the owner
  - Anyone can view the photo
  - Only owner can edit or delete
- **Limited Visibility Photo**: Permissions array contains owner plus other entities/users
  - Only listed users/entities can view
  - Contributors can view only
  - Collaborators can view and edit (but not delete or manage permissions)
  - Owners have full control

**Example**:
```javascript
// Public photo
{ permissions: [{ _id: userId, entity: 'user', type: 'owner' }] }

// Limited visibility
{ permissions: [
  { _id: userId, entity: 'user', type: 'owner' },
  { _id: collaboratorId, entity: 'user', type: 'collaborator' }
]}
```

### Sample Data Integration
When generating sample data (`sampleData.js`):
- ALWAYS include `permissions` array in destination/experience objects
- Match the user in both `user` field and `permissions[0]._id`
- Do NOT add `s3_key` to photos with external URLs (Unsplash, etc.)

### Migration Considerations
- Existing resources with only `user` field will work (backwards compatible)
- `isOwner()` checks both fields, so either method works
- Gradually migrate to using permissions array for new features
- Legacy code using `user` field continues to function

## Security Considerations
- **Input Validation**: Strict validation for all user inputs, ObjectId conversion for database queries
- **Error Handling**: Never expose stack traces in production, use custom APIError class
- **Authentication**: JWT tokens with proper validation, bcrypt for password hashing
- **File Uploads**: Path traversal protection, filename sanitization
- **Rate Limiting**: Express rate limiting to prevent abuse
- **Regex Security**: Avoid vulnerable regex patterns, use escapeRegex utility for user inputs

## Error Handling Patterns
- Use `APIError` class for consistent error responses
- Implement `withErrorHandling` wrapper for async functions
- Provide user-friendly error messages via `getErrorMessage` utility
- Never expose internal error details to clients

## Utility Functions
- **Fuzzy Matching**: Levenshtein distance for duplicate detection with input length limits
- **Deduplication**: String similarity calculations for destination management
- **Error Handling**: Centralized error management with user-friendly messages
- **Send Request**: HTTP request utilities with error handling
- **Date Utils**: Date formatting and manipulation helpers
- **URL Utils**: URL validation and manipulation utilities

## Development Practices
- **JSDoc Documentation**: Comprehensive documentation for all utilities and functions
- **Security First**: Regular security audits and vulnerability fixes
- **Data Enrichment**: Automated scripts for populating missing experience data
- **Sample Data**: Robust sample data generation with permissions framework support
- **Git History**: Detailed commit messages documenting security fixes and feature additions
- **Permissions-Aware**: Always use dual ownership model when creating/modifying resources
- **Backward Compatibility**: Maintain both legacy and new permission structures

## Key Features
- **Experience Planning**: Hierarchical plan items with photos and cost estimates
- **Visual Travel**: Image-rich experience sharing and discovery
- **User Collaboration**: Shared planning and experience inspiration with role-based permissions
- **Destination Management**: Fuzzy matching to prevent duplicate locations
- **Photo Integration**: AWS S3 storage with automatic enrichment
- **Permission Management**: Multi-level access control with owner, collaborator, and contributor roles
- **Permission Inheritance**: Hierarchical permission flow from destinations to experiences