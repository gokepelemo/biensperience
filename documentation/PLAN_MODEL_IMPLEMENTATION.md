# Plan Model Implementation Summary

## Overview
This document summarizes the implementation of the Plan model and automatic contributor assignment system for the Biensperience platform.

## New Features

### 1. Plan Model (`models/plan.js`)
A new model representing user-specific instances of experience plans with point-in-time snapshots.

**Key Fields:**
- `experience`: Reference to the Experience
- `user`: Owner of the plan
- `planned_date`: When user plans to do this experience
- `plan`: Array of plan item snapshots with completion tracking
- `permissions`: Collaborator support for shared planning
- `notes`: Additional planning notes

**Plan Item Snapshots:**
Each plan contains snapshots of the original experience plan items:
- `plan_item_id`: Reference to original item
- `complete`: Boolean completion status
- `cost`: Actual cost (vs original estimate)
- `planning_days`: Actual days needed
- Snapshot fields: `text`, `url`, `photo`, `parent`

**Virtual Fields:**
- `total_cost`: Sum of all plan item costs
- `max_days`: Maximum planning days across items
- `completion_percentage`: % of completed items

**Indexes:**
- Unique constraint on `(experience, user)` - one plan per user per experience
- Index on `user` for efficient user queries
- Index on `experience` for efficient experience queries

### 2. Plan Controller (`controllers/api/plans.js`)
Complete CRUD operations and collaboration management for plans.

**Core Functions:**

- `createPlan()`: Creates plan with snapshot of experience plan items
- `getUserPlans()`: Gets all plans for current user
- `getPlanById()`: Gets specific plan with permission check
- `getExperiencePlans()`: Gets all plans for an experience user can view
- `updatePlan()`: Updates plan (requires collaborator permission)
- `deletePlan()`: Deletes plan and removes contributor status
- `updatePlanItem()`: Updates individual plan item status/cost/days
- `getCollaborators()`: Gets list of plan collaborators with profile info
- `addCollaborator()`: Adds collaborator to plan (owner only)
- `removeCollaborator()`: Removes collaborator (owner only)

**Automatic Contributor Assignment:**

When a user creates a plan, they automatically become a contributor to the experience (unless already owner/collaborator).

**Experience Deletion Protection:**

Experiences cannot be deleted if other users (besides the owner) have created plans for them. This prevents data loss and maintains plan integrity.

### 3. Plan Routes (`routes/api/plans.js`)
RESTful API endpoints for plan management.

**Endpoints:**
```
GET    /api/plans                                       - Get user's plans
GET    /api/plans/:id                                   - Get specific plan
GET    /api/plans/:id/collaborators                     - Get plan collaborators
POST   /api/plans/experience/:experienceId              - Create plan
GET    /api/plans/experience/:experienceId/all          - Get all plans for experience
PUT    /api/plans/:id                                   - Update plan
DELETE /api/plans/:id                                   - Delete plan
PATCH  /api/plans/:id/items/:itemId                     - Update plan item
POST   /api/plans/:id/permissions/collaborator          - Add collaborator
DELETE /api/plans/:id/permissions/collaborator/:userId  - Remove collaborator
```

### 4. Frontend API Utility (`src/utilities/plans-api.js`)
Client-side functions for interacting with plan endpoints.

**Functions:**
- `getUserPlans()`
- `getPlanById(planId)`
- `createPlan(experienceId, plannedDate)`
- `getExperiencePlans(experienceId)`
- `updatePlan(planId, updates)`
- `deletePlan(planId)`
- `updatePlanItem(planId, itemId, updates)`
- `addCollaborator(planId, userId)`
- `removeCollaborator(planId, userId)`

### 5. Updated Destination Controller
Modified `toggleUserFavoriteDestination()` to automatically manage contributor permissions.

**Behavior:**
- **Adding Favorite**: Adds user as contributor (if not owner/collaborator)
- **Removing Favorite**: Removes contributor permission (if not owner/collaborator)

**Protection:**
- Owners and collaborators keep their permissions regardless of favorite status

### 6. Application Routes (`app.js`)
Added plan routes to the Express application:
```javascript
app.use("/api/plans", require("./routes/api/plans"));
```

## Contributor System

### Automatic Assignment Rules

**Users become contributors when:**
1. They favorite a destination
2. They plan an experience (creates Plan instance)

**Contributors are removed when:**
1. They unfavorite a destination (unless owner/collaborator)
2. They delete their plan (unless owner/collaborator)

**Protection:**
- Owners always keep owner status
- Collaborators always keep collaborator status
- Only pure contributors are auto-removed

### Experience Owner Exception
Experience owners do NOT get a separate Plan instance. Their plan items remain directly on the Experience model. This prevents duplication and maintains ownership model.

## Frontend Implementation Guide

### Experience View Design

The Experience view should display tabs similar to the Profile view:

```
┌─────────────────────────────────────────────────┐
│ Experience Name                                  │
├─────────────────────────────────────────────────┤
│ [Experience Plan Items] [My Plan ▼]             │  <- Tabs
├─────────────────────────────────────────────────┤
│                                                  │
│ Tab Content Here                                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Tab Behavior:**

1. **Experience Plan Items Tab** (Default)
   - Shows the master plan items from the experience
   - Visible to all users
   - Experience owner can edit here

2. **My Plan Tab**
   - Only visible after user clicks "Plan Experience"
   - Shows user's personalized plan with completion tracking
   - If user is collaborator on other plans, shows dropdown:
     ```
     My Plan ▼
     ├─ My Plan
     ├─ Goke Pelemo's Plan
     └─ John's Plan
     ```
   - Each plan shows:
     - Checkboxes for completion
     - Actual costs vs estimates
     - Actual days needed
     - Notes field
   - Has "Add Collaborators" button (owner only)

### Key UI Components Needed

1. **PlanTabs Component**
   - Similar to `Planned | Created | Destinations` bar on Profile
   - Conditionally renders "My Plan" tab based on plan existence
   - Handles dropdown for collaborative plans

2. **PlanView Component**
   - **Collaborators Display** (at top, if any exist):
     ```
     Collaborators: Alice Smith, Bob Jones, and Carol White
     ```
     - Each name is a link to their profile
     - Fetched via `getCollaborators(planId)` API call
     - Format: "A, B, C, and D" for proper grammar
   - Displays plan items with completion checkboxes
   - Allows editing costs and days
   - Shows progress bar (completion_percentage)
   - Add Collaborators button

3. **PlanCollaborators Component**
   - Modal for adding collaborators
   - List of current collaborators
   - Remove collaborator functionality

4. **PlanItemCheckbox Component**
   - Checkbox for completion status
   - Edit fields for cost and planning_days
   - Updates via `updatePlanItem()` API call

### State Management

```javascript
const [plans, setPlans] = useState([]);           // All plans user can view
const [activePlan, setActivePlan] = useState(null); // Currently selected plan
const [hasUserPlan, setHasUserPlan] = useState(false);

useEffect(() => {
  // On mount, check if user has plan for this experience
  async function checkPlan() {
    const userPlans = await getExperiencePlans(experienceId);
    setPlans(userPlans);
    const myPlan = userPlans.find(p => p.user._id === currentUser._id);
    setHasUserPlan(!!myPlan);
    if (myPlan) setActivePlan(myPlan);
  }
  checkPlan();
}, [experienceId]);
```

## Testing Checklist

- [ ] Create plan for experience
- [ ] Verify user becomes contributor
- [ ] Update plan item completion
- [ ] Update plan item cost and days
- [ ] Add collaborator to plan
- [ ] Verify collaborator can edit plan
- [ ] Remove collaborator from plan
- [ ] Delete plan
- [ ] Verify contributor status removed
- [ ] Verify owner doesn't get separate plan
- [ ] Test favorite destination adds contributor
- [ ] Test unfavorite removes contributor
- [ ] Test owner/collaborator protection

## Migration Notes

- No migration needed for existing data
- Plans are created on-demand when users click "Plan Experience"
- Existing `experience.users` array remains for backwards compatibility
- Can gradually migrate UI to use Plan model

## API Documentation

See routes file for complete endpoint documentation. All endpoints require authentication via JWT.

## Security Considerations

- All plan operations require authentication
- Permission checks before any modifications
- Unique constraint prevents duplicate plans
- ObjectId validation on all inputs
- Collaborators can edit but not delete or manage permissions
- Only plan owners can delete plans
