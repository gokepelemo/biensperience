# User Permissions and Content Privacy Framework

**Version**: 1.0.0  
**Date**: October 12, 2025  
**Status**: Implemented ✅

---

## Overview

The Biensperience platform now includes a comprehensive permissions and content privacy framework that enables fine-grained access control for experiences and destinations. This system supports role-based permissions with inheritance, allowing owners to delegate editing capabilities to collaborators while maintaining control over their content.

---

## Key Features

### ✅ Role-Based Access Control
- **Owner**: Full control (creator of the resource)
- **Collaborator**: Can edit and modify plan item states
- **Contributor**: Can add posts (reserved for future functionality)

### ✅ Backwards Compatibility
- Legacy `user` attribute (creator) is automatically treated as owner
- `isOwner()` function checks both legacy `user` field and owner role in permissions array
- Existing resources without permissions arrays continue to work seamlessly
- Permission resolution prioritizes legacy owner first, then processes permissions array

### ✅ Permission Inheritance
- Permissions can reference other destinations or experiences
- Inherits all user permissions from referenced resources
- Maximum inheritance depth of 3 levels
- Automatic circular dependency detection and prevention

### ✅ Security Features
- Owner-only permission management
- Validation of all permission changes
- Prevention of circular dependencies
- ObjectId validation for all entities
- Duplicate permission detection

---

## Architecture

### Data Models

#### Permission Schema
```javascript
{
  _id: ObjectId,              // ID of the entity (user, destination, or experience)
  entity: String,             // "user", "destination", or "experience"
  type: String                // "owner", "collaborator", or "contributor" (required for user entities)
}
```

#### Example Permission Arrays

**User Permissions:**
```javascript
permissions: [
  {
    _id: "60d5ec49f1b2c8b1f8e4e1a1",
    entity: "user",
    type: "collaborator"
  },
  {
    _id: "60d5ec49f1b2c8b1f8e4e1a2",
    entity: "user",
    type: "contributor"
  }
]
```

**Inherited Permissions:**
```javascript
permissions: [
  {
    _id: "60d5ec49f1b2c8b1f8e4e1a3",
    entity: "destination"  // Inherits all users from this destination
  },
  {
    _id: "60d5ec49f1b2c8b1f8e4e1a4",
    entity: "experience"   // Inherits all users from this experience
  }
]
```

---

## API Endpoints

### Destinations

#### Add Permission
```
POST /api/destinations/:id/permissions
```

**Request Body:**
```json
{
  "_id": "user_or_resource_id",
  "entity": "user|destination|experience",
  "type": "collaborator|contributor"  // Required for user entities
}
```

**Response (201):**
```json
{
  "message": "Permission added successfully",
  "destination": { /* full destination with permissions */ }
}
```

#### Get Permissions
```
GET /api/destinations/:id/permissions
```

**Response (200):**
```json
{
  "owner": {
    "userId": "60d5ec49f1b2c8b1f8e4e1a1",
    "name": "John Doe",
    "role": "owner"
  },
  "permissions": [
    {
      "userId": "60d5ec49f1b2c8b1f8e4e1a2",
      "role": "collaborator"
    }
  ],
  "directPermissions": [ /* raw permissions array */ ]
}
```

#### Remove Permission
```
DELETE /api/destinations/:id/permissions/:entityId/:entityType
```

**Response (200):**
```json
{
  "message": "Permission removed successfully",
  "removed": { /* removed permission object */ },
  "destination": { /* updated destination */ }
}
```

#### Update Permission Type
```
PATCH /api/destinations/:id/permissions/:userId
```

**Request Body:**
```json
{
  "type": "collaborator|contributor"
}
```

**Response (200):**
```json
{
  "message": "Permission updated successfully",
  "destination": { /* updated destination */ }
}
```

### Experiences

Same API endpoints as destinations, replace `/destinations/` with `/experiences/`:

- `POST /api/experiences/:id/permissions`
- `GET /api/experiences/:id/permissions`
- `DELETE /api/experiences/:id/permissions/:entityId/:entityType`
- `PATCH /api/experiences/:id/permissions/:userId`

---

## Permission Checks

### Update Operations

Both destinations and experiences now check for collaborator permissions:

```javascript
// Owner OR Collaborator can edit
const hasEditPermission = await permissions.canEdit(userId, resource, models);
if (!hasEditPermission) {
  return res.status(401).json({ error: 'Not authorized. You must be the owner or a collaborator.' });
}
```

### Delete Operations

Only owners can delete resources (collaborators cannot):

```javascript
if (userId.toString() !== resource.user._id.toString()) {
  return res.status(401).json({ error: 'Only the owner can delete this resource' });
}
```

### Plan Item Operations

Collaborators can:
- ✅ Create plan items
- ✅ Update plan items
- ✅ Delete plan items
- ✅ Modify plan item states

---

## Permission Inheritance

### How It Works

1. **Direct Permissions**: User permissions explicitly defined in the permissions array
2. **Inherited Permissions**: Permissions inherited from referenced destinations/experiences
3. **Priority**: Higher roles override lower roles (owner > collaborator > contributor)
4. **Depth Limit**: Maximum 3 levels of inheritance to prevent excessive nesting
5. **Circular Protection**: Automatically detects and prevents circular dependencies

### Example Inheritance Chain

```
Experience A
├── permissions: [user_1: collaborator]
├── permissions: [destination_X]
│   
Destination X
├── permissions: [user_2: collaborator]
├── permissions: [experience_Y]
│
Experience Y
├── permissions: [user_3: contributor]
└── (stops at depth 3)

Result: Experience A has:
- user_1: collaborator (direct)
- user_2: collaborator (from destination_X)
- user_3: contributor (from experience_Y via destination_X)
```

### Circular Dependency Prevention

The system prevents these scenarios:
```
Experience A → references → Experience B
Experience B → references → Experience A  ❌ BLOCKED
```

```
Destination A → references → Experience B
Experience B → references → Destination C
Destination C → references → Destination A  ❌ BLOCKED
```

---

## Utility Functions

### Core Functions

Located in `utilities/permissions.js`:

#### `validatePermission(permission)`
Validates a single permission object structure.

#### `validatePermissions(permissions)`
Validates an array of permissions, checking for duplicates.

#### `resolvePermissionsWithInheritance(resource, models, visited, depth)`
Resolves all permissions with inheritance, returns Map of userId → role.

#### `hasRole(userId, resource, requiredRole, models)`
Checks if user has a specific role or higher.

#### `canEdit(userId, resource, models)`
Checks if user can edit (owner or collaborator).

#### `isOwner(userId, resource)`
Checks if user is the resource owner.

#### `addPermission(resource, permission)`
Adds a permission to a resource with validation.

#### `removePermission(resource, entityId, entityType)`
Removes a permission from a resource.

#### `updatePermissionType(resource, userId, newType)`
Updates a user permission's type.

#### `wouldCreateCircularDependency(resource, targetId, targetEntity, models)`
Checks if adding a permission would create a circular dependency.

---

## Usage Examples

### Adding a Collaborator

```javascript
// Add user as collaborator
POST /api/experiences/60d5ec49f1b2c8b1f8e4e1a1/permissions
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a2",
  "entity": "user",
  "type": "collaborator"
}
```

### Inheriting Permissions from Destination

```javascript
// Inherit all users from a destination
POST /api/experiences/60d5ec49f1b2c8b1f8e4e1a1/permissions
{
  "_id": "60d5ec49f1b2c8b1f8e4e1a3",
  "entity": "destination"
}
```

### Checking Permissions in Code

```javascript
const Destination = require('./models/destination');
const Experience = require('./models/experience');
const permissions = require('./utilities/permissions');

// Check if user can edit
const models = { Destination, Experience };
const canUserEdit = await permissions.canEdit(userId, experience, models);

if (canUserEdit) {
  // Allow edit operation
  experience.name = newName;
  await experience.save();
}
```

### Getting All Permissions

```javascript
const allPerms = await permissions.getAllPermissions(experience, models);
// Returns: [{ userId: "xxx", role: "collaborator" }, ...]
```

---

## Error Handling

### Common Error Responses

#### 400 - Bad Request
- Invalid ObjectId format
- Invalid entity type
- Invalid role type
- Duplicate permission
- Missing required fields
- Circular dependency detected

#### 401 - Unauthorized
- User is not owner/collaborator
- User cannot manage permissions (not owner)

#### 404 - Not Found
- Resource not found
- Target user/destination/experience not found
- Permission not found

#### 409 - Conflict
- (Reserved for future use)

---

## Migration Notes

### Database Changes
- Added `permissions` field to Destination model
- Added `permissions` field to Experience model
- Fields have default empty arrays (backward compatible)
- **New resources automatically initialize permissions array with owner**
- Existing resources function normally without permissions

### Backward Compatibility
✅ **Fully backward compatible**

**Dual Ownership Tracking:**
- Resources maintain both `user` field (legacy) and `permissions` array (new)
- New resources automatically get owner in both places
- `isOwner()` checks both `user` field AND owner type in permissions array
- Permission resolution prioritizes explicit owner entries
- Either method can determine ownership (redundant by design)

**Migration Support:**
- Existing resources without permissions work as before
- Only owners (user field) have access by default
- No database migration required
- Graceful handling of missing permissions arrays
- New resources created with full permission structure

**Why Both Fields:**
- **`user` field**: Maintains backwards compatibility with existing code
- **`permissions` array**: Enables future features (delegation, team ownership)
- **Redundancy**: Ensures ownership is always detectable
- **Performance**: Fast ownership checks without array traversal


The permissions framework is designed to work seamlessly with existing data:

#### Legacy Owner Support
- **Legacy `user` attribute**: Resources created before the permissions framework use the `user` field to track the creator
- **`isOwner()` function**: Checks BOTH the legacy `user` field AND the owner role in the permissions array
- **Permission resolution**: Automatically treats the user in the `user` field as owner with highest priority

#### How It Works
```javascript
// Example resource created before permissions framework
{
  _id: "507f1f77bcf86cd799439011",
  name: "Paris Adventure",
  user: "60d5ec49f1b2c8b1f8e4e1a1",  // Legacy creator field
  permissions: []                      // Empty or undefined
}

// isOwner() returns true for user "60d5ec49f1b2c8b1f8e4e1a1"
// canEdit() returns true for user "60d5ec49f1b2c8b1f8e4e1a1"
```

#### Migration Strategy
**No data migration required!**
- Existing resources continue to work without modification
- Owners can add collaborators when they next edit the resource
- `user` field remains as the source of truth for ownership
- New permissions can be added incrementally as needed

#### Owner Identification Logic
```javascript
function isOwner(userId, resource) {
  const userIdStr = userId.toString();
  
  // 1. Check legacy user attribute (backwards compatibility)
  if (resource.user) {
    const ownerId = resource.user._id || resource.user;
    if (userIdStr === ownerId.toString()) {
      return true;  // Legacy owner identified
    }
  }
  
  // 2. Check permissions array for owner role
  if (resource.permissions && Array.isArray(resource.permissions)) {
    const ownerPermission = resource.permissions.find(p => 
      p.entity === 'user' && 
      p.type === 'owner' &&
      p._id.toString() === userIdStr
    );
    
    if (ownerPermission) {
      return true;  // New owner role identified
    }
  }
  
  return false;
}
```

#### Gradual Adoption
1. **Phase 1** (Current): All existing resources work with `user` field
2. **Phase 2** (Optional): Owners can add collaborators to their resources
3. **Phase 3** (Future): Resources can optionally use permissions array for ownership
4. **No Breaking Changes**: The `user` field will remain supported indefinitely

---

## Security Considerations

### Access Control
- ✅ Only owners can manage permissions
- ✅ Collaborators can edit content but not permissions
- ✅ All ObjectIds validated before database queries
- ✅ Entity existence verified before adding permissions
- ✅ Owner cannot be added as a permission (redundant)

### Data Integrity
- ✅ Duplicate permissions prevented at model level
- ✅ Circular dependencies detected and prevented
- ✅ Maximum inheritance depth enforced (3 levels)
- ✅ Invalid entity types rejected
- ✅ Invalid role types rejected

### Performance
- ✅ Efficient permission resolution with caching (visited set)
- ✅ Early termination for circular dependencies
- ✅ Depth-first search with depth limiting
- ✅ Minimal database queries with proper population

---

## Testing Recommendations

### Unit Tests
1. Permission validation (valid/invalid structures)
2. Circular dependency detection (various scenarios)
3. Permission inheritance (1, 2, 3 levels)
4. Role priority resolution (owner > collaborator > contributor)
5. Add/remove/update operations

### Integration Tests
1. End-to-end permission workflows
2. Multi-level inheritance scenarios
3. Collaborator editing capabilities
4. Owner-only permission management
5. Error handling for all edge cases

### Security Tests
1. Non-owner attempting to manage permissions
2. Adding circular dependencies
3. Exceeding maximum depth
4. Invalid ObjectIds
5. Missing required fields

---

## Future Enhancements

### Planned Features
- 📋 **Contributor Role**: Full implementation for adding posts/comments
- 🔔 **Permission Notifications**: Notify users when added as collaborators
- 📊 **Permission Analytics**: Track who edited what and when
- 🔒 **Fine-Grained Permissions**: Per-field or per-action permissions
- 👥 **Team Permissions**: Group-based permissions for organizations
- 📱 **Mobile UI**: Permission management in mobile app

### Possible Improvements
- Permission templates for common scenarios
- Bulk permission operations
- Permission expiration dates
- Audit logs for permission changes
- Permission delegation (collaborators can add contributors)

---

## Troubleshooting

### Common Issues

#### "Cannot add permission: would create circular dependency"
**Cause**: Adding this permission would create an infinite loop.  
**Solution**: Review the permission chain and remove the circular reference.

#### "Only the destination owner can manage permissions"
**Cause**: Non-owner user attempting to manage permissions.  
**Solution**: Only owners can add/remove/update permissions. Collaborators can only edit content.

#### "Permission already exists"
**Cause**: Attempting to add a duplicate permission.  
**Solution**: Check existing permissions first or update the existing permission type.

#### "Target destination not found"
**Cause**: Referenced destination/experience doesn't exist or was deleted.  
**Solution**: Verify the entity ID exists before adding as a permission.

---

## API Reference

### Constants

```javascript
ROLES = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
  CONTRIBUTOR: 'contributor'
}

ENTITY_TYPES = {
  USER: 'user',
  DESTINATION: 'destination',
  EXPERIENCE: 'experience'
}

MAX_INHERITANCE_DEPTH = 3
```

### Permission Object Structure

```typescript
interface Permission {
  _id: ObjectId;           // Entity ID
  entity: 'user' | 'destination' | 'experience';
  type?: 'owner' | 'collaborator' | 'contributor';  // Required for user entities
}
```

---

## Changelog

### Version 1.0.0 (October 12, 2025)
- ✅ Initial implementation
- ✅ Role-based access control (owner, collaborator, contributor)
- ✅ Permission inheritance with circular dependency prevention
- ✅ Maximum depth limit (3 levels)
- ✅ Full API endpoints for destinations and experiences
- ✅ Updated controllers with permission checks
- ✅ Comprehensive validation and error handling
- ✅ Complete documentation

---

## Support

For questions or issues with the permissions framework:

1. Check this documentation
2. Review the code in `utilities/permissions.js`
3. Check controller implementations for usage examples
4. Review test cases for edge case handling

---

**Framework Status**: ✅ Production Ready  
**Test Coverage**: Controllers and utilities implemented  
**Documentation**: Complete  
**Migration Required**: None (backward compatible)
