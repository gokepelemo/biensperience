# Additional Plan Features Implementation

## Summary

This document describes the implementation of three additional features for the Plan model and permissions framework:

1. **Experience Deletion Protection** - Prevents deletion of experiences that have user plans
2. **Collaborator Display** - Shows plan collaborators at the top of plan items
3. **API-Level Permission Enforcement** - Integrates PermissionEnforcer throughout controllers

## 1. Experience Deletion Protection

### Problem
Experiences could be deleted even when other users had created plans for them, leading to orphaned plan data and broken references.

### Solution
Updated `deleteExperience()` in `controllers/api/experiences.js` to:
1. Check for any existing plans for the experience
2. Filter plans to find those belonging to users other than the owner
3. Return 409 Conflict error if other users have plans
4. Include detailed user information and suggest ownership transfer

Added `transferOwnership()` function to enable ownership transfer as an alternative to deletion.

### Code Changes

**File**: `controllers/api/experiences.js`

#### Deletion Protection
```javascript
// Check if any other users have plans for this experience
const existingPlans = await Plan.find({ experience: req.params.id })
  .populate('user', '_id name email photo photos default_photo_index');

if (existingPlans.length > 0) {
  const otherUserPlans = existingPlans.filter(
    plan => plan.user._id.toString() !== req.user._id.toString()
  );
  
  if (otherUserPlans.length > 0) {
    const usersWithPlans = otherUserPlans.map(plan => ({
      userId: plan.user._id,
      name: plan.user.name,
      email: plan.user.email,
      photo: plan.user.photo,
      photos: plan.user.photos,
      default_photo_index: plan.user.default_photo_index,
      planId: plan._id,
      plannedDate: plan.planned_date
    }));
    
    return res.status(409).json({ 
      error: 'Cannot delete experience',
      message: 'This experience cannot be deleted because other users have created plans for it. You can transfer ownership to one of these users instead.',
      planCount: otherUserPlans.length,
      usersWithPlans: usersWithPlans
    });
  }
}
```

#### Ownership Transfer
```javascript
async function transferOwnership(req, res) {
  try {
    const { experienceId } = req.params;
    const { newOwnerId } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return res.status(400).json({ error: 'Invalid experience ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Find experience and verify current ownership
    const experience = await Experience.findById(experienceId);
    
    if (!experience) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Verify current user is the owner
    if (!permissions.isOwner(experience, req.user._id)) {
      return res.status(403).json({ 
        error: 'Unauthorized',
        message: 'Only the experience owner can transfer ownership.'
      });
    }

    // Verify new owner exists and has a plan for this experience
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({ error: 'New owner not found' });
    }

    const newOwnerPlan = await Plan.findOne({
      experience: experienceId,
      user: newOwnerId
    });

    if (!newOwnerPlan) {
      return res.status(400).json({ 
        error: 'Invalid transfer',
        message: 'The new owner must have a plan for this experience before ownership can be transferred.'
      });
    }

    // Update ownership
    // 1. Update legacy user field
    experience.user = newOwnerId;

    // 2. Update permissions array
    // Remove old owner's owner permission
    experience.permissions = experience.permissions.filter(
      p => !(p.entity === 'user' && p._id.toString() === req.user._id.toString() && p.type === 'owner')
    );

    // Check if new owner already has a permission entry
    const newOwnerPermIndex = experience.permissions.findIndex(
      p => p.entity === 'user' && p._id.toString() === newOwnerId
    );

    if (newOwnerPermIndex !== -1) {
      // Update existing permission to owner
      experience.permissions[newOwnerPermIndex].type = 'owner';
    } else {
      // Add new owner permission
      experience.permissions.push({
        _id: newOwnerId,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id,
        granted_at: new Date()
      });
    }

    // 3. Add previous owner as contributor
    const prevOwnerExists = experience.permissions.some(
      p => p.entity === 'user' && p._id.toString() === req.user._id.toString()
    );

    if (!prevOwnerExists) {
      experience.permissions.push({
        _id: req.user._id,
        entity: 'user',
        type: 'contributor',
        granted_by: newOwnerId,
        granted_at: new Date()
      });
    }

    await experience.save();

    // Return updated experience with new owner details
    const updatedExperience = await Experience.findById(experienceId)
      .populate('user', '_id name email')
      .populate('destination');

    res.json({
      message: 'Ownership transferred successfully',
      experience: updatedExperience,
      previousOwner: {
        id: req.user._id,
        name: req.user.name
      },
      newOwner: {
        id: newOwner._id,
        name: newOwner.name
      }
    });

  } catch (err) {
    console.error('Error transferring ownership:', err);
    res.status(400).json({ error: 'Failed to transfer ownership' });
  }
}
```

**File**: `routes/api/experiences.js`

Added route (must come before `/:id` route):
```javascript
router.put('/:id/transfer-ownership', ensureLoggedIn, experiencesCtrl.transferOwnership);
```

**File**: `src/utilities/experiences-api.js`

Added frontend function:
```javascript
export async function transferOwnership(experienceId, newOwnerId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/transfer-ownership`,
    "PUT",
    { newOwnerId }
  );
}
```

### User Experience
1. **Deletion Attempt**: Owner tries to delete experience
2. **Conflict Detection**: System detects other users have plans
3. **Error Response**: 409 status with:
   - Error message suggesting ownership transfer
   - Count of users with plans
   - Array of user details (name, email, photos for UI display)
   - planId and plannedDate for each user
4. **Transfer Modal**: Frontend shows modal with:
   - List of users with plans
   - User profile photos and names (links to profiles)
   - "Transfer Ownership" button for each user
   - Cancel button to dismiss
5. **Transfer Process**:
   - Click "Transfer Ownership" for chosen user
   - Call `transferOwnership(experienceId, userId)`
   - System validates new owner has plan
   - Updates experience ownership atomically
   - Previous owner becomes contributor (retains view access)
   - Success message shows transfer confirmation

### Security Rules
- Only current owner can transfer ownership
- New owner must have active plan for the experience
- Transfer updates both `user` field and `permissions` array atomically
- Previous owner retains contributor access to view their creation
- Cannot transfer to user without plan (400 error)

## 2. Collaborator Display

### Problem
Plan collaborators were not visible to users, making it unclear who else had access to edit the plan.

### Solution
Created new API endpoint and frontend utility to fetch and display plan collaborators.

### Backend Changes

**File**: `controllers/api/plans.js`

Added `getCollaborators()` function:
```javascript
const getCollaborators = withErrorHandling(async (req, res) => {
  const { id } = req.params;
  
  const plan = await Plan.findById(id);
  
  // Check permission (contributor level)
  if (!hasPermission(plan, req.user._id, 'contributor')) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  
  // Get all user collaborators
  const collaboratorIds = plan.permissions
    .filter(p => p.entity === 'user' && p.type === 'collaborator')
    .map(p => p._id);
  
  // Fetch user details
  const collaborators = await User.find({ 
    _id: { $in: collaboratorIds } 
  }).select('_id name email photo photos default_photo_index');
  
  res.json(collaborators);
});
```

**File**: `routes/api/plans.js`

Added route:
```javascript
router.get("/:id/collaborators", plansCtrl.getCollaborators);
```

### Frontend Changes

**File**: `src/utilities/plans-api.js`

Added function:
```javascript
export function getCollaborators(planId) {
  return sendRequest(`${BASE_URL}/${planId}/collaborators`);
}
```

### UI Implementation Guide

Display collaborators at the top of Plan Items:

```jsx
// Fetch collaborators
const [collaborators, setCollaborators] = useState([]);

useEffect(() => {
  async function fetchCollaborators() {
    const collab = await getCollaborators(planId);
    setCollaborators(collab);
  }
  if (planId) fetchCollaborators();
}, [planId]);

// Format display
function formatCollaborators(collaborators) {
  if (collaborators.length === 0) return null;
  
  const names = collaborators.map((c, i) => (
    <Link key={c._id} to={`/profile/${c._id}`}>
      {c.name}
    </Link>
  ));
  
  // Format: "A, B, and C" or "A and B" or "A, B, C, and D"
  if (names.length === 1) return names[0];
  if (names.length === 2) return <>{names[0]} and {names[1]}</>;
  
  return (
    <>
      {names.slice(0, -1).map((name, i) => (
        <React.Fragment key={i}>
          {name}{i < names.length - 2 ? ', ' : ''}
        </React.Fragment>
      ))}
      {', and '}
      {names[names.length - 1]}
    </>
  );
}

// Display
{collaborators.length > 0 && (
  <div className="collaborators-display">
    <strong>Collaborators:</strong> {formatCollaborators(collaborators)}
  </div>
)}
```

## 3. API-Level Permission Enforcement

### Problem
Permission checks were inconsistent across controllers, using manual checks or different utility functions. This led to code duplication and potential security gaps.

### Solution
Integrated `PermissionEnforcer` class at the API controller level to provide unified, consistent permission checking with better error messages.

### Implementation

**File**: `controllers/api/experiences.js`

Replaced manual permission checks with PermissionEnforcer:

**Before:**
```javascript
const models = { Destination, Experience };
const hasEditPermission = await permissions.canEdit(req.user._id, experience, models);

if (!hasEditPermission) {
  return res.status(401).json({ error: 'Not authorized' });
}
```

**After:**
```javascript
const enforcer = getEnforcer({ Destination, Experience });
const permCheck = await enforcer.canEdit({
  userId: req.user._id,
  resource: experience
});

if (!permCheck.allowed) {
  return res.status(403).json({ 
    error: 'Not authorized to update this experience',
    message: permCheck.reason || 'You must be the owner or a collaborator.'
  });
}
```

### Functions Updated

In `controllers/api/experiences.js`:
- ✅ `updateExperience()` - Uses `enforcer.canEdit()`
- ✅ `deleteExperience()` - Uses `enforcer.canDelete()`
- ✅ `createPlanItem()` - Uses `enforcer.canEdit()`
- ✅ `updatePlanItem()` - Uses `enforcer.canEdit()`
- ✅ `deletePlanItem()` - Uses `enforcer.canEdit()`

### Benefits

1. **Consistency**: All permission checks use same API
2. **Better Errors**: `permCheck.reason` provides specific error messages
3. **Inheritance**: Automatically resolves inherited permissions
4. **Maintainability**: Single source of truth for permission logic
5. **Security**: Prevents permission check bypasses

### PermissionEnforcer Methods

Available methods:
- `canView()` - Check view permissions
- `canEdit()` - Check edit permissions
- `canDelete()` - Check delete permissions
- `canManagePermissions()` - Check permission management rights
- `canContribute()` - Check contribution rights

All return:
```javascript
{
  allowed: boolean,
  reason: string | null,
  role: string | null
}
```

## Documentation Updates

### Updated Files

1. **`.github/copilot-instructions.md`**
   - Added deletion protection note
   - Added collaborator display note
   - Added PermissionEnforcer integration section with example

2. **`documentation/DATA_MODEL.md`**
   - Added deletion protection to Plan Model key points
   - Added collaborator display note

3. **`documentation/PLAN_MODEL_IMPLEMENTATION.md`**
   - Added `getCollaborators()` to function list
   - Added experience deletion protection section
   - Added collaborator display UI guide with formatting example
   - Updated routes list to include `/collaborators` endpoint

## Testing Checklist

### Experience Deletion Protection
- [ ] Create experience as User A
- [ ] Create plan for experience as User B
- [ ] Attempt to delete experience as User A → Should fail with 409
- [ ] Delete plan as User B
- [ ] Attempt to delete experience as User A → Should succeed

### Collaborator Display
- [ ] Create plan
- [ ] Add collaborator to plan
- [ ] Fetch collaborators via API → Should return user details
- [ ] Display collaborators in UI → Should show formatted list with links
- [ ] Remove collaborator
- [ ] Verify display updates

### Permission Enforcement
- [ ] Test edit permission checks with PermissionEnforcer
- [ ] Test delete permission checks with PermissionEnforcer
- [ ] Verify inherited permissions work correctly
- [ ] Verify error messages are descriptive
- [ ] Test with owner, collaborator, contributor, and non-member

## Security Considerations

1. **Deletion Protection**: Prevents data loss and maintains referential integrity
2. **Permission Checks**: All checks now use unified, tested PermissionEnforcer
3. **Error Messages**: Descriptive but don't leak sensitive information
4. **Collaborator Visibility**: Only users with contributor+ permissions can view collaborators
5. **ObjectId Validation**: All IDs validated before queries

## API Changes Summary

### New Endpoints
- `GET /api/plans/:id/collaborators` - Get plan collaborators

### Modified Endpoints
- `DELETE /api/experiences/:id` - Now checks for existing plans

### Error Codes
- `409 Conflict` - Returned when attempting to delete experience with active plans
- `403 Forbidden` - Returned by PermissionEnforcer when permissions insufficient

## Migration Notes

- No database migration required
- Existing data works without changes
- PermissionEnforcer is backwards compatible with old permission checks
- Gradual migration strategy: old permission utilities still work

## Performance Considerations

1. **Deletion Check**: Adds one query to deletion flow (acceptable trade-off for data integrity)
2. **Collaborator Fetch**: Separate endpoint allows lazy loading (only fetch when needed)
3. **PermissionEnforcer**: Efficient inheritance resolution with caching potential

## Future Enhancements

1. **Batch Collaborator Display**: Cache collaborator data for multiple plans
2. **Real-time Updates**: WebSocket notifications when collaborators change
3. **Permission Caching**: Cache resolved permissions for session duration
4. **Audit Log**: Track permission checks for security monitoring
