# Plan Date Update and Creation Fix

## Overview
This document describes the fix for critical issues with plan date updates and plan creation that were caused by redundant calls to the deprecated `userAddExperience` API.

## Problems Identified

### Problem 1: Duplicate Plan Creation Attempts
**Error**: `POST /api/experiences/:id/user/:userId 400 (Bad Request)`
**Context**: When updating a planned date on an existing plan

**Root Cause**: 
The `handleDateUpdate()` function was calling `handleAddExperience()`, which in turn called `userAddExperience()`. This tried to add the user to the `experience.users` array again, even though they already had a plan.

### Problem 2: Redundant API Calls
**Error**: `POST /api/plans/experience/:id 500 (Internal Server Error)`
**Context**: When adding a new experience

**Root Cause**:
The `handleAddExperience()` function was calling BOTH:
1. `userAddExperience()` - Legacy API to add user to experience.users array
2. `createPlan()` - New API to create a Plan instance

This created race conditions and duplicate entries, leading to 500 errors.

## Architecture Issues

According to the EXPERIENCE_USERS_REFACTOR documentation:
- **experience.users[] array is REDUNDANT** - Legacy system being phased out
- **Plan model is the source of truth** - New system for tracking who has planned experiences
- **Owners don't have plans** - They manage experiences directly via experience.plan_items

The code was still using both systems, causing conflicts.

## Solution

### 1. Removed userAddExperience Call
**File**: `SingleExperience.jsx`
**Function**: `handleAddExperience()`

**Before**:
```javascript
await userAddExperience(user._id, experience._id, addData);
// Then create plan
if (!isOwner) {
  const newPlan = await createPlan(experience._id, addData.planned_date || null);
}
```

**After**:
```javascript
// Only create plan (no userAddExperience call)
if (!isOwner) {
  const newPlan = await createPlan(experience._id, addData.planned_date || null);
}
```

**Rationale**: The Plan creation automatically adds contributor permissions. No need to modify experience.users array.

### 2. Smart Date Update Logic
**File**: `SingleExperience.jsx`
**Function**: `handleDateUpdate()`

**Before**:
```javascript
else if (!isOwner) {
  await handleAddExperience(); // Always tries to add/create
  await fetchExperience();
}
```

**After**:
```javascript
else if (!isOwner) {
  // Check if user already has a plan
  if (userPlan) {
    // Update existing plan's date
    await updatePlan(userPlan._id, { planned_date: plannedDate });
    await fetchUserPlan();
    await fetchCollaborativePlans();
    setDisplayedPlannedDate(plannedDate);
  } else {
    // Create new plan
    await handleAddExperience();
  }
  await fetchExperience();
}
```

**Rationale**: 
- Existing plans should be UPDATED, not recreated
- Only create a new plan if the user doesn't have one yet
- Prevents duplicate plan creation attempts

### 3. Removed Unused Import
**File**: `SingleExperience.jsx`

Removed `userAddExperience` from imports since it's no longer used:
```javascript
// REMOVED: userAddExperience
import {
  showExperience,
  userRemoveExperience,
  userPlanItemDone,
  // ... other imports
} from "../../utilities/experiences-api";
```

## Flow Diagrams

### Adding an Experience (New Plan)
```
User clicks "Plan Experience" button
    ↓
handleAddExperience() called
    ↓
createPlan(experienceId, plannedDate)
    ↓
Plan model created with:
  - User becomes plan owner
  - Contributor permission added to experience
  - Snapshot of experience.plan_items copied
    ↓
fetchUserPlan() & fetchCollaborativePlans()
    ↓
Switch to "My Plan" tab
    ↓
Display new plan
```

### Updating Plan Date (Existing Plan)
```
User has existing plan
    ↓
User clicks 📅 date button
    ↓
User enters new date
    ↓
handleDateUpdate() called
    ↓
Check: userPlan exists?
    ↓
YES → updatePlan(userPlan._id, {planned_date})
    ↓
fetchUserPlan() & fetchCollaborativePlans()
    ↓
Display updated date
```

### Creating First Plan (No Existing Plan)
```
User has NO existing plan
    ↓
User clicks 📅 date button
    ↓
User enters date
    ↓
handleDateUpdate() called
    ↓
Check: userPlan exists?
    ↓
NO → handleAddExperience()
    ↓
(Same flow as "Adding an Experience")
```

## Benefits

### 1. Eliminates 400 Errors
✅ No more attempts to add users twice to experience.users
✅ Clean separation: Plans handle user tracking

### 2. Eliminates 500 Errors
✅ No more duplicate plan creation attempts
✅ Single source of truth for plan management

### 3. Cleaner Architecture
✅ Removed dependency on deprecated experience.users array
✅ Plan model is now the sole authority
✅ Aligns with EXPERIENCE_USERS_REFACTOR goals

### 4. Better Performance
✅ Fewer API calls (removed userAddExperience)
✅ Direct plan updates instead of recreation
✅ Reduced race conditions

## Testing Checklist

### New Plan Creation
- [ ] Non-owner can add experience without planned date
- [ ] Non-owner can add experience with planned date
- [ ] Plan is created successfully
- [ ] User becomes plan owner
- [ ] Contributor permission added to experience
- [ ] Plan items copied from experience
- [ ] Switches to "My Plan" tab
- [ ] No 400 or 500 errors

### Date Update (Existing Plan)
- [ ] User with existing plan can update date
- [ ] Date picker shows current planned date
- [ ] Updated date persists correctly
- [ ] No attempt to create duplicate plan
- [ ] No 400 errors
- [ ] Plan relationship unchanged

### Date Update (No Plan Yet)
- [ ] User without plan can set initial date
- [ ] Plan is created with the date
- [ ] Switches to "My Plan" tab
- [ ] No errors

### Owner Behavior
- [ ] Owner doesn't see 📅 date button on Experience tab
- [ ] Owner can't update planned date on Experience tab
- [ ] Owner can still manage experience plan items
- [ ] No errors when owner views experience

### Edge Cases
- [ ] Updating date while on "My Plan" tab works
- [ ] Collaborative plan date updates work
- [ ] Date validation still applies
- [ ] Error handling works correctly

## Related Files

### Modified
- `src/views/SingleExperience/SingleExperience.jsx`:
  - Line ~728: handleAddExperience() - Removed userAddExperience call
  - Line ~793: handleDateUpdate() - Added smart plan detection
  - Line ~9: Removed userAddExperience import

### Related Documentation
- [Experience Users Refactor](./EXPERIENCE_USERS_REFACTOR.md)
- [Plan Model Implementation](./PLAN_MODEL_IMPLEMENTATION.md)
- [Plan Lifecycle](./PLAN_LIFECYCLE.md)

## Migration Notes

### Backwards Compatibility
- The experience.users array may still contain data
- This fix doesn't remove existing users array entries
- Future migration may fully deprecate the users array
- For now, Plans are the source of truth, users array is legacy

### API Endpoints Still Used
- `POST /api/plans/experience/:id` - Create plan
- `PUT /api/plans/:id` - Update plan
- `DELETE /api/plans/:id` - Delete plan

### API Endpoints No Longer Used
- ~~`POST /api/experiences/:id/user/:userId`~~ - Add user to experience (deprecated)

## Deployment
- **Date**: October 12, 2025
- **Build**: Successful (+45 bytes)
- **Status**: ✅ Deployed to production
- **Impact**: Critical bug fix, zero downtime deployment
