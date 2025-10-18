# Fix ExperienceCard Button State and Planned Date

**Date**: October 13, 2025  
**Issues Fixed**:
1. Button not updating to "-" when user has a plan
2. Plans created without a planned date

**Status**: ✅ FIXED

---

## Problems

### Issue 1: Button State Not Updating for Owners
When experience owners created a plan, the "Add Plan" button didn't change to show the "-" (remove) state.

**Root Cause**: The `experienceAdded` logic had a special case that returned `true` for all owners, regardless of whether they actually had a plan:

```jsx
// BEFORE (incorrect):
const experienceAdded = useMemo(() => {
  if (!experience?._id || !user?._id) return false;
  if (isOwner) return true; // ❌ Always true for owners
  return userPlans.some(plan => ...);
}, [experience?._id, user?._id, userPlans, isOwner]);
```

This was leftover logic from when owners couldn't create plans. Now that they can, this needs to be removed.

### Issue 2: Plans Created with No Date
When users clicked "Add Plan" on an experience card, the plan was created with `null` as the planned date:

```jsx
// BEFORE:
await createPlan(experience._id, null); // ❌ No date set
```

This resulted in plans with no planned date, which is not user-friendly.

---

## Solutions

### Fix #1: Correct Button State Logic

**File**: `src/components/ExperienceCard/ExperienceCard.jsx`

Removed the special owner case and made the logic consistent for all users:

```jsx
// AFTER (correct):
const experienceAdded = useMemo(() => {
  if (!experience?._id || !user?._id) return false;
  // Check if user has a plan (works for both owners and non-owners)
  return userPlans.some(plan => 
    plan.experience?._id === experience._id || 
    plan.experience === experience._id
  );
}, [experience?._id, user?._id, userPlans]);
```

**Impact**:
- Button now correctly shows "+" when user has no plan
- Button shows "✅" when user has a plan
- On hover, "✅" changes to "-" to indicate removal
- Works consistently for both owners and non-owners

### Fix #2: Set Today's Date as Planned Date

**File**: `src/components/ExperienceCard/ExperienceCard.jsx`

Updated plan creation to use today's date:

```jsx
// AFTER:
const today = new Date();
await createPlan(experience._id, today);
```

**Impact**:
- Plans now have a default planned date of today
- Users can change the date later if needed
- Provides better UX with a sensible default

---

## Behavior After Fixes

### For All Users (Including Owners):

**No Plan Exists**:
- Button shows: "✚" (Add)
- Action: Creates plan with today's date
- Button changes to: "✅" (Planned)

**Plan Exists**:
- Button shows: "✅" (Planned)
- On hover: Changes to "-" (Remove)
- Action: Deletes the plan
- Button changes to: "✚" (Add)

### For Owners Specifically:
- Can create their own plans just like any other user
- Can delete their plans using the "-" button
- Can delete the entire experience using the trash button (separate action)
- Button state now accurately reflects whether they have a plan or not

---

## Testing

### Test Case 1: Owner Without Plan
1. Owner views their experience card
2. ✅ Button shows "+"
3. Click button
4. ✅ Plan created with today's date
5. ✅ Button changes to "✅"

### Test Case 2: Owner With Plan
1. Owner has already planned their experience
2. ✅ Button shows "✅"
3. Hover over button
4. ✅ Button changes to "-"
5. Click button
6. ✅ Plan deleted
7. ✅ Button changes to "+"

### Test Case 3: Non-Owner
1. User views any experience card
2. ✅ Button shows "+" (no plan)
3. Click button
4. ✅ Plan created with today's date
5. ✅ Button changes to "✅"
6. Hover and click "-"
7. ✅ Plan deleted

### Test Case 4: Planned Date
1. Create a plan from experience card
2. Navigate to experience detail page
3. ✅ Planned date shows today's date
4. ✅ Date can be edited if needed

---

## Files Modified

**src/components/ExperienceCard/ExperienceCard.jsx**:
1. Removed special owner case from `experienceAdded` logic (lines 18-24)
2. Simplified to check userPlans for all users
3. Added today's date when creating plans (line 64)
4. Removed `isOwner` from `experienceAdded` dependency array

---

## Code Changes

### Before:
```jsx
const experienceAdded = useMemo(() => {
  if (!experience?._id || !user?._id) return false;
  if (isOwner) return true; // Special case for owners
  return userPlans.some(plan => 
    plan.experience?._id === experience._id || 
    plan.experience === experience._id
  );
}, [experience?._id, user?._id, userPlans, isOwner]);

// ...

await createPlan(experience._id, null); // No date
```

### After:
```jsx
const experienceAdded = useMemo(() => {
  if (!experience?._id || !user?._id) return false;
  return userPlans.some(plan => 
    plan.experience?._id === experience._id || 
    plan.experience === experience._id
  );
}, [experience?._id, user?._id, userPlans]);

// ...

const today = new Date();
await createPlan(experience._id, today); // Today's date
```

---

## Build Results

```
✓ Compiled successfully
✓ Bundle size: 138.54 kB
✓ Server restarted (PM2 #189)
✓ No compilation errors
```

---

## Benefits

✅ **Consistent Behavior**: All users (owners and non-owners) have the same experience
✅ **Accurate State**: Button state accurately reflects whether user has a plan
✅ **Better UX**: Plans have sensible default date (today)
✅ **Cleaner Code**: Removed unnecessary special cases
✅ **Proper Separation**: Plan management vs. experience management clearly separated

---

**Status**: ✅ Resolved  
**User Experience**: Improved  
**All Tests**: Passing
