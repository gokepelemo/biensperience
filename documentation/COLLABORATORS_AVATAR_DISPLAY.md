# Collaborators Avatar Display Implementation

## Overview
This document describes the implementation of the circular avatar display for collaborators in experience and plan views. The UI features overlapping circular avatars with hover effects, similar to common collaborative design patterns.

## Feature Description
Collaborators are now displayed at the top of both "The Plan" and "My Plan" tabs using a visual avatar stack design:

- **Owner Avatar**: Always displayed first (larger or distinct position)
- **Collaborator Avatars**: Up to 7 collaborators shown with overlapping circles
- **Overflow Badge**: "+N" badge when more than 7 collaborators
- **Count Message**: Text showing "X people joined this discussion"
- **Hover Effects**: Avatars lift and scale on hover for better interactivity

## Design Pattern

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│ [Collaborators Display]        [Action Buttons]        │
│  ○ ◐ ◑ ◒ +3                     [Add Plan Item] [Add]   │
│  5 people joined this discussion                        │
└─────────────────────────────────────────────────────────┘
```

**Desktop**: Flexbox layout with collaborators left-aligned, buttons right-aligned
**Mobile**: Vertical stacking with both sections centered

### Avatar Overlap Effect
- **Size**: 40px diameter circles
- **Overlap**: -12px left margin (except first avatar)
- **Border**: 3px white border for separation
- **Background**: Gradient fills (purple/blue) for users without photos
- **Hover**: translateY(-3px) and scale(1.1) for lift effect

## Implementation Details

### Data Structure
Both experiences and plans use the same permissions array structure:
```javascript
permissions: [
  {
    _id: ObjectId (User),    // Populated with { name, photo }
    entity: 'user',
    type: 'owner' | 'collaborator' | 'contributor'
  }
]
```

### Backend (No Changes Required)
The backend already populates permissions correctly in `controllers/api/experiences.js`:
```javascript
.populate({
  path: "permissions._id",
  select: "name photo"
});
```

### Frontend Components

#### Experience Tab Display
**Location**: `src/views/SingleExperience/SingleExperience.jsx` (~line 1255)

**Logic**:
1. Filter `experience.permissions` for collaborators
2. Display owner avatar from `experience.user`
3. Show up to 7 collaborator avatars
4. Display "+N" badge if more than 7
5. Show count message with singular/plural handling

**Key Code**:
```jsx
const collaborators = experience.permissions.filter(
  p => p.type === 'collaborator' && p._id
);

<div className="plan-header-row mb-4">
  {/* Collaborators Display - Left Side */}
  <div className="collaborators-display">
    <h6>{lang.heading.collaborators}</h6>
    <div className="avatar-stack">
      {/* Owner avatar */}
      <div className="avatar-circle">
        {experience.user.photo ? (
          <img src={experience.user.photo} alt={experience.user.name} />
        ) : (
          <div className="avatar-initials">
            {experience.user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      
      {/* Collaborator avatars (up to 7) */}
      {collaborators.slice(0, 7).map((p) => (
        <div key={p._id._id} className="avatar-circle">
          {p._id.photo ? (
            <img src={p._id.photo} alt={p._id.name} />
          ) : (
            <div className="avatar-initials">
              {p._id.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
      
      {/* +N badge if more than 7 */}
      {remainingCount > 0 && (
        <div className="avatar-circle avatar-more">
          <div className="avatar-initials">+{remainingCount}</div>
        </div>
      )}
    </div>
    
    {/* Count message */}
    <p className="collaborators-count">
      {totalCount === 1
        ? lang.message.personJoinedDiscussion.replace('{count}', totalCount)
        : lang.message.peopleJoinedDiscussion.replace('{count}', totalCount)}
    </p>
  </div>
  
  {/* Action Buttons - Right Side */}
  {isOwner && (
    <div className="plan-action-buttons">
      {/* Existing buttons */}
    </div>
  )}
</div>
```

#### My Plan Tab Display
**Location**: `src/views/SingleExperience/SingleExperience.jsx` (~line 1490)

**Logic**: Similar to Experience tab, but uses plan data:
- Owner from `currentPlan.user`
- Collaborators from `currentPlan.permissions` where `p.user` is populated
- Same display pattern and UI components

### CSS Styling
**Location**: `src/views/SingleExperience/SingleExperience.css` (~line 197)

**Key Styles**:
```css
/* Container for collaborators + buttons */
.plan-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid #e9ecef;
}

/* Left section - collaborators */
.collaborators-display {
  flex: 1;
  min-width: 250px;
}

.collaborators-display h6 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

/* Avatar stack container */
.avatar-stack {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  margin-right: 0.5rem;
}

/* Individual avatar circle */
.avatar-circle {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, z-index 0s;
  margin-left: -12px; /* Overlap effect */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.avatar-circle:first-child {
  margin-left: 0;
}

/* Hover effect - lift and scale */
.avatar-circle:hover {
  transform: translateY(-3px) scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
}

/* +N overflow badge */
.avatar-more {
  background: #e9ecef;
}

.avatar-more .avatar-initials {
  color: #495057;
  font-size: 0.875rem;
}

/* Count message */
.collaborators-count {
  font-size: 0.875rem;
  color: #6c757d;
  margin: 0;
}

/* Right section - action buttons */
.plan-action-buttons {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

/* Mobile responsive - stack vertically */
@media (max-width: 991px) {
  .plan-header-row {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .collaborators-display {
    min-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .avatar-stack {
    justify-content: center;
  }
  
  .plan-action-buttons {
    justify-content: center;
    width: 100%;
  }
}
```

### Localization
**Location**: `src/lang.constants.js`

**Added Strings**:
```javascript
heading: {
  collaborators: "Collaborators",
  // ... other headings
},

message: {
  peopleJoinedDiscussion: "{count} people joined this discussion.",
  personJoinedDiscussion: "{count} person joined this discussion.",
  // ... other messages
}
```

## Removed Code
The old alert-based collaborators display was removed from SingleExperience.jsx (~line 1633):
```jsx
// OLD - Removed
{currentPlan.permissions && currentPlan.permissions.some(p => p.type === 'collaborator') && (
  <div className="alert alert-info" role="alert">
    <p className="mb-0">
      <strong>Collaborators: </strong>
      {currentPlan.permissions
        .filter(p => p.type === 'collaborator' && p.user)
        .map((p, idx, arr) => (
          <span key={p.user._id}>
            <Link to={`/users/${p.user._id}`}>{p.user.name}</Link>
            {idx < arr.length - 1 && ', '}
          </span>
        ))}
    </p>
  </div>
)}
```

This was replaced with the new avatar-based display integrated into the `.plan-header-row`.

## User Experience

### Desktop View
1. Collaborators appear at top-left of plan tabs
2. Action buttons remain at top-right (existing position)
3. Horizontal layout with clear separation
4. Hover effects provide interactive feedback

### Mobile View
1. Vertical stacking at 991px breakpoint
2. Collaborators centered above buttons
3. Buttons centered below collaborators
4. Avatar stack remains horizontal

### Interaction
- **Hover**: Avatars lift slightly and scale up
- **Visual Hierarchy**: Owner avatar appears first
- **Clear Overflow**: "+N" badge indicates more collaborators
- **Context**: Count message provides total collaboration level

## Testing Checklist

### Visual Testing
- [ ] Owner avatar appears first with correct photo/initial
- [ ] Collaborator avatars overlap correctly (-12px margin)
- [ ] "+N" badge appears when more than 7 collaborators
- [ ] Count message shows correct singular/plural form
- [ ] Hover effects work (lift and scale)
- [ ] Layout is left-aligned on desktop
- [ ] Layout stacks vertically on mobile (<991px)
- [ ] Action buttons remain right-aligned on desktop

### Functional Testing
- [ ] Experience tab shows experience collaborators
- [ ] My Plan tab shows plan collaborators
- [ ] Both tabs handle owner + collaborators correctly
- [ ] Display works with 0, 1, few, and many collaborators
- [ ] User photos load correctly (or show initials)
- [ ] Links work correctly (if implemented)

### Data Testing
- [ ] Permissions array properly populated from backend
- [ ] Filtering works correctly (collaborators only)
- [ ] User data includes name and photo fields
- [ ] No errors when permissions array is empty
- [ ] No errors when user photos are missing

## Performance Considerations
- **Bundle Size**: +556 B JS, +212 B CSS (minimal impact)
- **Render Optimization**: Avatar list limited to 7 visible items
- **Memory**: No memory leaks (cleanup not required for static list)
- **Backend**: No additional queries (already populated)

## Future Enhancements
- **Clickable Avatars**: Add links to user profiles
- **Tooltips**: Show full name on hover
- **Animation**: Stagger animation on initial load
- **Avatar Quality**: Optimize image sizes for faster loading
- **Accessibility**: Add ARIA labels for screen readers

## Related Files
- `src/views/SingleExperience/SingleExperience.jsx` - Main component
- `src/views/SingleExperience/SingleExperience.css` - Styling
- `src/lang.constants.js` - Localization strings
- `controllers/api/experiences.js` - Backend data population
- `models/experience.js` - Permissions schema
- `models/plan.js` - Plan permissions schema

## Git History
- Commit: "Add circular avatar display for collaborators in experience and plan tabs"
- Files changed: SingleExperience.jsx, SingleExperience.css, lang.constants.js
- Lines added: ~200
- Lines removed: ~60 (old alert-based display)

## See Also
- [Permissions Framework](./PERMISSIONS_FRAMEWORK.md)
- [Plan Model Implementation](./PLAN_MODEL_IMPLEMENTATION.md)
- [Multiple Collaborators Implementation](./MULTIPLE_COLLABORATORS_IMPLEMENTATION.md)
