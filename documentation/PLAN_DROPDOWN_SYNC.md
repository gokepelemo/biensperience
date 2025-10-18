# Plan Dropdown and Sync Feature Documentation

## Overview
This feature enhances the "My Plan" tab with:
1. **Dropdown selector** to view different plans for the same experience (user's own plan + collaborative plans)
2. **Sync button** that appears when a plan has diverged from the experience plan items

## Features

### 1. Plan Dropdown

#### Purpose
Allows users to switch between different plans for the same experience:
- Their own plan
- Plans they collaborate on with other users

#### Behavior
- Dropdown appears when user has access to multiple plans for the experience
- Shows user's plan as "My Plan"
- Shows other plans as "[Owner Name]'s Plan"
- Automatically selects user's own plan by default
- Clicking a plan switches the view to that plan's details

#### Access Control
Users can only see plans where they are:
- The owner (their own plan)
- A collaborator (added by the plan owner)

### 2. Sync Button

#### Purpose
Updates a plan that has diverged from the experience's current plan items.

#### When It Appears
The sync button shows when the experience plan has changed since the plan was created:
- Items added to experience
- Items removed from experience
- Item text, URL, cost, or planning days changed

#### Divergence Detection
Checks if:
- Number of plan items differs
- Any plan item has been deleted from experience
- Text content has changed
- URL has changed
- Cost estimate has changed
- Planning days have changed

#### Sync Behavior
When clicked, the sync button:
1. Creates a new snapshot from current experience plan items
2. **Preserves user data**:
   - Completion status (complete/incomplete)
   - Actual costs (if user modified them)
   - Actual planning days (if user modified them)
3. Updates plan with new items and changed fields
4. Refreshes the plan view
5. Hides the sync button (plan is now in sync)

#### UX
- Shows warning alert with explanation
- Button displays "Syncing..." during operation
- Disabled during sync operation
- Success is silent (button disappears)

## User Interface

### Plan Dropdown
```
┌─────────────────────────────────────────┐
│ [Experience Plan Items] [My Plan ▼]     │
│                         └─ My Plan      │
│                            Alice's Plan  │
│                            Bob's Plan    │
└─────────────────────────────────────────┘
```

### Sync Button
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Plan out of sync!                                 │
│ The experience plan has changed since you created   │
│ this plan. Click sync to update your plan with the  │
│ latest items.                    [Sync Plan] button │
└─────────────────────────────────────────────────────┘
```

### Plan View
```
┌─────────────────────────────────────────┐
│ My Plan (or "Alice's Plan")             │
├─────────────────────────────────────────┤
│ Planned Date: Dec 25, 2025              │
│ Total Cost: $450                        │
│ Completion: 60%                         │
│ Max Planning Days: 7 days               │
├─────────────────────────────────────────┤
│ Plan Items                              │
│                                         │
│ ☑ Book Flight          Cost: $200       │
│                        Days: 2          │
│   ☐ ↳ Compare prices   Cost: $0         │
│   ☑ ↳ Reserve seat     Cost: $50        │
│                                         │
│ ☐ Book Hotel           Cost: $150       │
│                        Days: 1          │
└─────────────────────────────────────────┘
```

## Implementation Details

### Frontend (`SingleExperience.jsx`)

#### New State Variables
```javascript
const [collaborativePlans, setCollaborativePlans] = useState([]);
const [selectedPlanId, setSelectedPlanId] = useState(null);
const [showSyncButton, setShowSyncButton] = useState(false);
```

#### New Functions

**`fetchCollaborativePlans()`**
- Fetches all plans for the experience that user can view
- Filters to only show plans where user is owner or collaborator
- Updates `collaborativePlans` state

**`checkPlanDivergence(plan, experience)`**
- Compares plan snapshot with current experience plan items
- Returns `true` if plan has diverged
- Checks item count, deletions, and field changes

**`handleSyncPlan()`**
- Creates new plan snapshot from experience plan items
- Preserves completion status and user-modified costs/days
- Updates plan via API
- Refreshes plan data

**`handlePlanChange(planId)`**
- Updates `selectedPlanId` when user selects different plan from dropdown
- Triggers re-render with selected plan's data

#### Effects

**Divergence Check Effect**
```javascript
useEffect(() => {
  if (selectedPlanId && collaborativePlans.length > 0 && experience) {
    const currentPlan = collaborativePlans.find(p => p._id === selectedPlanId);
    if (currentPlan) {
      const hasDiverged = checkPlanDivergence(currentPlan, experience);
      setShowSyncButton(hasDiverged);
    }
  }
}, [selectedPlanId, collaborativePlans, experience, checkPlanDivergence]);
```

### API Integration

#### Endpoints Used
- `GET /api/plans/experience/:experienceId/all` - Get all plans for experience
- `PUT /api/plans/:id` - Update plan with new snapshot

#### Data Flow
```
1. Component mounts
   ↓
2. fetchCollaborativePlans() called
   ↓
3. API returns all accessible plans
   ↓
4. Plans filtered by permissions
   ↓
5. User selects plan from dropdown
   ↓
6. checkPlanDivergence() runs
   ↓
7. Sync button shows if diverged
   ↓
8. User clicks sync
   ↓
9. handleSyncPlan() updates plan
   ↓
10. Plans refreshed, button hidden
```

### CSS Styling

#### Dropdown Styles
- `.plan-tab-dropdown-container` - Flex container for button and dropdown
- `.plan-dropdown` - Styled select element with purple theme
- Hover and focus states for accessibility

#### Plan View Styles
- `.plan-items-list` - Container for plan items
- `.my-plan-view .plan-item-card` - Individual plan item cards
- Checkbox styling for completion status
- Child item indentation with arrow (↳)
- Responsive layout

## Edge Cases Handled

### 1. No Collaborative Plans
- Dropdown doesn't appear
- Just shows "My Plan" button as before

### 2. Only One Plan
- Dropdown doesn't appear (no other plans to switch to)

### 3. Plan Not Found
- Shows "Plan not found" message
- Graceful degradation

### 4. Missing Plan Items
- Shows "No plan items yet" message
- Handles empty plan array

### 5. Sync During Loading
- Button shows "Syncing..." text
- Disabled state prevents duplicate clicks
- Loading state managed

### 6. Network Errors
- Errors caught and handled via `handleError()`
- Loading state reset
- User-friendly error messages

### 7. Preserving User Data
- Completion status preserved during sync
- Modified costs preserved
- Modified planning days preserved
- Only item structure and defaults updated

## Security Considerations

### Permission Checks
- Backend validates user has permission to view plan
- Frontend filters to only show accessible plans
- Owner and collaborator checks in place

### Data Validation
- Plan ID validated before sync
- Experience existence checked
- Plan existence checked
- ObjectId validation on backend

## Performance Optimizations

### Memoization
- `checkPlanDivergence` wrapped in `useCallback`
- `handleSyncPlan` wrapped in `useCallback`
- `handlePlanChange` wrapped in `useCallback`

### Efficient Updates
- Only fetches plans when needed
- Divergence check only runs when dependencies change
- Sync button hidden immediately after sync

### API Calls
- Single call to get all collaborative plans
- Batch update for sync (not per-item)
- Optimistic UI updates where possible

## Testing Checklist

### Manual Testing
- [ ] Dropdown appears with multiple plans
- [ ] Dropdown doesn't appear with single plan
- [ ] Can switch between plans
- [ ] Plan details update correctly
- [ ] Sync button appears when plan diverged
- [ ] Sync button hidden when plan in sync
- [ ] Sync preserves completion status
- [ ] Sync preserves modified costs
- [ ] Sync updates changed items
- [ ] Sync adds new items
- [ ] Loading state shows during sync
- [ ] Error handling works
- [ ] Responsive design on mobile

### Integration Testing
```javascript
// Test divergence detection
test('detects divergence when item added', () => {
  const plan = { plan: [{ plan_item_id: '1', text: 'Item 1' }] };
  const experience = { plan_items: [
    { _id: '1', text: 'Item 1' },
    { _id: '2', text: 'Item 2' }
  ]};
  expect(checkPlanDivergence(plan, experience)).toBe(true);
});

// Test divergence detection for changed items
test('detects divergence when item text changed', () => {
  const plan = { plan: [{ plan_item_id: '1', text: 'Original' }] };
  const experience = { plan_items: [{ _id: '1', text: 'Modified' }] };
  expect(checkPlanDivergence(plan, experience)).toBe(true);
});
```

## Future Enhancements

### Short-term
1. Real-time sync notifications (WebSocket)
2. Conflict resolution UI for simultaneous edits
3. Sync history/changelog
4. Bulk completion toggle

### Long-term
1. Merge plans from different users
2. Plan templates from synced plans
3. Analytics on sync frequency
4. Auto-sync option (background)
5. Diff view before sync

## Accessibility

### Keyboard Navigation
- Dropdown accessible via Tab key
- Arrow keys navigate options
- Enter/Space to select
- Sync button focusable and clickable

### Screen Readers
- ARIA labels for dropdown
- Button states announced
- Plan names clearly identified
- Completion status announced

### Visual Indicators
- Clear visual hierarchy
- High contrast colors
- Focus states visible
- Loading states clear

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Responsive design for all screen sizes
- CSS Grid and Flexbox support required

## Build Information
- Added ~1.12 KB to main bundle (gzipped)
- Added ~154 B to CSS bundle
- No new dependencies
- Backward compatible

## Related Documentation
- PLAN_LIFECYCLE.md - Plan creation/deletion
- PLAN_MODEL_IMPLEMENTATION.md - Plan model structure
- ADDITIONAL_PLAN_FEATURES.md - Other plan features
