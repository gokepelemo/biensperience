# Reusable User Components Refactoring

## Overview
This document describes the refactoring of avatar/user display components into a reusable, composable component architecture following data model naming conventions and preparing for future features like Open Graph embeds.

## Motivation

### Problems with Previous Implementation
1. **Naming**: "CollaboratorsDisplay" was too specific to one use case
2. **Routing**: Used `/users/{id}` instead of `/profile/{id}`
3. **Single User Case**: Showed "+1" badge when only owner present (confusing UX)
4. **Not Composable**: Monolithic component couldn't be reused for other patterns
5. **Limited Flexibility**: Hard to customize size, behavior, or appearance

### Design Principles Applied
1. **Data Model Naming**: Component names reflect data models (User, Plan, Experience)
2. **Composability**: Atomic components that can be combined
3. **Reusability**: Generic enough for any part of the application
4. **Future-Ready**: Prepared for Open Graph, embeds, and rich snippets
5. **Semantic Routing**: Correct `/profile/{id}` URLs for user profiles

## New Component Architecture

### Component Hierarchy
```
UsersListDisplay (composite component)
  └── UserAvatar (atomic component)
        └── User data model
```

### 1. UserAvatar (Atomic Component)

**Purpose**: Display a single user's avatar with optional profile link

**Location**: `src/components/UserAvatar/`

**Props**:
```typescript
{
  user: {                    // User data model
    _id: string,
    name: string,
    photo?: string
  },
  size: 'sm' | 'md' | 'lg' | 'xl',  // Avatar size
  linkToProfile: boolean,            // Enable profile link (default: true)
  className: string,                 // Additional CSS classes
  onClick: Function,                 // Custom click handler
  title: string                      // Custom tooltip (defaults to user.name)
}
```

**Features**:
- ✅ Four size variants: sm (32px), md (40px), lg (48px), xl (64px)
- ✅ Automatic initials fallback for users without photos
- ✅ Links to `/profile/{userId}` (corrected routing)
- ✅ Optional click handler for custom interactions
- ✅ Hover effects with lift and scale
- ✅ Gradient background for visual appeal
- ✅ Accessible with keyboard navigation

**Size Reference**:
```css
sm: 32px  /* Compact lists, tight spaces */
md: 40px  /* Default, most common use */
lg: 48px  /* Emphasized users, headers */
xl: 64px  /* Profile pages, large displays */
```

**Usage Examples**:
```jsx
// Basic usage
<UserAvatar user={user} />

// Large avatar without link
<UserAvatar 
  user={user} 
  size="xl" 
  linkToProfile={false} 
/>

// Small avatar with custom click
<UserAvatar 
  user={user} 
  size="sm"
  onClick={() => handleUserClick(user._id)}
/>
```

### 2. UsersListDisplay (Composite Component)

**Purpose**: Display a list of users with overlapping avatars and count message

**Location**: `src/components/UsersListDisplay/`

**Props**:
```typescript
{
  owner: User,                       // Primary user (usually entity owner)
  users: User[],                     // Additional users (collaborators, etc.)
  messageKey: string,                // Message context (e.g., 'CreatingPlan')
  heading: string,                   // Custom heading text
  maxVisible: number,                // Max avatars before +N badge (default: 7)
  showMessage: boolean,              // Show count message (default: true)
  showHeading: boolean,              // Show heading (default: true)
  size: 'sm' | 'md' | 'lg' | 'xl',  // Avatar size (default: 'md')
  className: string                  // Additional CSS classes
}
```

**Features**:
- ✅ Smart single-user display (no overlap when only owner)
- ✅ Overlapping avatar stack for multiple users
- ✅ +N badge for overflow (when users > maxVisible)
- ✅ Context-specific messages via messageKey
- ✅ Customizable heading and size
- ✅ Can hide heading or message independently
- ✅ Uses UserAvatar internally (composable)

**Single User Behavior**:
```jsx
// When users = [] (only owner)
<UsersListDisplay owner={user} users={[]} />
// Renders: Single avatar, no overlap, no "+1" badge
```

**Multiple Users Behavior**:
```jsx
// When users.length > 0
<UsersListDisplay owner={owner} users={[user1, user2, user3]} />
// Renders: Overlapping avatars, count message
```

**Usage Examples**:
```jsx
// Experience collaborators
<UsersListDisplay
  owner={experience.user}
  users={collaborators}
  messageKey="CreatingPlan"
/>

// Plan participants (custom heading, no message)
<UsersListDisplay
  owner={plan.user}
  users={participants}
  heading="Team Members"
  showMessage={false}
/>

// Small compact list
<UsersListDisplay
  owner={owner}
  users={team}
  size="sm"
  maxVisible={5}
/>
```

## Routing Fix: /users/{id} → /profile/{id}

### Previous (Incorrect)
```jsx
<Link to={`/users/${user._id}`}>
```

### Current (Correct)
```jsx
<Link to={`/profile/${user._id}`}>
```

**Why This Matters**:
- `/profile/{id}` is the correct route in the application
- Ensures consistent navigation throughout app
- Prepares for SEO and Open Graph integration
- Matches REST API patterns

## Implementation Details

### File Structure
```
src/components/
├── UserAvatar/
│   ├── UserAvatar.jsx        # Atomic avatar component
│   └── UserAvatar.css        # Avatar styles
└── UsersListDisplay/
    ├── UsersListDisplay.jsx  # Composite list component
    └── UsersListDisplay.css  # List styles
```

### UserAvatar Component
**Location**: `src/components/UserAvatar/UserAvatar.jsx`

**Key Implementation Details**:
```javascript
// Profile routing
<Link to={`/profile/${user._id}`}>

// Size variants
.user-avatar-sm { width: 32px; height: 32px; }
.user-avatar-md { width: 40px; height: 40px; }
.user-avatar-lg { width: 48px; height: 48px; }
.user-avatar-xl { width: 64px; height: 64px; }

// Photo fallback
{user.photo ? (
  <img src={user.photo} alt={user.name} />
) : (
  <div className="avatar-initials">
    {user.name?.charAt(0).toUpperCase()}
  </div>
)}

// Optional link wrapper
{linkToProfile ? (
  <Link to={`/profile/${user._id}`}>
    {avatarContent}
  </Link>
) : (
  <div onClick={onClick}>
    {avatarContent}
  </div>
)}
```

### UsersListDisplay Component
**Location**: `src/components/UsersListDisplay/UsersListDisplay.jsx`

**Single User Logic**:
```javascript
// Special case: only owner, no users
if (users.length === 0 && owner) {
  return (
    <div className="users-list-display users-list-single">
      {showHeading && <h6>{heading}</h6>}
      <UserAvatar user={owner} size={size} />
    </div>
  );
}
```

**Multiple Users Logic**:
```javascript
// Standard case: owner + users with overlap
<div className="users-avatar-stack">
  {owner && <UserAvatar user={owner} size={size} className="stacked-avatar" />}
  {users.slice(0, maxVisible).map(user => (
    <UserAvatar user={user} size={size} className="stacked-avatar" />
  ))}
  {remainingCount > 0 && (
    <div className="avatar-more">+{remainingCount}</div>
  )}
</div>
```

## Integration Changes

### SingleExperience.jsx
**Location**: `src/views/SingleExperience/SingleExperience.jsx`

**Import Change**:
```javascript
// Before
import CollaboratorsDisplay from "../../components/CollaboratorsDisplay/CollaboratorsDisplay";

// After
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
```

**Experience Tab**:
```javascript
// Before
<CollaboratorsDisplay
  owner={experience.user}
  collaborators={...}
  messageKey="CreatingPlan"
/>

// After
<UsersListDisplay
  owner={experience.user}
  users={...}  // Renamed from 'collaborators'
  messageKey="CreatingPlan"
/>
```

**My Plan Tab**:
```javascript
// Similar change: collaborators → users
<UsersListDisplay
  owner={currentPlan?.user}
  users={...}
  messageKey="PlanningExperience"
/>
```

## Benefits

### Code Quality
- ✅ **Composable Architecture**: Atomic UserAvatar used by composite UsersListDisplay
- ✅ **Data Model Naming**: Components named after User entity
- ✅ **Single Responsibility**: Each component has one clear purpose
- ✅ **Type Safety**: PropTypes validation on all props

### User Experience
- ✅ **Smart Single User Display**: No confusing "+1" when only owner
- ✅ **Correct Routing**: All profile links use `/profile/{id}`
- ✅ **Flexible Sizes**: Four size options for different contexts
- ✅ **Consistent Behavior**: Same avatar logic everywhere

### Maintainability
- ✅ **Reusable Everywhere**: Can be used for any user list in app
- ✅ **Easy to Test**: Small, focused components
- ✅ **Clear API**: Props well-documented and typed
- ✅ **Future-Ready**: Prepared for Open Graph and embeds

### Performance
- ✅ **Bundle Size**: Similar size to previous implementation
- ✅ **Render Optimization**: No performance overhead
- ✅ **CSS Encapsulation**: Scoped styles per component

## Future Use Cases

### Prepared For (Future Features)

**1. Open Graph Rich Snippets**
```jsx
// Plan/Experience cards with user avatars
<meta property="og:image" content={UserAvatar.getImageUrl(owner)} />
<UsersListDisplay owner={owner} users={collaborators} />
```

**2. Embeddable Widgets**
```jsx
// Standalone embedded plan view
<EmbeddedPlan>
  <UsersListDisplay owner={plan.user} users={collaborators} />
  <PlanItems items={plan.items} />
</EmbeddedPlan>
```

**3. Destination Collaborators**
```jsx
// When destinations gain collaborators
<UsersListDisplay
  owner={destination.user}
  users={destination.collaborators}
  messageKey="ManagingDestination"
/>
```

**4. Photo Contributors**
```jsx
// Show users who contributed photos
<UsersListDisplay
  owner={photo.user}
  users={photo.contributors}
  messageKey="ContributingPhoto"
  size="sm"
/>
```

**5. Discussion Participants**
```jsx
// Comments/discussion feature
<UsersListDisplay
  owner={discussion.author}
  users={discussion.participants}
  messageKey="ParticipatingDiscussion"
  heading="Participants"
/>
```

### Reusable Patterns to Implement

**1. Plan Item Component**
```jsx
// Suggested: src/components/PlanItem/PlanItem.jsx
<PlanItem
  item={planItem}
  onComplete={handleComplete}
  onEdit={handleEdit}
  showPhotos={true}
/>
```

**2. Plan Card Component**
```jsx
// Suggested: src/components/PlanCard/PlanCard.jsx
<PlanCard
  plan={plan}
  showMetrics={true}
  showOwner={true}
  onView={handleView}
/>
```

**3. Experience Card (Enhanced)**
```jsx
// Enhance existing ExperienceCard
<ExperienceCard
  experience={experience}
  showCollaborators={true}
  showPlanStatus={true}
/>
```

**4. Metrics Card Component**
```jsx
// Extract from SingleExperience
<MetricsCard
  metrics={[
    { label: 'Completion', value: '75%' },
    { label: 'Total Cost', value: '$1,200' }
  ]}
/>
```

## Component Naming Convention

### Established Pattern
```
{DataModel}{Action/Purpose}{ComponentType}

Examples:
- UserAvatar              (User entity, Avatar display)
- UsersListDisplay        (User entity, List display)
- PlanItem                (Plan Item entity)
- PlanCard                (Plan entity, Card display)
- ExperienceCard          (Experience entity, Card display)
- DestinationCard         (Destination entity, Card display)
```

### Guidelines
1. **Start with data model**: User, Plan, Experience, Destination, Photo
2. **Add plural for lists**: Users, Plans, Experiences
3. **Add action/purpose**: Create, Edit, List, Display, Picker
4. **End with component type**: Card, Modal, Form, Display, Avatar

### Good Examples
```
✅ UserAvatar              # Clear: User entity, avatar component
✅ UsersListDisplay        # Clear: List of users
✅ PlanItemForm            # Clear: Form for plan item
✅ ExperienceCard          # Clear: Experience entity card
✅ DestinationPicker       # Clear: Destination selection
```

### Bad Examples
```
❌ CollaboratorsDisplay    # Too specific to one use case
❌ AvatarList              # Missing data model reference
❌ UsersList               # Missing component type
❌ DisplayUsers            # Backwards naming
```

## Testing Recommendations

### UserAvatar Component
- [ ] Renders with photo URL correctly
- [ ] Shows initials when no photo
- [ ] Links to `/profile/{id}` (not `/users/{id}`)
- [ ] All sizes render correctly (sm, md, lg, xl)
- [ ] Hover effects work
- [ ] Works without link (linkToProfile=false)
- [ ] Custom onClick handler works
- [ ] Accessible keyboard navigation

### UsersListDisplay Component
- [ ] Single user (owner only) displays without overlap
- [ ] Multiple users display with overlap
- [ ] +N badge appears when users > maxVisible
- [ ] Message displays correctly (singular/plural)
- [ ] Custom heading works
- [ ] Can hide message (showMessage=false)
- [ ] Can hide heading (showHeading=false)
- [ ] All sizes work correctly
- [ ] Empty users array handled gracefully

### Integration Testing
- [ ] Experience tab shows collaborators correctly
- [ ] My Plan tab shows plan collaborators correctly
- [ ] Profile links navigate to correct routes
- [ ] Single owner displays properly (no "+1")
- [ ] Multiple collaborators display with count
- [ ] Messages show correct singular/plural forms

## Performance Metrics

### Bundle Size Impact
- **Before**: 139.97 kB (main.js)
- **After**: 140.15 kB (main.js)
- **Change**: +177 B (+0.13%)

**Reason for Increase**: Added flexibility and composability worth the small cost

### Code Metrics
- **UserAvatar**: ~70 lines (new atomic component)
- **UsersListDisplay**: ~125 lines (improved composite)
- **Removed**: CollaboratorsDisplay (~115 lines)
- **Net Change**: +80 lines (added flexibility and reusability)

## Migration Guide

### For Developers Using Old Component

**Step 1: Update Import**
```javascript
// Old
import CollaboratorsDisplay from "../../components/CollaboratorsDisplay/CollaboratorsDisplay";

// New
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";
```

**Step 2: Rename Prop**
```jsx
// Old
<CollaboratorsDisplay
  owner={owner}
  collaborators={users}  // ❌
  messageKey="CreatingPlan"
/>

// New
<UsersListDisplay
  owner={owner}
  users={users}  // ✅ Renamed
  messageKey="CreatingPlan"
/>
```

**Step 3: Check Routing**
- Verify all profile links use `/profile/{id}`
- No changes needed if using component (automatic)

### For New Use Cases

**Example: Add to Destination View**
```jsx
import UsersListDisplay from "../../components/UsersListDisplay/UsersListDisplay";

// In your component
<UsersListDisplay
  owner={destination.user}
  users={destination.contributors}
  messageKey="ContributingDestination"
  heading="Contributors"
/>
```

**Example: Single User Display**
```jsx
import UserAvatar from "../../components/UserAvatar/UserAvatar";

// Profile header
<UserAvatar user={user} size="xl" linkToProfile={false} />

// Comment author
<UserAvatar user={comment.author} size="sm" />
```

## Conclusion

This refactoring successfully:
- ✅ Created composable, reusable user components
- ✅ Fixed routing to use `/profile/{id}` consistently
- ✅ Improved single-user display UX (no "+1")
- ✅ Followed data model naming conventions
- ✅ Prepared for Open Graph and embed features
- ✅ Established patterns for future component creation

The new architecture provides a solid foundation for displaying users throughout the application and serves as a model for future component development.

## Related Files
- `src/components/UserAvatar/UserAvatar.jsx` - Atomic component
- `src/components/UserAvatar/UserAvatar.css` - Avatar styles
- `src/components/UsersListDisplay/UsersListDisplay.jsx` - Composite component
- `src/components/UsersListDisplay/UsersListDisplay.css` - List styles
- `src/views/SingleExperience/SingleExperience.jsx` - Implementation

## Git History
- Commit: "Refactor user display components with data model naming and routing fixes"
- Files: 6 created, 3 modified, 2 deleted
- Lines: +265, -195

## See Also
- [Collaborators Component Refactoring](./COLLABORATORS_COMPONENT_REFACTORING.md) - Previous iteration
- [Collaborators Avatar Display](./COLLABORATORS_AVATAR_DISPLAY.md) - Original implementation
- [Component Naming Conventions](./COMPONENT_NAMING_CONVENTIONS.md) - To be created
