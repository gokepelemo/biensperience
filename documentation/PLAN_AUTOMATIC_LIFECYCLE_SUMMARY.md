# Plan Automatic Lifecycle Implementation Summary

## Overview
Implemented automatic plan creation and deletion when users interact with the "Plan Experience" button, integrating the Plan model seamlessly with the existing experience planning flow.

## Changes Made

### 1. Frontend Integration (`src/views/SingleExperience/SingleExperience.jsx`)

#### Imports Added
```javascript
import {
  getUserPlans,
  createPlan,
  deletePlan,
} from "../../utilities/plans-api";
```

#### State Management
- `userPlan`: Stores the user's plan for the current experience (if exists)
- `activeTab`: Tracks active tab ("experience" or "myplan")

#### Function Updates

**`handleAddExperience()` - Lines 167-203**
- When non-owner plans experience:
  1. Calls `userAddExperience()` to add user to experience.users
  2. Calls `createPlan()` to create Plan instance with snapshot
  3. Calls `fetchUserPlan()` to refresh plan state
  4. Updates UI to show "My Plan" tab
- When owner plans experience:
  - Skips plan creation (owners use experience plan items directly)

**`handleExperience()` - Lines 142-179**
- When non-owner removes experience:
  1. Calls `userRemoveExperience()` to remove from experience.users
  2. Calls `deletePlan()` to delete Plan instance
  3. Removes contributor permission automatically
  4. Hides "My Plan" tab
- When owner removes experience:
  - Skips plan deletion (no separate plan exists)

**`fetchUserPlan()` - Lines 120-128**
- Fetches all user plans and finds the one for current experience
- Called on component mount and after plan operations
- Updates `userPlan` state

### 2. Backend Updates (`controllers/api/plans.js`)

#### `createPlan()` - Lines 12-89
- Creates point-in-time snapshot of experience plan items
- Adds user as **contributor** to experience (if not already owner/collaborator)
- Prevents duplicate plans (one per user per experience)
- Returns populated plan with experience and user details

#### `deletePlan()` - Lines 223-256
- Deletes Plan instance
- **Smart permission removal**:
  - Removes contributor permission ONLY if user is not owner/collaborator
  - Preserves higher-level permissions
- Atomic operation

### 3. API Utility (`src/utilities/plans-api.js`)
- Fixed import: Changed from default to named import `{ sendRequest }`
- All plan API functions ready for use

### 4. UI Components

#### Plan Navigation Tabs
- Added tab navigation above plan items
- "Experience Plan Items" tab (always visible)
- "My Plan" tab (visible only when user has plan)
- Styled with purple theme (#667eea)
- Responsive design (vertical tabs on mobile)

**CSS Classes** (`src/views/SingleExperience/SingleExperience.css`):
- `.plan-tabs-nav`: Tab container
- `.plan-tab-button`: Tab button styling
- `.plan-tab-button.active`: Active tab highlight
- `.my-plan-view`: My Plan content container

### 5. Testing (`tests/api/plans.test.js`)

Created comprehensive integration tests:
- ✅ Plan creation for non-owners
- ✅ No plan creation for owners
- ✅ Duplicate prevention
- ✅ Automatic contributor assignment
- ✅ Plan deletion with contributor removal
- ✅ Permission preservation for owners/collaborators
- ✅ Snapshot independence from experience changes

### 6. Documentation

Created three documentation files:
1. **PLAN_LIFECYCLE.md**: Detailed lifecycle documentation with diagrams
2. **Updated copilot-instructions.md**: Added Plan lifecycle section
3. **This summary document**: Implementation overview

## User Experience Flow

### Planning an Experience (Non-Owner)
```
1. User clicks "Plan Experience"
   ↓
2. Date picker appears (if required)
   ↓
3. User selects date or skips
   ↓
4. Frontend calls createPlan()
   ↓
5. Backend creates Plan + adds contributor permission
   ↓
6. "My Plan" tab appears
   ↓
7. User can view/edit their personal plan
```

### Unplanning an Experience (Non-Owner)
```
1. User clicks "Remove"
   ↓
2. Frontend calls deletePlan()
   ↓
3. Backend deletes Plan + removes contributor permission
   ↓
4. "My Plan" tab disappears
   ↓
5. Button changes back to "Plan Experience"
```

### Owner Behavior
- **Planning**: No separate Plan created (uses experience plan items)
- **Unplanning**: No Plan to delete
- **My Plan Tab**: Shows experience plan items directly (when implemented)

## Key Features

### Automatic Integration
- Plan creation/deletion happens automatically with existing user actions
- No new buttons or UI changes needed (uses existing "Plan Experience" button)
- Seamless integration with existing experience planning flow

### Owner Exception
- Experience owners don't get separate Plan instances
- Prevents duplication and maintains single source of truth
- Frontend checks `isOwner` before creating/deleting plans

### Smart Permission Management
- Contributor added on plan creation
- Contributor removed on plan deletion
- **Never removes** owner or collaborator permissions
- Handles edge cases gracefully

### Point-in-Time Snapshots
- Plan items are independent copies at creation time
- Changes to experience don't affect existing plans
- Changes to plans don't affect experience
- Each user gets their own planning sandbox

### UI Integration
- Tab navigation matches existing Profile page design
- "My Plan" tab only appears when plan exists
- Smooth tab switching with proper state management
- Responsive design for mobile devices

## API Endpoints Used

### New Endpoints (Already Existed)
- `POST /api/plans/experience/:experienceId` - Create plan
- `DELETE /api/plans/:id` - Delete plan
- `GET /api/plans` - Get user plans

### Existing Endpoints (Used)
- `POST /api/experiences/:experienceId/user/:userId` - Add user to experience
- `DELETE /api/experiences/:experienceId/user/:userId` - Remove user from experience

## Error Handling

### Frontend
- Optimistic UI updates
- Reverts changes on API errors
- Continues if plan operations fail (doesn't block experience operations)
- Error messages via `handleError()` utility

### Backend
- ObjectId validation
- Existence checks for experience/plan
- Permission validation
- Duplicate prevention
- Atomic operations

## Security

### Permission Checks
- Only plan owner can delete plan
- Only experience contributors can create plans
- Owner/collaborator status protected during deletion
- Dual ownership model (user field + permissions array)

### Data Integrity
- Unique constraint: one plan per user per experience
- Foreign key validation (experience must exist)
- Snapshot isolation (no cascading updates)

## Performance Considerations

### Optimizations
- Minimal API calls (bundled with existing operations)
- Efficient queries (indexed fields)
- Optimistic UI updates (perceived speed)
- Lazy loading of plans (only when needed)

### Database Operations
- Single snapshot creation per plan
- No N+1 queries (proper population)
- Indexed on user and experience fields

## Testing Strategy

### Unit Tests
- Individual function behavior
- Permission logic
- Snapshot creation
- Error handling

### Integration Tests
- Full plan lifecycle
- Permission preservation
- API endpoint behavior
- Edge cases

### Manual Testing
- [ ] Create plan as non-owner
- [ ] Remove plan as non-owner
- [ ] Verify "My Plan" tab appears/disappears
- [ ] Check contributor permission added/removed
- [ ] Verify owner doesn't create plan
- [ ] Test with existing plans
- [ ] Test error scenarios

## Build Status
✅ **Build successful** - No errors or warnings
- File: `build/static/js/main.37d2336e.js` (132.35 kB gzipped)
- All TypeScript/JSX compiled correctly
- No unused variables or imports

## Next Steps

### Immediate
1. Manual testing of plan lifecycle
2. Verify contributor permissions in database
3. Test edge cases (network errors, concurrent operations)

### Future Enhancements
1. **Plan View Implementation**: Full "My Plan" tab with completion tracking
2. **Collaborator Management**: Add/remove collaborators on plans
3. **Plan Analytics**: Track completion rates, costs, timing
4. **Plan Sharing**: Allow users to share completed plans
5. **Notifications**: Alert when collaborative plan items completed

## Files Modified

### Frontend
- `src/views/SingleExperience/SingleExperience.jsx` (3 functions updated)
- `src/views/SingleExperience/SingleExperience.css` (added tab styles)
- `src/utilities/plans-api.js` (fixed import)

### Backend
- `controllers/api/plans.js` (improved deletePlan logic)

### Testing
- `tests/api/plans.test.js` (new file, 266 lines)

### Documentation
- `documentation/PLAN_LIFECYCLE.md` (new file)
- `documentation/PLAN_AUTOMATIC_LIFECYCLE_SUMMARY.md` (this file)
- `.github/copilot-instructions.md` (updated)

## Dependencies
No new dependencies added - uses existing:
- React hooks (useState, useCallback, useEffect)
- Existing API utilities
- Existing error handling
- Existing permission system

## Backward Compatibility
✅ Fully backward compatible:
- Existing experience planning flow unchanged
- Dual ownership model maintained
- Legacy user field still populated
- No breaking changes to API

## Conclusion
Successfully implemented automatic plan lifecycle management that seamlessly integrates with the existing experience planning system. Plans are now automatically created and deleted when users interact with the "Plan Experience" button, with proper permission management and UI feedback.
