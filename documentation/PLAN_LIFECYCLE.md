# Plan Lifecycle Documentation

## Overview
This document describes the automatic lifecycle management of Plans when users interact with experiences through the "Plan Experience" button.

## User Flow

### Planning an Experience (Non-Owner)
When a user clicks "Plan Experience" on an experience they don't own:

1. **Frontend (`SingleExperience.jsx`)**:
   - User clicks "Plan Experience" button
   - Date picker modal appears (if experience has planning days requirement)
   - User selects date or skips
   - `handleAddExperience()` is called

2. **Experience Association**:
   - `userAddExperience(userId, experienceId, { planned_date })` is called
   - User is added to experience.users array

3. **Plan Creation**:
   - `createPlan(experienceId, planned_date)` is called
   - Backend creates Plan instance with:
     - Snapshot of current experience plan items
     - User as owner in permissions array
     - Planned date
   - User is automatically added as **contributor** to the experience

4. **UI Update**:
   - "Plan Experience" button changes to "Remove"
   - "My Plan" tab appears in navigation
   - User can now view/edit their personal plan

### Planning an Experience (Owner)
When an experience owner clicks "Plan Experience":

1. **No Plan Created**: Owners use the experience's plan items directly
2. **Reason**: Prevents duplication, maintains single source of truth
3. **UI**: Owner still sees "My Plan" tab, but it displays experience plan items

### Removing an Experience (Non-Owner)
When a user clicks "Remove" to unplan an experience:

1. **Frontend (`SingleExperience.jsx`)**:
   - `handleExperience()` detects removal
   - Checks if user is owner: `if (!isOwner && userPlan)`

2. **Experience Disassociation**:
   - `userRemoveExperience(userId, experienceId)` is called
   - User is removed from experience.users array

3. **Plan Deletion**:
   - `deletePlan(planId)` is called
   - Backend deletes Plan instance
   - **Contributor permission removed** (unless user is owner/collaborator)

4. **UI Update**:
   - "Remove" button changes back to "Plan Experience"
   - "My Plan" tab disappears
   - Plan items cleared from state

### Removing an Experience (Owner)
Owners cannot have separate plans, so:
- No plan deletion occurs
- Owner keeps all permissions
- Experience plan items remain

## Backend Logic

### Plan Creation (`controllers/api/plans.js`)

```javascript
const createPlan = withErrorHandling(async (req, res) => {
  // 1. Validate experience exists
  // 2. Check for duplicate plan
  // 3. Create snapshot of experience plan items
  // 4. Create Plan with dual ownership (user field + permissions array)
  // 5. Add user as contributor to experience (if not already owner/collaborator)
  // 6. Return populated plan
});
```

**Key Features**:
- Point-in-time snapshot of plan items
- Automatic contributor assignment
- Duplicate prevention (one plan per user per experience)
- Dual ownership model for backwards compatibility

### Plan Deletion (`controllers/api/plans.js`)

```javascript
const deletePlan = withErrorHandling(async (req, res) => {
  // 1. Validate plan exists
  // 2. Check user is plan owner
  // 3. Get associated experience
  // 4. Remove contributor permission (only if not owner/collaborator)
  // 5. Delete plan
});
```

**Key Features**:
- Only plan owner can delete
- Smart permission removal (preserves owner/collaborator status)
- Atomic operation

## Permission Management

### Contributor Assignment Rules
1. **On Plan Creation**: User becomes contributor if not already owner/collaborator
2. **On Plan Deletion**: Contributor removed if not owner/collaborator
3. **Protection**: Owner and collaborator permissions are never auto-removed

### Why Automatic Contributors?
- Tracks user engagement with experience
- Enables experience owner to see who has planned
- Foundation for future features (notifications, analytics)
- Prevents experience deletion if users have active plans

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User Action                        │
│              "Plan Experience" Click                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Is User Owner?     │
         └──────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
       Yes                     No
        │                       │
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│  No Plan     │      │  Create Plan     │
│  Created     │      │  with Snapshot   │
└──────────────┘      └────────┬─────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Add as Contributor   │
                    │  to Experience       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Show "My Plan" Tab  │
                    └──────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   User Action                        │
│                "Remove" Click                        │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Is User Owner?     │
         └──────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
       Yes                     No
        │                       │
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│  No Action   │      │  Delete Plan     │
│  on Plan     │      └────────┬─────────┘
└──────────────┘               │
                               ▼
                    ┌──────────────────────┐
                    │ Remove Contributor   │
                    │ (if not owner/collab)│
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Hide "My Plan" Tab  │
                    └──────────────────────┘
```

## Code Locations

### Frontend
- **File**: `src/views/SingleExperience/SingleExperience.jsx`
- **Functions**:
  - `handleAddExperience()` - Lines 167-203
  - `handleExperience()` - Lines 142-179
  - `fetchUserPlan()` - Lines 120-128

### Backend
- **File**: `controllers/api/plans.js`
- **Functions**:
  - `createPlan()` - Lines 12-89
  - `deletePlan()` - Lines 223-256

### API Endpoints
- `POST /api/plans/experience/:experienceId` - Create plan
- `DELETE /api/plans/:id` - Delete plan
- `GET /api/plans` - Get user's plans

## Testing

See `tests/api/plans.test.js` for comprehensive integration tests covering:
- Plan creation for non-owners
- No plan creation for owners
- Duplicate prevention
- Plan deletion with contributor removal
- Permission preservation for owners/collaborators
- Snapshot independence

## Edge Cases Handled

1. **Duplicate Plans**: Backend prevents multiple plans per user per experience
2. **Owner Planning**: Frontend skips plan creation for owners
3. **Permission Preservation**: Deletion doesn't remove owner/collaborator status
4. **Snapshot Isolation**: Plan changes don't affect experience, and vice versa
5. **Error Recovery**: Frontend reverts optimistic updates on API errors
6. **Missing Data**: Graceful handling of null/undefined values

## Future Enhancements

1. **Plan Sharing**: Allow users to share their completed plans
2. **Plan Cloning**: Copy someone else's plan as starting point
3. **Analytics**: Track plan completion rates
4. **Notifications**: Notify when collaborative plan items are completed
5. **Plan History**: Track changes to plan over time
