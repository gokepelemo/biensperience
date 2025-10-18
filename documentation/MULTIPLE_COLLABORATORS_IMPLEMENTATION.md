# Multiple Collaborators Implementation

## Overview
This document describes the implementation of two key features:
1. **Multiple Collaborator Addition**: Users can add multiple collaborators without closing the modal
2. **Experience Collaborators**: Plan owners can add collaborators directly to the experience

## Date
October 13, 2025

## Changes Made

### 1. Frontend API Enhancement (`src/utilities/experiences-api.js`)

Added two new API functions for managing experience collaborators:

```javascript
/**
 * Add a collaborator permission to an experience
 */
export async function addExperienceCollaborator(experienceId, userId) {
  return await sendRequest(`${BASE_URL}${experienceId}/permissions`, "POST", {
    _id: userId,
    entity: 'user',
    type: 'collaborator'
  });
}

/**
 * Remove a collaborator permission from an experience
 */
export async function removeExperienceCollaborator(experienceId, userId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/permissions/${userId}/user`,
    "DELETE"
  );
}
```

### 2. Component State Updates (`src/views/SingleExperience/SingleExperience.jsx`)

#### New State Variables
- `collaboratorContext`: Tracks whether adding to 'plan' or 'experience'
- `addedCollaborators`: Array tracking all collaborators added in current session

```javascript
const [collaboratorContext, setCollaboratorContext] = useState('plan');
const [addedCollaborators, setAddedCollaborators] = useState([]);
```

#### Updated `handleAddCollaborator` Function
The function now:
- Checks the `collaboratorContext` to determine target entity
- Calls appropriate API (plan or experience)
- Tracks added collaborators in `addedCollaborators` array
- Keeps modal open with success message
- Allows adding multiple users in one session

```javascript
const handleAddCollaborator = useCallback(async (e) => {
  e.preventDefault();
  const userIdToAdd = selectedUser?._id || collaboratorUserId;
  if (!userIdToAdd) return;
  
  const isExperienceContext = collaboratorContext === 'experience';
  if (!isExperienceContext && !selectedPlanId) return;
  
  setLoading(true);
  try {
    if (isExperienceContext) {
      await addExperienceCollaborator(experienceId, userIdToAdd);
      await fetchExperience();
    } else {
      await addCollaborator(selectedPlanId, userIdToAdd);
      await fetchCollaborativePlans();
    }
    
    setAddedCollaborators(prev => [...prev, selectedUser]);
    setCollaboratorAddSuccess(true);
    // ... reset form fields
  } catch (err) {
    handleError(err, { context: "Add collaborator" });
  } finally {
    setLoading(false);
  }
}, [/* dependencies */]);
```

### 3. UI Updates

#### Experience Tab - New Button (Lines ~1194-1209)
Added "Add Collaborator to Experience" button for experience owners:

```jsx
{isOwner && (
  <div className="row my-4 p-3 fade-in">
    <div className="d-flex gap-3 flex-wrap">
      <button className="btn btn-primary" onClick={() => handleAddExperiencePlanItem()}>
        Add Plan Item
      </button>
      <button 
        className="btn btn-outline-primary"
        onClick={() => {
          setCollaboratorContext('experience');
          setShowCollaboratorModal(true);
        }}
      >
        <i className="bi bi-person-plus me-2"></i>
        Add Collaborator to Experience
      </button>
    </div>
  </div>
)}
```

#### My Plan Tab - Context Setting (Lines ~1490-1497)
Updated existing button to set context:

```jsx
{isPlanOwner && (
  <button
    onClick={() => {
      setCollaboratorContext('plan');
      setShowCollaboratorModal(true);
    }}
  >
    <i className="bi bi-person-plus me-2"></i>
    Add Collaborator
  </button>
)}
```

#### Modal Updates (Lines ~1858-2022)

**Dynamic Title:**
```jsx
<h5 className="modal-title">
  Add Collaborator to {collaboratorContext === 'experience' ? 'Experience' : 'Plan'}
</h5>
```

**Enhanced Success Message:**
- Shows count when multiple collaborators added
- Displays collaborator names
- Context-aware messaging (plan vs experience)

```jsx
<h4>Collaborator{addedCollaborators.length > 1 ? 's' : ''} Added Successfully!</h4>
<p className="text-muted">
  {addedCollaborators.length === 1 ? (
    <>
      <strong>{addedCollaborators[0].name}</strong> has been added as a collaborator 
      to your {collaboratorContext} and can now view and edit it.
    </>
  ) : (
    <>
      <strong>{addedCollaborators.length} users</strong> have been added as 
      collaborators to your {collaboratorContext}.
    </>
  )}
</p>
```

**Two-Button Footer:**
- **"Add Another"**: Resets form, keeps modal open
- **"Done"**: Closes modal, resets all state

```jsx
<div className="modal-footer justify-content-center">
  <button 
    className="btn btn-outline-secondary" 
    onClick={() => {
      setCollaboratorAddSuccess(false);
      // Reset form fields only
    }}
  >
    Add Another
  </button>
  <button 
    className="btn btn-primary" 
    onClick={() => {
      setShowCollaboratorModal(false);
      // Reset all state
    }}
  >
    Done
  </button>
</div>
```

**Context-Aware Description:**
```jsx
<p className="text-muted mb-3">
  Search for a user by name or email address to add them as a collaborator. 
  They will be able to view and edit this {collaboratorContext}.
</p>
```

## User Workflows

### Workflow 1: Add Multiple Collaborators to Plan
1. User opens "My Plan" tab
2. Clicks "Add Collaborator" button
3. Modal opens with title "Add Collaborator to Plan"
4. Searches and selects first user
5. Clicks "Add Collaborator"
6. Success message appears with "Add Another" and "Done" buttons
7. Clicks "Add Another" to add more users
8. Repeats steps 4-7 as needed
9. Clicks "Done" when finished

### Workflow 2: Add Collaborators to Experience
1. Experience owner views experience page (Experience Plan Items tab)
2. Clicks "Add Collaborator to Experience" button
3. Modal opens with title "Add Collaborator to Experience"
4. Searches and selects user
5. Clicks "Add Collaborator"
6. Success message appears
7. Can add more or click "Done"

## Backend Integration

### Experience Permissions API
The implementation uses the existing backend permission management routes:

- **Add Permission**: `POST /api/experiences/:id/permissions`
  - Body: `{ _id: userId, entity: 'user', type: 'collaborator' }`
  
- **Remove Permission**: `DELETE /api/experiences/:id/permissions/:userId/user`

These endpoints:
- Validate user ownership
- Check for circular dependencies
- Prevent duplicate permissions
- Handle permission inheritance

## State Management

### Modal State Flow

```
Initial State:
- collaboratorContext: 'plan'
- addedCollaborators: []
- collaboratorAddSuccess: false

After Opening Modal:
- collaboratorContext: 'plan' or 'experience' (set by button)
- Modal visible

After Adding Collaborator:
- addedCollaborators: [user1]
- collaboratorAddSuccess: true
- Form fields reset

After "Add Another":
- collaboratorAddSuccess: false
- Form fields reset
- addedCollaborators: [user1] (preserved)

After "Done":
- All state reset to initial
- Modal closed
```

## Benefits

### 1. Improved UX
- No need to reopen modal for each collaborator
- Clear feedback on who was added
- Flexible workflows (add one vs. add many)

### 2. Feature Parity
- Plans and experiences both support collaboration
- Consistent permission model across entities

### 3. Context-Aware UI
- Dynamic modal title and messaging
- Clear indication of target entity
- Prevents user confusion

## Security Considerations

1. **Ownership Validation**: Backend validates that only owners can add collaborators
2. **User Validation**: Backend checks that users exist before adding
3. **Duplicate Prevention**: Backend prevents adding same user twice
4. **Permission Types**: Strictly enforces 'collaborator' type for user permissions

## Future Enhancements

Potential improvements:
1. Bulk user selection (add multiple at once)
2. Remove collaborator functionality in UI
3. Show list of current collaborators
4. Collaborator role management (collaborator vs contributor)
5. Email notifications when added as collaborator

## Testing Checklist

- [ ] Add single collaborator to plan
- [ ] Add multiple collaborators to plan in one session
- [ ] Add collaborator to experience (owner only)
- [ ] Verify "Add Another" resets form but keeps modal open
- [ ] Verify "Done" closes modal and resets all state
- [ ] Test with non-owner (should not see experience button)
- [ ] Verify collaborators can view and edit plan/experience
- [ ] Check error handling (invalid user, network error)
- [ ] Verify modal title changes based on context
- [ ] Confirm success message shows correct count and names

## Dependencies

- Backend: Existing permission management endpoints
- Frontend: `experiences-api.js`, `plans-api.js`
- UI: Bootstrap 5 modals and buttons
- State: React useState, useCallback hooks

## Related Documentation

- [API Permissions Reference](./API_PERMISSIONS_REFERENCE.md)
- [Permissions Framework](./PERMISSIONS_FRAMEWORK.md)
- [Permissions Implementation Summary](./PERMISSIONS_IMPLEMENTATION_SUMMARY.md)
