# String Internationalization Guide

## Overview
This guide documents the process of moving all hardcoded strings to `lang.constants.js` for internationalization (i18n) support.

## Current Status

### ✅ Completed
- Core button strings
- Alert messages
- Modal dialogs
- Form labels and placeholders
- Helper text
- Navigation items
- Cookie consent
- **NEW**: Admin panel strings
- **NEW**: Social login strings

### 🚧 In Progress
- AllUsers component (partially updated)

### ⏳ Pending Components

#### High Priority (User-Facing)
1. **NavBar.jsx** - Navigation text and ARIA labels
2. **SocialLoginButtons.jsx** - OAuth provider buttons
3. **ExperienceCard.jsx** - Action buttons and status text
4. **DestinationCard.jsx** - Card content and actions
5. **Profile.jsx** - Section headings and empty states
6. **SingleExperience.jsx** - Experience details and actions
7. **SingleDestination.jsx** - Destination details
8. **LoginForm.jsx** / **SignUpForm.jsx** - Auth form text

#### Medium Priority (Forms & Modals)
9. **NewExperience.jsx** / **UpdateExperience.jsx**
10. **NewDestination.jsx** / **UpdateDestination.jsx**
11. **UpdateProfile.jsx**
12. **ImageUpload.jsx** - Upload prompts and messages
13. **FormField.jsx** - Generic form text
14. **ConfirmModal.jsx** / **AlertModal.jsx**
15. **Toast.jsx** - Toast notifications

#### Lower Priority (Specialized)
16. **Destinations.jsx** - List view text
17. **Experiences.jsx** - List view text
18. **ExperiencesByTag.jsx** - Tag filtering text
19. **UsersList Display.jsx** - Collaborator management
20. **PhotoCard.jsx** / **PhotoModal.jsx** - Photo viewing

## String Categories in lang.constants.js

```javascript
lang.en = {
  button: {},      // All button text
  alert: {},       // Alerts and notifications
  modal: {},       // Modal dialogs
  heading: {},     // Page and section headings
  label: {},       // Form labels
  placeholder: {}, // Input placeholders
  helper: {},      // Helper/tooltip text
  message: {},     // User messages
  nav: {},         // Navigation
  table: {},       // Table headers
  image: {},       // Image-related text
  viewMeta: {},    // SEO meta tags
  tooltip: {},     // Tooltips
  cookieConsent: {},
  admin: {},       // Admin panel (NEW)
  social: {},      // Social login (NEW)
}
```

## Migration Pattern

### Step 1: Add Strings to lang.constants.js

```javascript
// Add to appropriate category
admin: {
  userManagement: "User Management",
  searchPlaceholder: "Search by name or email...",
  // ... more strings
}
```

### Step 2: Import lang in Component

```javascript
import { lang } from "../../lang.constants";
```

### Step 3: Replace Hardcoded Strings

**Before:**
```jsx
<h1>User Management</h1>
<input placeholder="Search by name or email..." />
```

**After:**
```jsx
<h1>{lang.en.admin.userManagement}</h1>
<input placeholder={lang.en.admin.searchPlaceholder} />
```

### Step 4: Handle Dynamic Strings

**Before:**
```jsx
<p>{userName}'s role updated to {roleName}</p>
```

**After:**
```javascript
// In lang.constants.js
admin: {
  roleUpdated: "{name}'s role updated to {role}"
}

// In component
<p>{lang.en.admin.roleUpdated
    .replace('{name}', userName)
    .replace('{role}', roleName)}</p>
```

## Common String Locations

### Component Files
- Button text: `<button>Click Me</button>`
- Links: `<Link>View More</Link>`
- Headings: `<h1>Page Title</h1>`
- Paragraphs: `<p>Description text</p>`
- ARIA labels: `aria-label="descriptive text"`
- Titles: `title="tooltip text"`
- Alt text: `alt="image description"`

### Alert/Modal Messages
- Success messages
- Error messages
- Confirmation prompts
- Help text

### Form Elements
- Labels: `<label>Field Name</label>`
- Placeholders: `placeholder="Enter value"`
- Helper text below inputs
- Validation messages

## Testing Checklist

After migrating each component:
- [ ] All visible text uses lang constants
- [ ] ARIA labels updated
- [ ] Tooltips/titles updated
- [ ] Error messages handled
- [ ] Success messages handled
- [ ] Placeholder text updated
- [ ] Alt text for images
- [ ] No console errors
- [ ] UI renders correctly

## Future: Multi-Language Support

### Adding a New Language

1. **Create language object**:
```javascript
const es = {
  button: {
    add: "Agregar",
    cancel: "Cancelar",
    // ... translate all strings
  },
  // ... all categories
};
```

2. **Add to languages object**:
```javascript
const languages = { en, es, fr, de };
```

3. **Set language via environment**:
```bash
REACT_APP_LANG=es npm start
```

### Dynamic Language Switching

```javascript
// Add to component
const [currentLang, setCurrentLang] = useState('en');
const t = lang[currentLang];

// Use in JSX
<h1>{t.admin.userManagement}</h1>

// Language selector
<select onChange={(e) => setCurrentLang(e.target.value)}>
  <option value="en">English</option>
  <option value="es">Español</option>
</select>
```

## Automation Tools

### Find Hardcoded Strings
```bash
# Find JSX text content
grep -r ">[A-Z][a-z ]\\{5,\\}<" src/ --include="*.jsx"

# Find string literals in components
grep -r '"[A-Z][a-z ]\\{5,\\}"' src/ --include="*.jsx"

# Find ARIA labels
grep -r 'aria-label="' src/ --include="*.jsx"
```

### Validation Script (TODO)
Create a script to:
- Scan all components for hardcoded strings
- Compare against lang.constants.js
- Report missing translations
- Suggest lang constant keys

## Best Practices

1. **Naming Conventions**
   - Use camelCase for keys: `userManagement`
   - Group related strings: `admin.userManagement`
   - Keep names descriptive but concise

2. **String Organization**
   - Group by feature/context, not component
   - Reuse common strings across components
   - Keep string values in source control

3. **Dynamic Content**
   - Use placeholders: `{name}`, `{count}`, `{date}`
   - Handle pluralization: `{count} user{plural}`
   - Document placeholder format in comments

4. **Accessibility**
   - Include ARIA label strings
   - Provide alt text constants
   - Don't forget screen reader text

## Migration Priority Order

1. **Phase 1** (Week 1): Critical user-facing components
   - AllUsers, NavBar, Auth forms
   - Experience/Destination cards
   - Profile views

2. **Phase 2** (Week 2): Forms and modals
   - CRUD forms
   - Confirmation modals
   - Image upload

3. **Phase 3** (Week 3): List views and specialized components
   - Experiences list
   - Destinations list
   - Photo galleries

4. **Phase 4** (Week 4): Polish and testing
   - Edge cases
   - Error messages
   - Validation
   - Documentation

## Completed Components

### ✅ AllUsers.jsx (In Progress)
- Added admin strings to lang.constants.js
- Imported lang in component
- Ready for string replacement

## Next Steps

1. Complete AllUsers component migration
2. Update NavBar component
3. Update SocialLoginButtons
4. Create validation script
5. Document any special cases

---

*Last Updated: 2025-01-18*
*Maintainer: Development Team*
