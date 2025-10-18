# Experience Users Array Refactor

## Overview
This refactor modernizes the Mark Complete button visibility logic by removing dependency on the redundant `experience.users` array and leveraging the permissions system and Plan model instead.

## Problem Statement
The application had two parallel tracking systems:
1. **experience.users[]** - Tracked who added an experience and their completion status
2. **Plan model** - Tracked who planned an experience with completion tracking

This redundancy caused:
- Maintenance overhead
- Confusion about which system was the source of truth
- Inconsistent button visibility logic

## Solution Architecture

### New Permission-Based Approach
The refactor uses three distinct permission checks:

1. **Experience Owner** (`isOwner`)
   - Checked via `experience.user` field and `experience.permissions` array
   - Uses existing `isOwner()` utility from permissions system

2. **Experience Collaborator** (`isExperienceCollaborator`)
   - NEW state variable
   - Checked via `experience.permissions` array
   - Looks for `{entity: 'user', type: 'collaborator'}` permission

3. **Plan Access** (implicit in My Plan tab)
   - Users can only see My Plan tab if they have a Plan instance
   - Plan model is source of truth for "who has planned this experience"

### Mark Complete Button Visibility Rules

#### Experience Plan Items Tab
```javascript
{(isOwner || isExperienceCollaborator) && (
  <button onClick={handlePlanItemDone}>Mark Complete</button>
)}
```

Shows button when:
- ✅ User is the experience owner
- ✅ User is a collaborator on the experience
- ❌ User has planned the experience but isn't owner/collaborator

#### My Plan Tab
```javascript
<button onClick={async () => {
  await updatePlanItem(selectedPlanId, itemId, { complete: !planItem.complete });
}}>Mark Complete</button>
```

Shows button:
- ✅ Always (no conditional check)
- User must have plan access to see this tab at all
- Works for user's own plan or collaborative plans

## Implementation Details

### 1. Added State Variable
**File**: `src/views/SingleExperience/SingleExperience.jsx` (Line 48)
```javascript
const [isExperienceCollaborator, setIsExperienceCollaborator] = useState(false);
```

### 2. Permission Checking in fetchExperience
**File**: `src/views/SingleExperience/SingleExperience.jsx` (Lines ~115-121)
```javascript
// Check if user is a collaborator on the experience via permissions
const isCollaborator = experienceData.permissions?.some(
  p => p.entity === 'user' && 
       p.type === 'collaborator' && 
       p._id.toString() === user._id
) || false;
setIsExperienceCollaborator(isCollaborator);
```

### 3. Updated Button Condition
**File**: `src/views/SingleExperience/SingleExperience.jsx` (Line ~1341)
```javascript
// OLD (redundant check):
{(userHasExperience || isOwner || collaborativePlans.length > 0) && (

// NEW (permissions-based):
{(isOwner || isExperienceCollaborator) && (
```

## Data Model Separation

### Experience Model
- **Purpose**: Define the experience template
- **Permissions**: `permissions[]` array with owner/collaborator/contributor roles
- **Plan Items**: `plan_items[]` array as template
- **Owner**: `user` field for backwards compatibility

### Plan Model
- **Purpose**: User-specific instance of experience plan
- **Ownership**: `user` field + `permissions[]` for collaborative planning
- **Plan Items**: Point-in-time snapshot from experience at creation
- **Completion**: `plan[].complete` tracks individual item completion
- **Lifecycle**: Created when user plans, deleted when user unplans

## Benefits

### 1. Single Source of Truth
- **Experience collaborators**: `experience.permissions` array
- **Plan participants**: Plan model instances
- No more dual tracking systems

### 2. Cleaner Logic
- Button visibility based on permissions, not array membership
- Consistent with permissions framework
- Easier to reason about who can do what

### 3. Better Performance
- No need to check multiple arrays (users[], collaborativePlans[])
- Direct permission lookup
- Cached in state variables

### 4. Maintainability
- Permissions system is well-documented
- Follows established patterns
- Easier to extend in future

## Migration Path

### Backwards Compatibility
The `experience.users` array is **still populated** but no longer used for button visibility. This ensures:
- Existing code continues to work
- Gradual migration possible
- No breaking changes

### Future Deprecation (Optional)
If desired, the `experience.users` array could be deprecated by:
1. Removing population logic from experience creation
2. Migrating existing completion data to Plan model
3. Removing `users` field from Experience schema
4. Updating completion_percentage virtual to use Plans instead

## Testing Scenarios

### Scenario 1: Experience Owner
- ✅ Sees Mark Complete on Experience Plan Items tab
- ✅ Can edit experience plan items
- ✅ Does NOT get separate Plan instance (uses experience directly)

### Scenario 2: Experience Collaborator
- ✅ Sees Mark Complete on Experience Plan Items tab
- ✅ Can edit experience plan items
- ✅ Can create their own Plan for personal tracking

### Scenario 3: Plan Owner (Non-Collaborator)
- ❌ Does NOT see Mark Complete on Experience Plan Items tab
- ✅ Sees Mark Complete on My Plan tab
- ✅ Can track completion in their own plan
- ❌ Cannot edit the original experience

### Scenario 4: Plan Collaborator
- ❌ Does NOT see Mark Complete on Experience Plan Items tab
- ✅ Sees Mark Complete on My Plan tab (collaborative plan)
- ✅ Can edit items in the collaborative plan
- ❌ Cannot edit the original experience

### Scenario 5: Random Visitor
- ❌ Does NOT see Mark Complete button
- ❌ Cannot see My Plan tab
- ✅ Can view public experiences
- ✅ Can create their own plan

## Code Changes Summary

### Files Modified
1. **src/views/SingleExperience/SingleExperience.jsx**
   - Added `isExperienceCollaborator` state (line 48)
   - Added permission checking in `fetchExperience()` (lines ~115-121)
   - Updated button condition (line ~1341)

### Files Not Modified
- **models/experience.js** - users array still exists for backwards compatibility
- **models/plan.js** - No changes needed
- **utilities/permissions.js** - Already had needed functions

### API Endpoints
No API changes required:
- `POST /api/plans/experience/:id` - Creates plan (existing)
- `DELETE /api/plans/:id` - Deletes plan (existing)
- `PUT /api/plans/:planId/items/:itemId` - Updates plan item completion (existing)
- `PUT /api/experiences/:id/plan-item-done` - Updates experience plan item (existing)

## Performance Considerations

### Before
```javascript
// Multiple array checks
userHasExperience || isOwner || collaborativePlans.length > 0
// Where userHasExperience required:
experience.users && experience.users.some((u) => u.user._id === user._id)
```

### After
```javascript
// Simple boolean checks
isOwner || isExperienceCollaborator
// Set once during fetch:
permissions?.some(p => p.entity === 'user' && p.type === 'collaborator' && p._id.toString() === user._id)
```

**Result**: Fewer array iterations, cached state values, cleaner logic.

## Related Documentation
- [Permissions Framework](./PERMISSIONS_FRAMEWORK.md)
- [Plan Model Implementation](./PLAN_MODEL_IMPLEMENTATION.md)
- [Plan Lifecycle](./PLAN_LIFECYCLE.md)
- [API Permissions Reference](./API_PERMISSIONS_REFERENCE.md)

## Conclusion
This refactor eliminates architectural redundancy by making the permissions system and Plan model the single sources of truth for experience collaboration and plan participation. The result is cleaner code, better performance, and easier maintenance.
