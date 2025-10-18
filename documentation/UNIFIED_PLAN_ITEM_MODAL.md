# Unified Plan Item Modal

## Overview
This document describes the unification of plan item management across both Experience Plan Items and My Plan tabs using a single, consistent modal interface.

## Problem Statement
Previously, the application had two different systems for managing plan items:
1. **Experience Plan Items**: Used the `NewPlanItem` component with an inline toggle form
2. **My Plan Items**: Used a modal dialog for adding/editing items

This inconsistency created:
- Poor UX with different interaction patterns
- Code duplication and maintenance overhead
- Confusion about which interface would appear

## Solution
Implemented a single, unified modal for all plan item operations across both tabs.

## Implementation Details

### 1. Unified Modal
**Location**: `SingleExperience.jsx` lines ~2248-2340

The modal now serves both contexts:
- **Experience Plan Items** (tab: "experience")
- **Plan Instance Items** (tab: "myplan")

**Key Features**:
- Single column layout with full-width fields
- Responsive design (modal-lg)
- Context-aware form submission
- Consistent styling across both tabs

### 2. Experience Plan Item Handlers

Added three new handlers for experience plan items:

#### `handleAddExperiencePlanItem(parentId)`
Opens modal to add a new item to the experience's plan_items array.
- If `parentId` is provided, creates a child item
- Sets `planItemFormState = 1` (add mode)

#### `handleEditExperiencePlanItem(planItem)`
Opens modal to edit an existing experience plan item.
- Populates modal with existing data
- Maps `cost_estimate` to `cost` for consistency
- Sets `planItemFormState = 0` (edit mode)

#### `handleSaveExperiencePlanItem(e)`
Saves changes to experience plan items.
- Adds new item: `POST /api/experiences/:id/plan-items`
- Updates existing: `PUT /api/experiences/:id/plan-items`
- Refreshes experience data after save

### 3. Plan Instance Item Handlers (Existing)

Retained existing handlers for plan instances:

#### `handleAddPlanInstanceItem(parentId)`
Opens modal to add item to the current plan instance.

#### `handleEditPlanInstanceItem(planItem)`
Opens modal to edit plan instance item.

#### `handleSavePlanInstanceItem(e)`
Saves changes to plan instance items via Plans API.

### 4. Context-Aware Form Submission

The modal form dynamically selects the correct handler:

```jsx
<form 
  id="planItemForm" 
  className="plan-item-modal-form" 
  onSubmit={activeTab === "experience" 
    ? handleSaveExperiencePlanItem 
    : handleSavePlanInstanceItem
  }
>
```

This ensures:
- Experience tab saves to experience.plan_items
- My Plan tab saves to plan instance items

### 5. UI Updates

#### Experience Plan Items Tab
**Before**:
```jsx
<NewPlanItem 
  formVisible={formVisible}
  setFormVisible={setFormVisible}
  ...
/>
```

**After**:
```jsx
<button
  className="btn btn-primary"
  onClick={() => handleAddExperiencePlanItem()}
>
  {lang.en.button.addPlanItem}
</button>
```

**Add Child Button**:
```jsx
onClick={() => handleAddExperiencePlanItem(planItem._id)}
```

**Edit Button**:
```jsx
onClick={() => handleEditExperiencePlanItem(planItem)}
```

#### My Plan Tab
Added new "Add Plan Item" button alongside "Add Collaborator":

```jsx
<div className="d-flex justify-content-between mb-3">
  {canEdit && (
    <button
      className="btn btn-primary"
      onClick={() => handleAddPlanInstanceItem()}
    >
      {lang.en.button.addPlanItem}
    </button>
  )}
  {isPlanOwner && (
    <button
      className="btn btn-outline-primary"
      onClick={() => setShowCollaboratorModal(true)}
    >
      Add Collaborator
    </button>
  )}
</div>
```

**Visibility Logic**:
- **Add Plan Item**: Shown to plan owners and collaborators
- **Add Collaborator**: Shown only to plan owners

### 6. API Integration

#### Experience API
Added imports for experience plan item operations:
```javascript
import {
  addPlanItem as addExperiencePlanItem,
  updatePlanItem as updateExperiencePlanItem,
} from "../../utilities/experiences-api";
```

#### Plans API
Existing imports for plan instance operations:
```javascript
import {
  updatePlanItem,
  addPlanItem as addPlanItemToInstance,
  deletePlanItem as deletePlanItemFromInstance,
} from "../../utilities/plans-api";
```

### 7. Field Mapping

**Experience Plan Items** use:
- `cost_estimate` (backend field)
- Maps to `cost` in modal for consistency

**Plan Instance Items** use:
- `cost` (backend field)
- Directly used in modal

The modal internally uses `cost`, and handlers map appropriately.

### 8. Removed Components & State

**Removed**:
- `NewPlanItem` component import
- `formState` state variable
- `formVisible` state variable
- `newPlanItem` state variable
- `handlePlanEdit` function (replaced by `handleEditExperiencePlanItem`)

**Result**: 
- Reduced bundle size by 574 bytes
- Cleaner component architecture
- Less state to manage

## Benefits

### 1. Consistency
✅ Same UI for adding/editing items across all contexts
✅ Predictable user experience
✅ Single source of truth for plan item forms

### 2. Code Quality
✅ Eliminated code duplication
✅ Removed unused state and components
✅ Cleaner, more maintainable codebase

### 3. User Experience
✅ Professional modal dialog interface
✅ Responsive design adapts to screen size
✅ Clear context (tab determines behavior)
✅ Centered, grouped action buttons

### 4. Maintainability
✅ Single modal to update for UI changes
✅ Clear separation of experience vs plan logic
✅ Consistent API patterns

## Testing Checklist

### Experience Plan Items Tab
- [ ] Add top-level plan item
- [ ] Add child plan item
- [ ] Edit plan item
- [ ] Delete plan item
- [ ] Verify items save to experience.plan_items

### My Plan Tab
- [ ] Add top-level plan item (plan owner)
- [ ] Add child plan item (plan owner)
- [ ] Edit plan item (plan owner)
- [ ] Edit plan item (plan collaborator)
- [ ] Delete plan item (plan owner)
- [ ] Verify items save to plan instance
- [ ] Verify Add Plan Item button shows for collaborators
- [ ] Verify Add Collaborator button only shows for owner

### Modal Behavior
- [ ] Modal opens with correct title (Add vs Edit)
- [ ] Fields populate correctly in edit mode
- [ ] Form validates required fields
- [ ] Submit button disables without required data
- [ ] Modal closes after successful save
- [ ] Error handling works correctly
- [ ] Cancel button closes modal without saving

### Responsive Design
- [ ] Modal displays correctly on desktop (800px wide)
- [ ] Modal displays correctly on tablet (full width with margins)
- [ ] Modal displays correctly on mobile (full width)
- [ ] Buttons remain centered on all screen sizes

## Related Documentation
- [Plan Model Implementation](./PLAN_MODEL_IMPLEMENTATION.md)
- [Plan Lifecycle](./PLAN_LIFECYCLE.md)
- [Experience Users Refactor](./EXPERIENCE_USERS_REFACTOR.md)

## Deployment
- **Build**: Successful (bundle size reduced)
- **Date**: October 12, 2025
- **Bundle Change**: -574 bytes total (-512 JS, -62 CSS)
- **Status**: ✅ Deployed to production
