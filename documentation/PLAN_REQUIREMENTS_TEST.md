# Plan Requirements Testing Checklist

## Requirement 1: Planning a new experience creates a new plan instance

### Implementation Details
- **Location**: `handleAddExperience()` in `SingleExperience.jsx` (lines 447-493)
- **Flow**:
  1. User clicks "Add to Plans" or "Plan Experience"
  2. For non-owners: `createPlan()` is called with experience ID and planned date
  3. Returns `newPlan` object with plan ID
  4. `fetchUserPlan()` refreshes user's plan list
  5. `fetchCollaborativePlans()` refreshes collaborative plans
  6. Tab switches to "myplan"
  7. `selectedPlanId` set to new plan ID
  8. `displayedPlannedDate` updated to plan date

### Test Cases
- [ ] **Test 1.1**: Add experience without date
  - Action: Click "Plan Experience" → Skip date
  - Expected: Plan created, My Plan tab appears, no date shown
  
- [ ] **Test 1.2**: Add experience with date
  - Action: Click "Plan Experience" → Select date → Add
  - Expected: Plan created, My Plan tab appears, date shown correctly
  
- [ ] **Test 1.3**: Add experience as owner
  - Action: Owner clicks button
  - Expected: No separate plan created (uses experience plan items)
  
- [ ] **Test 1.4**: Tab visibility after creation
  - Action: Create plan
  - Expected: "My Plan" tab visible immediately without refresh

### Edge Cases
- [ ] Network failure during plan creation
- [ ] Experience has no plan items
- [ ] User already has a plan (should not duplicate)

---

## Requirement 2: Removing an experience deletes the user's plan instance

### Implementation Details
- **Location**: `confirmRemoveExperience()` in `SingleExperience.jsx` (lines 402-444)
- **Flow**:
  1. User clicks "Remove Experience"
  2. Confirmation modal appears
  3. User confirms
  4. For non-owners with plan: `deletePlan(userPlan._id)` called
  5. State cleared: `userPlan`, `collaborativePlans`, `selectedPlanId`
  6. Tab switches back to "experience"
  7. Experience data refreshed

### Test Cases
- [ ] **Test 2.1**: Remove experience with plan
  - Setup: User has active plan
  - Action: Click "Remove" → Confirm
  - Expected: Plan deleted, My Plan tab disappears
  
- [ ] **Test 2.2**: Remove experience as collaborator
  - Setup: User is collaborator on someone's plan
  - Action: Remove experience
  - Expected: User's access removed, can still see experience
  
- [ ] **Test 2.3**: State cleanup verification
  - Action: Remove experience with plan
  - Expected: All plan state variables null/empty

### Edge Cases
- [ ] Network failure during plan deletion
- [ ] Plan already deleted by another action
- [ ] User is collaborator on multiple plans for this experience

---

## Requirement 3: My Plan tab is instantly viewable after plan creation

### Implementation Details
- **Location**: `handleAddExperience()` in `SingleExperience.jsx` (lines 477-482)
- **Mechanism**:
  1. After plan creation: `setActiveTab("myplan")`
  2. After plan creation: `setSelectedPlanId(newPlan._id)`
  3. After plan creation: `setDisplayedPlannedDate(addData.planned_date)`
  4. React immediately re-renders with new state
  5. Tab visibility conditional: `{collaborativePlans.length > 0 && ...}`

### Test Cases
- [ ] **Test 3.1**: Tab appears without refresh
  - Action: Add experience to plans
  - Expected: My Plan tab visible immediately
  
- [ ] **Test 3.2**: Tab shows correct content
  - Action: Add experience → View My Plan tab
  - Expected: Shows plan items snapshot
  
- [ ] **Test 3.3**: Dropdown populated correctly
  - Action: Add plan when collaborator on another
  - Expected: Dropdown shows both plans, user's first

### Edge Cases
- [ ] Rapid clicking of Add/Remove buttons
- [ ] Multiple users adding plans simultaneously
- [ ] Browser slow rendering

---

## Requirement 4: Planned date logic changes with plan selection

### Implementation Details
- **Location**: Multiple locations working together:
  1. **useEffect** (lines 258-269): Syncs `displayedPlannedDate` with active context
  2. **handlePlanChange** (lines 323-329): Updates date when plan dropdown changes
  3. **handleDateUpdate** (lines 498-529): Updates correct entity based on context
  4. **Date display** (lines 710-714): Shows `displayedPlannedDate`
  5. **Edit button** (lines 719-736): Pre-fills with `displayedPlannedDate`

### Flow Diagram
```
User selects plan from dropdown
    ↓
handlePlanChange(planId) called
    ↓
setSelectedPlanId(planId)
    ↓
useEffect detects selectedPlanId change
    ↓
Finds plan in collaborativePlans
    ↓
setDisplayedPlannedDate(plan.planned_date)
    ↓
UI updates with new date
```

### Test Cases
- [ ] **Test 4.1**: Switch between plans
  - Setup: User has 2 plans with different dates
  - Action: Select Plan A → Select Plan B
  - Expected: Date changes from A's date to B's date
  
- [ ] **Test 4.2**: Switch from plan to experience
  - Setup: On My Plan tab with date
  - Action: Click "Experience Plan Items" tab
  - Expected: Shows experience planned date (if user added experience)
  
- [ ] **Test 4.3**: Edit date on plan
  - Setup: Viewing My Plan tab
  - Action: Click date button → Change date → Update
  - Expected: Plan's date updated, not experience date
  
- [ ] **Test 4.4**: Edit date on experience tab
  - Setup: Viewing Experience Plan Items tab
  - Action: Click date button → Change date → Update
  - Expected: Experience planned date updated (or adds experience)

### Edge Cases
- [ ] Plan has no date set
- [ ] Switch plans while date picker is open
- [ ] Update date immediately after switching plans
- [ ] Multiple rapid plan switches

---

## Integration Tests

### Test Suite A: Complete User Journey
1. [ ] User browses to experience (not owner)
2. [ ] Clicks "Plan Experience"
3. [ ] Sets planned date
4. [ ] Verifies "My Plan" tab appears instantly
5. [ ] Switches to My Plan tab
6. [ ] Verifies date matches selected date
7. [ ] Edits plan date
8. [ ] Switches to Experience Plan Items tab
9. [ ] Verifies date shows experience date (if added)
10. [ ] Switches back to My Plan
11. [ ] Verifies plan date still shows
12. [ ] Removes experience
13. [ ] Verifies My Plan tab disappears
14. [ ] Verifies plan deleted in backend

### Test Suite B: Collaborative Planning
1. [ ] User A creates plan for experience
2. [ ] User A adds User B as collaborator
3. [ ] User B sees "{User A}'s Plan" tab (after 30s or refresh)
4. [ ] User B switches to collaborative plan
5. [ ] User B sees User A's planned date
6. [ ] User B creates their own plan
7. [ ] Tab changes to "My Plan"
8. [ ] Dropdown shows "My Plan" first, "{User A}'s Plan" second
9. [ ] User B switches between plans
10. [ ] Dates update correctly for each plan

### Test Suite C: Experience Owner
1. [ ] Owner views their experience
2. [ ] No "My Plan" tab visible (uses experience plan items)
3. [ ] Owner edits plan items
4. [ ] Changes appear in Experience Plan Items
5. [ ] Other users' plans show sync button (if diverged)

---

## Regression Tests

### Existing Functionality
- [ ] Experience CRUD operations still work
- [ ] Plan item completion tracking works
- [ ] Photo uploads work
- [ ] Navigation between experiences works
- [ ] Destination linking works
- [ ] Experience deletion with active plans (transfer ownership)
- [ ] Sync button appears when plan diverges
- [ ] Collapse/expand parent items works
- [ ] Cost and planning days display correctly

### State Management
- [ ] No memory leaks from interval polling
- [ ] State clears properly on navigation
- [ ] Multiple rapid state updates don't cause issues
- [ ] Browser back/forward buttons work correctly

### Performance
- [ ] Page loads in < 2 seconds
- [ ] Plan switching is instant
- [ ] No unnecessary re-renders
- [ ] API calls are debounced/throttled where appropriate

---

## Known Issues / Future Improvements

1. **Polling for collaborative plans**: Currently polls every 30 seconds
   - Future: Implement WebSocket for real-time updates

2. **Add Plan Item for collaborators**: Not yet implemented
   - Requires new API endpoint and component

3. **Plan item photos**: Currently hidden in My Plan view
   - Future: Enable photo viewing/editing in plans

4. **Offline support**: No offline functionality
   - Future: Service worker for offline access

---

## Code Quality Checks

- [ ] No console errors in browser
- [ ] All TypeScript/ESLint warnings resolved
- [ ] Proper error handling for all API calls
- [ ] Loading states shown during async operations
- [ ] User-friendly error messages
- [ ] Proper cleanup in useEffect hooks
- [ ] No hardcoded values (use constants)
- [ ] Proper prop types and documentation
