# Fix Experience Card and SingleExperience Plan API

**Date**: October 13, 2025  
**Issue**: HTTP 410 errors when planning or removing experiences  
**Status**: ✅ FIXED

---

## Problems

### 1. ExperienceCard: 410 Error on "Plan Experience"
When users clicked the "Plan Experience" button on ExperienceCard components:
```
HTTP 410 Gone: {"error":"This endpoint is deprecated"}
POST /api/experiences/:id/user/:userId
```

### 2. SingleExperience: 410 Error on "Remove"
When users tried to remove a planned experience:
```
HTTP 410 Gone: {"error":"This endpoint is deprecated"}
DELETE /api/experiences/:id/user/:userId
```

**Root Cause**: Both components were still calling the deprecated `userAddExperience`, `userRemoveExperience` API endpoints from the old experience.users architecture instead of using the Plan API.

---

## Solutions

### Fix #1: ExperienceCard Component

**File**: `src/components/ExperienceCard/ExperienceCard.jsx`

**Changes**:
1. Updated imports to use Plan API
2. Replaced deprecated endpoint calls with Plan API calls
3. Added userPlans to find and delete correct plan

```jsx
// BEFORE:
import {
  userAddExperience,
  userRemoveExperience,
  deleteExperience,
} from "../../utilities/experiences-api";

if (experienceAdded) {
  await userRemoveExperience(user._id, experience._id);
} else {
  await userAddExperience(user._id, experience._id);
}

// AFTER:
import { deleteExperience } from "../../utilities/experiences-api";
import { createPlan, deletePlan } from "../../utilities/plans-api";

if (experienceAdded) {
  // Find the user's plan and delete it
  const userPlan = userPlans.find(plan => 
    plan.experience?._id === experience._id || 
    plan.experience === experience._id
  );
  if (userPlan) {
    await deletePlan(userPlan._id);
  }
} else {
  // Create a new plan
  await createPlan(experience._id, null);
}
```

### Fix #2: SingleExperience Component

**File**: `src/views/SingleExperience/SingleExperience.jsx`

**Changes**:
1. Removed `userRemoveExperience` import
2. Updated `confirmRemoveExperience` to only use Plan API
3. Simplified logic - no need to call deprecated endpoint first

```jsx
// BEFORE:
import {
  showExperience,
  userRemoveExperience,  // ❌ Deprecated
  deleteExperience,
  // ...
} from "../../utilities/experiences-api";

const confirmRemoveExperience = async () => {
  await userRemoveExperience(user._id, experience._id);  // ❌ 410 Error
  
  if (userPlan) {
    try {
      await deletePlan(userPlan._id);
    } catch (planErr) {
      // Continue even if plan deletion fails
    }
  }
};

// AFTER:
import {
  showExperience,
  deleteExperience,
  // ... (no userRemoveExperience)
} from "../../utilities/experiences-api";

const confirmRemoveExperience = async () => {
  // Just delete the plan directly
  if (userPlan) {
    await deletePlan(userPlan._id);
    debug.log("Plan deleted successfully");
    
    // Clear plan-related state
    setUserPlan(null);
    setCollaborativePlans([]);
    setSelectedPlanId(null);
    setActiveTab("experience");
  }
};
```

---

## Impact

✅ **Fixed**:
- Users can plan experiences from cards
- Users can remove planned experiences
- No more 410 errors
- Consistent Plan API usage across the app

✅ **Improved**:
- Cleaner code (removed deprecated calls)
- Better error messages ("Create/Remove plan" vs "Add/Remove experience")
- Simplified logic in SingleExperience
- All components now use modern Plan API

---

## Testing

### Test Case 1: Plan from Card
1. Navigate to experiences list
2. Click "Plan Experience" on any card
3. ✅ Plan is created successfully
4. Button changes to "Remove"

### Test Case 2: Remove from Card
1. Click "Remove" on a planned experience card
2. ✅ Plan is deleted successfully
3. Button changes back to "Plan Experience"

### Test Case 3: Remove from SingleExperience
1. Navigate to a planned experience details page
2. Click "Remove" button
3. ✅ Plan is deleted successfully
4. UI updates to show "Plan Experience" button

### Edge Cases:
- ✅ Owner planning their own experience: Works
- ✅ Non-owner planning experience: Works
- ✅ Removing plans: Works for all users
- ✅ Multiple rapid clicks: Loading state prevents duplicates

---

## Files Modified

1. **src/components/ExperienceCard/ExperienceCard.jsx**
   - Updated imports (removed deprecated, added Plan API)
   - Rewrote handleExperienceAction to use createPlan/deletePlan
   - Added userPlans dependency

2. **src/views/SingleExperience/SingleExperience.jsx**
   - Removed userRemoveExperience import
   - Simplified confirmRemoveExperience to only use deletePlan
   - Updated comments and error context

---

## Migration Complete

All deprecated experience.users endpoints have been removed from the frontend:
- ❌ `POST /api/experiences/:id/user/:userId` (add user)
- ❌ `DELETE /api/experiences/:id/user/:userId` (remove user)
- ❌ `POST /api/experiences/:id/plan-item/:itemId` (mark complete)

All components now use the Plan API:
- ✅ `POST /api/plans/experience/:id` (create plan)
- ✅ `DELETE /api/plans/:id` (delete plan)
- ✅ `PATCH /api/plans/:id/items/:itemId` (update plan items)

---

**Status**: ✅ Resolved  
**API Migration**: Complete  
**Server**: PM2 restart #188
