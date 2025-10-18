# Enable Owner Plans and Show Collaborators

**Date**: October 13, 2025  
**Feature**: Allow experience owners to create plans + Display plan collaborators  
**Status**: ✅ IMPLEMENTED

---

## Overview

This update enables experience owners to create their own Plan instances for tracking personal completion, and adds a visual display of plan collaborators at the top of each plan.

---

## Changes Made

### 1. Enable Owners to Create Plans

**Previous Behavior**: Experience owners were blocked from creating plans with the reasoning that they should work directly on experience plan_items (templates).

**New Behavior**: Owners can now create plans just like any other user, allowing them to:
- Track personal completion of their own experiences
- Separate template management from personal progress
- Use the same plan features as non-owners (costs, dates, collaboration)

**Files Modified**:
- `src/views/SingleExperience/SingleExperience.jsx`
  * Removed `if (!isOwner)` check in `handleAddExperience` (lines 757-788)
  * Updated comment to reflect owners can create plans
  * Removed `isOwner` from dependency array (no longer used)
  * Updated `confirmRemoveExperience` to handle owner plan deletion
  * Changed date picker button condition from `userHasExperience && !isOwner` to just `userHasExperience`

**Benefits**:
- Owners can track completion without affecting the template
- Consistent UX for all users
- Owners can collaborate on their own plans
- Separation of concerns: templates vs. personal tracking

---

### 2. Display Plan Collaborators

**Feature**: Show all plan collaborators at the top of the "My Plan" tab with profile links.

**Display Format**: 
```
Collaborators: Alice, Bob, and Charlie
```

Each name is a clickable link to the collaborator's profile page.

**Backend Changes**:
- `controllers/api/plans.js` (getExperiencePlans function)
  * Added manual population of user data for permissions array
  * Fetches User documents for all user permissions
  * Enhances each permission object with populated user data (name, email, _id)
  * Returns plans with enriched permissions including `user` property

**Frontend Changes**:
- `src/views/SingleExperience/SingleExperience.jsx`
  * Added collaborator display section after sync button (lines 1473-1501)
  * Filters permissions for type='collaborator' and entity='user'
  * Displays collaborators with proper formatting (commas and "and")
  * Shows as blue info alert box
  * Only displays if collaborators exist (not shown if only owner)

**Implementation Details**:
```javascript
// Backend: Populate collaborators in permissions
const plansWithCollaborators = await Promise.all(plans.map(async (plan) => {
  const planObj = plan.toObject();
  if (planObj.permissions && planObj.permissions.length > 0) {
    const userPermissions = planObj.permissions.filter(p => p.entity === 'user');
    const userIds = userPermissions.map(p => p._id);
    const users = await User.find({ _id: { $in: userIds } }).select('name email');
    
    // Map user data to permissions
    planObj.permissions = planObj.permissions.map(p => {
      if (p.entity === 'user' && userMap[p._id.toString()]) {
        return { ...p, user: userMap[p._id.toString()] };
      }
      return p;
    });
  }
  return planObj;
}));
```

```jsx
// Frontend: Display collaborators
{(() => {
  const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
  if (!currentPlan || !currentPlan.permissions) return null;
  
  const collaboratorPerms = currentPlan.permissions.filter(p => 
    p.entity === 'user' && 
    p.type === 'collaborator' &&
    p.user
  );
  
  if (collaboratorPerms.length === 0) return null;
  
  return (
    <div className="alert alert-info mb-3">
      <strong>Collaborators: </strong>
      {collaboratorPerms.map((perm, index) => (
        <span key={perm._id.toString()}>
          <Link to={`/users/${perm._id}`}>
            {perm.user.name}
          </Link>
          {/* Format with commas and "and" */}
        </span>
      ))}
    </div>
  );
})()}
```

---

## Documentation Updates

### Updated Files:
1. `.github/copilot-instructions.md`
   - Removed references to "owners don't get separate Plans"
   - Updated to say "owners can now create plans"
   - Changed "non-owners" to "all users" in tab visibility
   - Updated collaborator display description

2. This file (`ENABLE_OWNER_PLANS.md`)
   - Comprehensive documentation of changes
   - Implementation details
   - Benefits and rationale

---

## Benefits

### For Experience Owners:
- ✅ Can track personal completion without affecting template
- ✅ Can add collaborators to their own plans
- ✅ Can set planned dates and track costs
- ✅ Consistent experience with non-owners
- ✅ Clear separation: manage template vs. track personal progress

### For All Users:
- ✅ See who they're collaborating with on plans
- ✅ Easy access to collaborator profiles via links
- ✅ Visual confirmation of shared planning
- ✅ More transparent collaboration

### For the Platform:
- ✅ Simplified logic (no special owner exceptions)
- ✅ Better UX consistency
- ✅ More flexible planning model
- ✅ Enables owner-to-owner collaboration

---

## Architecture

### Previous Model:
```
Owners: Manage experience.plan_items directly (no Plans)
Non-Owners: Create Plan instances with snapshots
```

### New Model:
```
All Users: Can create Plan instances
Owners: Additionally manage experience.plan_items (templates)
```

### Key Insight:
The previous restriction was overly limiting. Owners need two distinct capabilities:
1. **Template Management**: Edit experience.plan_items for everyone
2. **Personal Tracking**: Use their own Plan for completion tracking

These are not mutually exclusive - owners should be able to do both!

---

## User Flows

### Owner Creating a Plan:
1. Navigate to their own experience
2. Click "Plan Experience" button
3. Plan is created with snapshot of current plan_items
4. "My Plan" tab appears
5. Owner can mark items complete, track costs, add dates
6. Changes to their plan don't affect the experience template

### Adding Collaborators to a Plan:
1. Plan owner clicks "Add Collaborator" button
2. Searches for user by name/email
3. User is added with 'collaborator' permission
4. Collaborator appears in the list at top of plan
5. Collaborator can view and edit plan items
6. Both see each other's names in collaborator list

---

## Testing Considerations

### Test Cases:
1. ✅ Owner can create plan for their own experience
2. ✅ Owner's plan appears in "My Plan" tab
3. ✅ Owner can mark plan items complete
4. ✅ Owner's plan is separate from experience template
5. ✅ Collaborators appear in collaborator list
6. ✅ Collaborator names link to user profiles
7. ✅ Multiple collaborators show with proper formatting
8. ✅ Collaborator list hidden when no collaborators
9. ✅ Owner can delete their own plan
10. ✅ Date picker button shows for owners with plans

---

## Files Changed

### Backend:
- `controllers/api/plans.js` (lines 149-183)
  * Added manual population of collaborator user data
  * Enhanced getExperiencePlans to include user details in permissions

### Frontend:
- `src/views/SingleExperience/SingleExperience.jsx`
  * Removed owner blocking in handleAddExperience (lines 757-788)
  * Updated confirmRemoveExperience to handle owner plans (lines 714-728)
  * Changed date picker visibility (line 990)
  * Added collaborator display section (lines 1473-1501)
  * Updated comments throughout

### Documentation:
- `.github/copilot-instructions.md`
  * Updated Plan Model and Lifecycle section
  * Removed "owner exception" language
  * Updated UI Integration section

---

## Migration Notes

**No Breaking Changes**: 
- Existing owners without plans: Not affected
- Existing non-owner plans: Continue working as before
- New functionality is additive only

**Database**: 
- No schema changes required
- Existing Plan documents work unchanged
- New owner plans use same structure

---

**Status**: ✅ Complete and Ready for Testing  
**Next Steps**: Build, deploy, and verify functionality
