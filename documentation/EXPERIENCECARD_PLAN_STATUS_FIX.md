# ExperienceCard Plan Status & Planned Date Fix

**Date:** October 13, 2025  
**Issue:** ExperienceCard button showing incorrect state, plans created with today's date, remove button not working

---

## Problems Fixed

### 1. ❌ **Button Shows "+" When Plan Already Exists**

**Root Cause:**
- `localPlanState` initialized as `null` (unknown)
- `userPlans` prop not passed by parent components
- `experienceAdded` defaulted to `false` when both sources unavailable
- Button showed "+" (add) even when user had a plan

**Error:**
```
POST http://localhost:3001/api/plans/experience/68e858222e980549de19c56f 400 (Bad Request)
{"error":"Plan already exists for this experience"}
```

### 2. ❌ **Plans Created with Today's Date**

**Root Cause:**
Backend defaulted `planned_date` to `new Date()` when null passed:
```javascript
planned_date: planned_date || new Date(), // Wrong!
```

### 3. ❌ **Remove Plan Button Not Working**

**Root Cause:**
When deleting a plan, code tried to find it in empty `userPlans` array:
```javascript
const userPlan = userPlans.find(plan => ...); // userPlan = undefined
if (userPlan) {
  await deletePlan(userPlan._id); // Never executed!
}
```

**Result:** Button appeared to do nothing, plan wasn't deleted

---

## Solutions Implemented

### 1. ✅ **ExperienceCard Auto-Fetch Plan Status**

**File:** `src/components/ExperienceCard/ExperienceCard.jsx`

**Changes:**
- Added `useEffect` to fetch plan status when `userPlans` empty
- Initialize `localPlanState` from `userPlans` if available
- Update `localPlanState` immediately after create/delete actions

**Three-Tier State System:**
```javascript
// 1. Initialize from userPlans prop (if passed)
const [localPlanState, setLocalPlanState] = useState(() => {
  if (userPlans.length > 0) {
    return userPlans.some(plan => 
      plan.experience?._id === experience._id
    );
  }
  return null; // Don't know yet
});

// 2. Fetch from API (when userPlans empty)
useEffect(() => {
  if (userPlans.length > 0 || localPlanState !== null) return;
  
  const plans = await getUserPlans();
  const hasPlan = plans.some(plan => 
    plan.experience?._id === experience._id
  );
  setLocalPlanState(hasPlan);
}, [experience._id, userPlans.length, localPlanState]);

// 3. Update immediately (on user action)
await createPlan(experience._id, null);
setLocalPlanState(true); // Button updates right away

await deletePlan(userPlan._id);
setLocalPlanState(false); // Button updates right away
```

**Benefits:**
- ✅ No parent component changes needed
- ✅ Lazy loading - only fetches when needed
- ✅ Immediate UI feedback
- ✅ Memory efficient with cleanup
- ✅ Resilient - falls back gracefully on error

### 2. ✅ **Backend Planned Date Fix**

**File:** `controllers/api/plans.js` (line 53)

**Change:**
```javascript
// Before
planned_date: planned_date || new Date(), // Always defaulted to today

// After
planned_date: planned_date || null, // Allow null - user sets date later
```

**Impact:**
- Plans created from ExperienceCard have `planned_date: null`
- Users can set their planned date on SingleExperience view
- No more unwanted default dates

### 3. ✅ **Plan Deletion Fix**

**File:** `src/components/ExperienceCard/ExperienceCard.jsx`

**Problem:** When `userPlans` prop is empty, couldn't find plan to delete

**Solution:** Fetch plans from API if not found in prop
```javascript
if (experienceAdded) {
  // Try to find in prop first
  let userPlan = userPlans.find(plan => 
    plan.experience?._id === experience._id
  );
  
  // If not found, fetch from API
  if (!userPlan) {
    const plans = await getUserPlans();
    userPlan = plans.find(plan => 
      plan.experience?._id === experience._id
    );
  }
  
  if (userPlan) {
    await deletePlan(userPlan._id);
    setLocalPlanState(false);
  } else {
    throw new Error('Plan not found');
  }
}
```

**Impact:**
- ✅ Remove button now works reliably
- ✅ Fetches plan ID if not in props
- ✅ Proper error handling if plan missing
- ✅ Immediate button state update

**Note on Confirm Modal:**
- No confirm modal needed for removing plans (quick toggle action)
- Confirm modal only shows for experience deletion (owner action, destructive)

---

## Files Modified

1. **`src/components/ExperienceCard/ExperienceCard.jsx`**
   - Added `useEffect` import
   - Added `getUserPlans` import
   - Added auto-fetch useEffect for plan status
   - Updated localPlanState initialization
   - Added setLocalPlanState calls in handleExperienceAction
   - **Fixed plan deletion to fetch plan ID when userPlans empty**

2. **`controllers/api/plans.js`**
   - Changed planned_date default from `new Date()` to `null`

---

## Testing Completed

### Button State
- [x] Fresh page load: Button shows correct state (✅ or +)
- [x] Click "+": Creates plan, button → ✅ immediately
- [x] Hover "✅": Shows "-" to remove
- [x] **Click "-": Deletes plan, button → "+" immediately** ✅ **NOW WORKING**
- [x] No 400 errors: Won't try to create duplicate plans

### Planned Date
- [x] Create from ExperienceCard: `planned_date: null`
- [x] View in SingleExperience: Shows "Set Planned Date" button
- [x] Set date: Persists correctly
- [x] No unwanted today defaults

### Confirm Modal
- [x] No modal appears when removing plans (quick toggle)
- [x] Modal only shows for experience deletion (owner action)

---

## Deployment

```bash
npm run build
# Compiled successfully - 138.68 kB JS (gzip)

pm2 restart 0
# [PM2] [biensperience](0) ✓
```

**Status:** ✅ **DEPLOYED TO PRODUCTION**

---

## Related Issues Fixed

This completes the full migration from `experience.users` to the Plan Model:

1. ✅ Owner plan creation enabled
2. ✅ Collaborator display at top of plans
3. ✅ ExperienceCard button state management
4. ✅ Planned date null by default
5. ✅ No more 400 duplicate plan errors

---

## Documentation Created

- `documentation/COMPLETE_PLAN_MODEL_MIGRATION.md` - Full migration summary
- This document - Quick reference for this session's fixes

---

## Summary

**Problem:** ExperienceCard button state incorrect, plans created with unwanted dates, remove button not working  
**Solution:** Auto-fetch plan status in ExperienceCard, fix backend default, fetch plan ID before deletion  
**Result:** ✅ Button always shows correct state, no 400 errors, no unwanted dates, remove works reliably  
**Status:** Production-ready, fully tested, documented
