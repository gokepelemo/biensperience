# Language Constants Guide (lang.constants.js)

## Overview

The `lang.constants.js` file serves as the **centralized repository for all user-facing text strings** in the Biensperience application. This approach follows the **DRY (Don't Repeat Yourself)** principle and provides a foundation for internationalization (i18n) if needed in the future.

## Table of Contents

1. [Purpose & Benefits](#purpose--benefits)
2. [File Structure](#file-structure)
3. [String Categories](#string-categories)
4. [Usage Patterns](#usage-patterns)
5. [Best Practices](#best-practices)
6. [Adding New Strings](#adding-new-strings)
7. [Dynamic String Replacement](#dynamic-string-replacement)
8. [Examples](#examples)

---

## Purpose & Benefits

### Why Centralize Strings?

1. **Single Source of Truth**: All text in one place makes updates easier
2. **Consistency**: Ensures the same wording across the entire application
3. **Maintainability**: Change text once, applies everywhere
4. **Internationalization Ready**: Easy to add translations (Spanish, French, etc.)
5. **Searchability**: Find all instances of specific text quickly
6. **Code Cleanliness**: Removes hardcoded strings from components

### What Should Be in lang.constants.js?

✅ **Include**:
- Button labels and text
- Alert messages
- Modal titles and content
- Form labels and placeholders
- Helper text and instructions
- Navigation items
- Table headers
- Tooltips and titles
- Success/error messages
- Empty state messages

❌ **Exclude**:
- User-generated content
- Data from the database
- Dynamic values (numbers, dates, etc.)
- API endpoints
- Configuration values
- Code comments

---

## File Structure

```javascript
const en = {
  button: { /* ... */ },
  alert: { /* ... */ },
  modal: { /* ... */ },
  heading: { /* ... */ },
  label: { /* ... */ },
  placeholder: { /* ... */ },
  helper: { /* ... */ },
  message: { /* ... */ },
  nav: { /* ... */ },
  table: { /* ... */ },
  image: { /* ... */ },
  viewMeta: { /* ... */ },
  console: { /* ... */ },
  tooltip: { /* ... */ },
};

const languages = { en };

// Getter functions
const getCurrentLanguage = () => {
  return process.env.REACT_APP_LANG || "en";
};

const getLang = () => {
  const currentLang = getCurrentLanguage();
  return languages[currentLang] || languages.en;
};

// Export
const lang = {
  get current() {
    return getLang();
  },
  en: languages.en,
};

module.exports = { lang, getCurrentLanguage, getLang };
```

---

## String Categories

### 1. `button` - Button Labels & Text

Contains all button labels including action buttons, navigation buttons, and state-specific text.

**Examples**:
```javascript
button: {
  add: "Add",
  cancel: "Cancel",
  delete: "Delete",
  syncNow: "🔄 Sync Now",
  syncing: "Syncing...",
  markComplete: "👍 Mark Complete",
}
```

**Usage**:
```jsx
<button onClick={handleSync}>
  {loading ? lang.en.button.syncing : lang.en.button.syncNow}
</button>
```

---

### 2. `alert` - Alert Messages & Notifications

All alert messages, warnings, success messages, and informational text boxes.

**Examples**:
```javascript
alert: {
  planOutOfSync: "Plan Out of Sync",
  planOutOfSyncMessage: "The experience plan has changed...",
  noChangesDetected: "No changes detected.",
  planNotFound: "Plan not found.",
}
```

**Usage**:
```jsx
<div className="alert alert-warning">
  <strong>{lang.en.alert.planOutOfSync}</strong>
  <p>{lang.en.alert.planOutOfSyncMessage}</p>
</div>
```

---

### 3. `modal` - Modal Titles & Content

Titles, messages, and content for all modal dialogs.

**Examples**:
```javascript
modal: {
  confirmDelete: "Delete Experience",
  confirmDeleteMessage: "Are you sure you want to delete '{name}'?",
  syncPlanTitle: "Sync Plan with Experience",
}
```

**Usage**:
```jsx
<Modal
  title={lang.en.modal.syncPlanTitle}
  onConfirm={handleConfirm}
>
  {/* Modal content */}
</Modal>
```

---

### 4. `heading` - Page & Section Headings

Headings for pages, sections, and UI groups.

**Examples**:
```javascript
heading: {
  createExperience: "Create an Experience",
  travelTips: "Travel Tips",
  thePlan: "The Plan",
  myPlan: "My Plan",
}
```

**Usage**:
```jsx
<h2>{lang.en.heading.thePlan}</h2>
```

---

### 5. `label` - Form Labels & Field Names

Labels for form inputs, data fields, and UI elements.

**Examples**:
```javascript
label: {
  destinationLabel: "Destination",
  costEstimate: "Cost Estimate ($)",
  plannedDate: "Planned Date",
  collaborators: "Collaborators:",
}
```

**Usage**:
```jsx
<label htmlFor="cost">{lang.en.label.costEstimate}</label>
```

---

### 6. `placeholder` - Input Placeholders

Placeholder text for form inputs.

**Examples**:
```javascript
placeholder: {
  email: "Email Address",
  experienceName: "e.g. Brewery Tour at Lakefront Brewery...",
  costEstimate: "ex. 350",
}
```

**Usage**:
```jsx
<input
  type="text"
  placeholder={lang.en.placeholder.experienceName}
/>
```

---

### 7. `helper` - Helper Text & Instructions

Instructional text, hints, and helpful guidance.

**Examples**:
```javascript
helper: {
  nameRequired: "Give your experience an exciting name...",
  requiresDaysToPlan: "Heads up! This experience needs at least {days} days...",
  map: "map",
}
```

**Usage**:
```jsx
<small className="text-muted">
  {lang.en.helper.nameRequired}
</small>
```

---

### 8. `message` - General Messages

User-facing messages that don't fit other categories.

**Examples**:
```javascript
message: {
  noPhotoMessage: "No profile photo yet. ",
  noExperiencesYet: "No experiences planned yet. ",
  peoplePlanningExperience: "{count} people are planning this experience",
}
```

**Usage**:
```jsx
<p>{lang.en.message.noExperiencesYet}</p>
```

---

### 9. `nav` - Navigation Items

Navigation menu items and links.

**Examples**:
```javascript
nav: {
  login: "Login",
  destinations: "Destinations",
  experiences: "Experiences",
}
```

**Usage**:
```jsx
<NavLink to="/experiences">{lang.en.nav.experiences}</NavLink>
```

---

### 10. `tooltip` - Tooltips & Title Attributes

Tooltip text and title attributes for hover states.

**Examples**:
```javascript
tooltip: {
  syncPlan: "Sync your plan with the latest experience changes",
  setPlannedDate: "Click to set a planned date",
  edit: "Edit",
  delete: "Delete",
}
```

**Usage**:
```jsx
<button title={lang.en.tooltip.edit}>✏️</button>
```

---

## Usage Patterns

### Basic Usage

Import the lang object at the top of your component:

```javascript
import { lang } from "../../lang.constants";
```

Access strings using dot notation:

```javascript
const buttonText = lang.en.button.add;
```

### In JSX

```jsx
<button>{lang.en.button.create}</button>
<h1>{lang.en.heading.createExperience}</h1>
<input placeholder={lang.en.placeholder.email} />
```

### In Conditionals

```jsx
{loading ? lang.en.button.syncing : lang.en.button.syncNow}
```

### In Component Props

```jsx
<Modal
  title={lang.en.modal.confirmDelete}
  confirmText={lang.en.button.delete}
/>
```

### In String Concatenation

```jsx
aria-label={`${lang.en.button.edit} ${itemName}`}
```

---

## Dynamic String Replacement

Many strings contain placeholders for dynamic values. Use `.replace()` to substitute them:

### Single Placeholder

```javascript
// String: "Heads up! This experience needs at least {days} days..."
const message = lang.en.helper.requiresDaysToPlan.replace("{days}", daysCount);
```

### Multiple Placeholders

```javascript
// String: "Added {count} collaborator{plural}:"
const message = lang.en.alert.addedCollaborators
  .replace("{count}", count)
  .replace("{plural}", count > 1 ? "s" : "");
```

### Common Placeholders

- `{name}` - User or item name
- `{count}` - Numeric count
- `{plural}` - Plural suffix ("" or "s")
- `{days}` - Number of days
- `{context}` - Context-specific text (e.g., "experience", "plan")
- `{type}` - Type of item

---

## Best Practices

### 1. Always Use Constants, Never Hardcode

❌ **Bad**:
```jsx
<button>Save Changes</button>
<div className="alert">Plan not found</div>
```

✅ **Good**:
```jsx
<button>{lang.en.button.save}</button>
<div className="alert">{lang.en.alert.planNotFound}</div>
```

### 2. Descriptive Key Names

❌ **Bad**:
```javascript
button: {
  btn1: "Save",
  text2: "Cancel",
}
```

✅ **Good**:
```javascript
button: {
  save: "Save",
  cancel: "Cancel",
}
```

### 3. Group Related Strings

Keep strings organized by their function and location in the UI.

```javascript
// Group experience-related buttons together
button: {
  addExperience: "Add Experience",
  editExperience: "Edit Experience",
  deleteExperience: "Delete Experience",
}
```

### 4. Use Placeholders for Dynamic Content

❌ **Bad**:
```javascript
// Creating dynamic strings in components
message: `${count} people are planning`
```

✅ **Good**:
```javascript
// In lang.constants.js
message: {
  peoplePlanning: "{count} people are planning",
}

// In component
lang.en.message.peoplePlanning.replace("{count}", count)
```

### 5. Keep Strings Readable

Include emojis, formatting, and natural language:

```javascript
button: {
  syncNow: "🔄 Sync Now",  // Include emoji in constant
  markComplete: "👍 Mark Complete",
}
```

### 6. Document Complex Patterns

Add comments for strings with multiple placeholders:

```javascript
alert: {
  // Placeholders: {count}, {plural} (use "" or "s")
  addedCollaborators: "Added {count} collaborator{plural}:",
}
```

---

## Adding New Strings

### Step 1: Identify the Category

Determine which category your string belongs to:
- Is it a button? → `button`
- Is it an alert message? → `alert`
- Is it a form label? → `label`
- etc.

### Step 2: Choose a Descriptive Key

Use camelCase and be specific:

```javascript
// Good key names
syncPlan
planNotFound
addCollaborator
removeExperience
```

### Step 3: Add to lang.constants.js

Add your string to the appropriate category:

```javascript
alert: {
  // ... existing strings
  newAlertMessage: "Your new alert message here",
},
```

### Step 4: Update Your Component

Replace the hardcoded string:

```jsx
// Before
<div>Your new alert message here</div>

// After
<div>{lang.en.alert.newAlertMessage}</div>
```

### Step 5: Test

Verify the string appears correctly in your UI.

---

## Examples

### Example 1: Button with Loading State

**lang.constants.js**:
```javascript
button: {
  save: "Save Changes",
  saving: "Saving...",
}
```

**Component**:
```jsx
<button disabled={loading}>
  {loading ? lang.en.button.saving : lang.en.button.save}
</button>
```

---

### Example 2: Alert with Dynamic Content

**lang.constants.js**:
```javascript
alert: {
  itemsAdded: "{count} items added successfully",
}
```

**Component**:
```jsx
const message = lang.en.alert.itemsAdded.replace("{count}", items.length);
<div className="alert alert-success">{message}</div>
```

---

### Example 3: Pluralization

**lang.constants.js**:
```javascript
message: {
  collaborators: "{count} collaborator{plural}",
}
```

**Component**:
```jsx
const count = collaborators.length;
const message = lang.en.message.collaborators
  .replace("{count}", count)
  .replace("{plural}", count === 1 ? "" : "s");
```

---

### Example 4: Tooltip on Icon Button

**lang.constants.js**:
```javascript
tooltip: {
  edit: "Edit",
  delete: "Delete",
}
```

**Component**:
```jsx
<button
  className="btn btn-sm"
  onClick={handleEdit}
  title={lang.en.tooltip.edit}
  aria-label={`${lang.en.tooltip.edit} ${itemName}`}
>
  ✏️
</button>
```

---

### Example 5: Modal with Multiple Strings

**lang.constants.js**:
```javascript
modal: {
  confirmDelete: "Confirm Deletion",
  confirmDeleteMessage: "Are you sure you want to delete '{name}'?",
},
button: {
  delete: "Delete",
  cancel: "Cancel",
}
```

**Component**:
```jsx
<ConfirmModal
  show={showModal}
  title={lang.en.modal.confirmDelete}
  message={lang.en.modal.confirmDeleteMessage.replace("{name}", itemName)}
  confirmText={lang.en.button.delete}
  cancelText={lang.en.button.cancel}
  onConfirm={handleDelete}
/>
```

---

## Future Internationalization

The current structure is designed to easily support multiple languages:

### Current Structure:
```javascript
const en = { /* English strings */ };
const languages = { en };
```

### Future Structure:
```javascript
const en = { /* English strings */ };
const es = { /* Spanish strings */ };
const fr = { /* French strings */ };

const languages = { en, es, fr };

// Auto-detect or set language
const getCurrentLanguage = () => {
  return localStorage.getItem('userLang') || 
         navigator.language.split('-')[0] || 
         'en';
};
```

### Component Usage (Same!):
```jsx
// No changes needed in components
<button>{lang.en.button.save}</button>

// Or use dynamic getter for current language
<button>{lang.current.button.save}</button>
```

---

## Troubleshooting

### Issue: String Not Updating

**Problem**: Changed string in lang.constants.js but not seeing changes.

**Solution**: 
1. Clear cache and rebuild: `npm run build`
2. Restart dev server
3. Hard refresh browser (Cmd/Ctrl + Shift + R)

---

### Issue: Placeholder Not Replaced

**Problem**: Seeing `{count}` in the UI instead of actual value.

**Solution**: Use `.replace()`:
```jsx
// Wrong
{lang.en.message.itemCount}

// Right
{lang.en.message.itemCount.replace("{count}", actualCount)}
```

---

### Issue: Module Import Error

**Problem**: `Cannot find module 'lang.constants'`

**Solution**: Check import path:
```javascript
// Adjust based on file location
import { lang } from "../../lang.constants";
import { lang } from "../../../src/lang.constants";
```

---

## Summary Checklist

When working with strings:

- [ ] Is this user-facing text? → Add to lang.constants.js
- [ ] Does it fit an existing category?
- [ ] Is the key name descriptive?
- [ ] Does it need placeholders for dynamic content?
- [ ] Did I update all usages in components?
- [ ] Did I test the changes?
- [ ] Did I remove the hardcoded string?

---

## Related Files

- **Source**: `/src/lang.constants.js`
- **Main Usage**: All React components in `/src`
- **Backend**: Can also be used in Express routes if needed

---

## Maintenance

### Periodic Review

Every few months, review lang.constants.js to:
1. Remove unused strings
2. Consolidate duplicate or similar strings
3. Update inconsistent wording
4. Add missing strings found in code reviews

### Code Review Checklist

When reviewing PRs, check:
- [ ] No new hardcoded strings in JSX
- [ ] All new strings added to lang.constants.js
- [ ] Proper use of placeholders for dynamic content
- [ ] Consistent key naming
- [ ] Appropriate category selection

---

**Last Updated**: October 2025  
**Maintainer**: Development Team  
**Questions**: See #dev-help in team chat
