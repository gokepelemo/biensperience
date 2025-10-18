# Permission Enforcer Usage Guide

The Permission Enforcer provides a unified API for checking permissions anywhere in the application.

## Basic Setup

```javascript
const { getEnforcer, ACTIONS } = require('../utilities/permission-enforcer');
const Destination = require('../models/destination');
const Experience = require('../models/experience');

// Initialize the enforcer with models
const enforcer = getEnforcer({
  Destination,
  Experience
});
```

## Quick Permission Checks

### Check if User Can Edit
```javascript
const canEdit = await enforcer.canEdit(userId, experience);
if (!canEdit) {
  return res.status(403).json({ error: 'Cannot edit this experience' });
}
```

### Check if User Can Delete
```javascript
const canDelete = await enforcer.canDelete(userId, destination);
if (!canDelete) {
  return res.status(403).json({ error: 'Cannot delete this destination' });
}
```

### Check if User Can View
```javascript
const canView = await enforcer.canView(userId, experience);
if (!canView) {
  return res.status(403).json({ error: 'Cannot view this experience' });
}
```

### Get User's Role
```javascript
const role = await enforcer.getUserRole(userId, resource);
console.log(`User has role: ${role}`); // 'owner', 'collaborator', or 'contributor'
```

## Advanced Usage

### Custom Action Check
```javascript
const result = await enforcer.can({
  userId: req.user._id,
  resource: experience,
  action: ACTIONS.MANAGE_PERMISSIONS,
  context: { req }
});

if (!result.allowed) {
  return res.status(403).json({ 
    error: 'Insufficient permissions',
    reason: result.reason,
    yourRole: result.role 
  });
}
```

### Filter Viewable Resources
```javascript
// Get all experiences user can view
const allExperiences = await Experience.find();
const viewableExperiences = await enforcer.filterViewable(
  req.user._id,
  allExperiences
);
res.json(viewableExperiences);
```

### Enrich Resources with Permission Metadata
```javascript
// Add permission info to each resource for UI
const experiences = await Experience.find();
const enriched = await enforcer.enrichWithPermissions(
  req.user._id,
  experiences
);

// Now each experience has a _permissions object:
// {
//   role: 'owner',
//   canEdit: true,
//   canDelete: true,
//   canManagePermissions: true,
//   isOwner: true
// }

res.json(enriched);
```

## Express Middleware

### Protect Routes with Permissions
```javascript
const { ACTIONS } = require('../utilities/permission-enforcer');

// Require edit permission
router.put(
  '/experiences/:id',
  ensureLoggedIn,
  enforcer.requirePermission(
    ACTIONS.EDIT,
    async (req) => await Experience.findById(req.params.id)
  ),
  updateExperience
);

// Require delete permission
router.delete(
  '/destinations/:id',
  ensureLoggedIn,
  enforcer.requirePermission(
    ACTIONS.DELETE,
    async (req) => await Destination.findById(req.params.id)
  ),
  deleteDestination
);

// Require manage permissions permission
router.post(
  '/experiences/:id/permissions/collaborator',
  ensureLoggedIn,
  enforcer.requirePermission(
    ACTIONS.MANAGE_PERMISSIONS,
    async (req) => await Experience.findById(req.params.id)
  ),
  addCollaborator
);
```

### Access Permission Info in Controller
When using `requirePermission` middleware, the controller can access permission info:

```javascript
async function updateExperience(req, res) {
  // req.permissions contains role and resource
  const { role, resource } = req.permissions;
  
  console.log(`User has ${role} role on this experience`);
  
  // Update the resource
  // ...
}
```

## Controller Examples

### GET with Visibility Filtering
```javascript
async function getAllExperiences(req, res) {
  try {
    const experiences = await Experience.find()
      .populate('destination')
      .populate('photo');

    // Filter to only experiences user can view
    const viewable = await enforcer.filterViewable(
      req.user?._id, // Handle anonymous users
      experiences
    );

    // Optionally enrich with permission metadata
    const enriched = await enforcer.enrichWithPermissions(
      req.user?._id,
      viewable
    );

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching experiences' });
  }
}
```

### UPDATE with Permission Check
```javascript
async function updateDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Check if user can edit
    const canEdit = await enforcer.canEdit(req.user._id, destination);
    if (!canEdit) {
      return res.status(403).json({ error: 'Cannot edit this destination' });
    }

    // Perform update
    Object.assign(destination, req.body);
    await destination.save();

    res.json(destination);
  } catch (error) {
    res.status(500).json({ error: 'Error updating destination' });
  }
}
```

### DELETE with Owner Check
```javascript
async function deleteExperience(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Only owners can delete
    const canDelete = await enforcer.canDelete(req.user._id, experience);
    if (!canDelete) {
      return res.status(403).json({ 
        error: 'Only owners can delete experiences' 
      });
    }

    await experience.deleteOne();
    res.json({ message: 'Experience deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting experience' });
  }
}
```

## Frontend Usage

### Display UI Based on Permissions
When using `enrichWithPermissions`, the frontend can check permission metadata:

```javascript
// In React component
function ExperienceCard({ experience }) {
  const { _permissions } = experience;

  return (
    <div>
      <h3>{experience.name}</h3>
      
      {_permissions?.canEdit && (
        <button onClick={handleEdit}>Edit</button>
      )}
      
      {_permissions?.canDelete && (
        <button onClick={handleDelete}>Delete</button>
      )}
      
      {_permissions?.canManagePermissions && (
        <button onClick={handleManagePermissions}>Share</button>
      )}
      
      {_permissions?.isOwner && (
        <span className="badge">Owner</span>
      )}
    </div>
  );
}
```

## Available Actions

- `ACTIONS.VIEW` - View the resource
- `ACTIONS.EDIT` - Edit the resource
- `ACTIONS.DELETE` - Delete the resource
- `ACTIONS.MANAGE_PERMISSIONS` - Add/remove collaborators and contributors
- `ACTIONS.CONTRIBUTE` - Add posts, comments, etc.

## Role Hierarchy

- **Owner**: Can do everything (view, edit, delete, manage permissions, contribute)
- **Collaborator**: Can view, edit, and contribute
- **Contributor**: Can view and contribute

## Visibility Levels

Resources can have a `visibility` field:
- `VISIBILITY.PUBLIC` - Everyone can view
- `VISIBILITY.AUTHENTICATED` - Any logged-in user can view
- `VISIBILITY.RESTRICTED` - Only users with permissions can view

Default visibility by resource type:
- **Photos**: Public
- **Destinations**: Public
- **Experiences**: Public (but can be restricted)
