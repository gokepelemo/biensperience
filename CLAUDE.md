# Biensperience Development Log

This document tracks major changes and architectural decisions in the Biensperience application.
For AI agent guidelines and workflows, see [AGENTS.md](./AGENTS.md).

## Current Version: 0.2.0

---

## Recent Major Changes (October 2025)

### Sample Data Generator Enhancement (Oct 18, 2025)

**Realistic Names and Duplicate Prevention**
- Expanded name lists to 80+ first names and 75+ last names
- Diverse, international names (English, Spanish, Chinese, Indian, Japanese, etc.)
- Professional surname variety (common and international origins)
- Intelligent duplicate prevention with Set-based tracking

**Enhanced Email Generation**:
- 10 realistic email domains (Gmail, Yahoo, Outlook, ProtonMail, etc.)
- Smart collision handling with multiple fallback strategies
- Unique email guarantee even with 200+ users
- Natural email formats: firstname.lastname@domain.com

**Duplicate Prevention Logic**:
1. Try base email (james.smith@gmail.com)
2. Try with random numbers (james.smith123@gmail.com)
3. Fallback with timestamp + random string for extreme cases
4. Track all used emails and names in Sets

**Code Quality**:
- Fixed duplicate "Queenstown" destination (replaced with Wellington)
- Removed unused function parameters
- Added comprehensive test suite: `test-sample-data.js`

**Benefits**:
- ✅ Zero duplicate names or emails
- ✅ Production-realistic sample data
- ✅ Better testing for user search/filtering
- ✅ Handles high-volume generation (200+ users)

---

### OAuth 2.0 Migration and Social Authentication (Oct 18, 2025)

**Rebranded Twitter to X**
- Updated all UI references from "Twitter" to "X"
- Replaced `FaTwitter` icon with `FaXTwitter` from react-icons/fa6
- Updated brand colors from Twitter blue (#1DA1F2) to X black (#000000)
- Created comprehensive troubleshooting guide: `documentation/TWITTER_OAUTH_ERROR_TROUBLESHOOTING.md`

**Twitter OAuth 1.0a → OAuth 2.0 Migration**
- Migrated from deprecated `passport-twitter` to `passport-twitter-oauth2@2.1.1`
- Updated to OAuth 2.0 flow with Client ID/Secret (no more Consumer Key/Secret)
- Configured OAuth 2.0 scopes: `tweet.read`, `users.read`, `offline.access`
- Added refresh token support for long-term access
- Updated profile data parsing for Twitter API v2 structure
- See: `documentation/TWITTER_OAUTH2_MIGRATION.md`

**Benefits:**
- ✅ Resolves "Could not authenticate you" errors
- ✅ Modern, secure OAuth 2.0 flow
- ✅ Granular permission scopes
- ✅ Better error handling and logging

---

### URL Normalization for Plan Items (Oct 16, 2025)

**Automatic HTTPS Prefix**
- Created `normalizeUrl()` utility function
- Automatically adds `https://` to URLs without a scheme
- Preserves existing schemes (http://, mailto:, tel:, ftp://, etc.)
- Integrated into both experiences-api and plans-api

**Implementation:**
- `src/utilities/url-utils.js` - Core normalization function
- `src/utilities/url-utils.test.js` - 20 comprehensive tests
- Handles edge cases: empty strings, whitespace, IP addresses, auth info

**User Experience:**
```javascript
// Before: User enters "example.com/resource"
// Result: Broken link → navigates to current-site.com/example.com/resource

// After: User enters "example.com/resource"
// Result: Auto-normalized to https://example.com/resource ✅
```

See: `documentation/URL_NORMALIZATION_IMPLEMENTATION.md`

---

### Bootstrap Forms Refactoring (Oct 15, 2025)

**New FormField Component**
- Created unified `FormField` component consolidating Bootstrap form patterns
- Integrated `Form.Control`, `Form.Label`, `InputGroup`, validation feedback
- Replaced manual tooltip initialization with React-managed `FormTooltip`
- Support for input groups (prepend/append like $ and "days")

**Forms Migrated (40% code reduction):**
1. `NewDestination.jsx` - 20 fields converted
2. `NewExperience.jsx` - 8 fields converted
3. `UpdateDestination.jsx` - 3 fields converted
4. `UpdateExperience.jsx` - 6 fields converted
5. `UpdateProfile.jsx` - 7 fields converted

**New Components:**
- `src/components/FormField/FormField.jsx` - Unified form field component
- `src/components/Tooltip/Tooltip.jsx` - Bootstrap tooltip wrapper with Popper.js
- `FormTooltip` - Form field info icon tooltips

**Benefits:**
- ✅ Consistent Bootstrap styling
- ✅ No manual tooltip lifecycle management
- ✅ Automatic Popper.js positioning
- ✅ Improved accessibility
- ✅ Easier maintenance

---

### Photo Modal Duplication Bug Fix (Oct 15, 2025)

**Critical UX Bug Fixed**
- Photos on SingleDestination opened TWO modals simultaneously
- Users had to click cancel twice to dismiss

**Root Cause:**
- `PhotoCard` has internal modal state and renders `PhotoModal`
- `SingleDestination` imported `PhotoModal` and created duplicate state
- Wrapper divs with onClick handlers triggered before PhotoCard clicks
- Result: Two modal instances on single click

**Solution:**
- Removed duplicate `PhotoModal` import and state from `SingleDestination`
- Removed wrapper divs with onClick handlers
- Established `PhotoCard` as single source of truth
- Replaced manual thumbnail grid with `PhotoCard` components
- File reduced from 273 → 228 lines (-16.5%)

**Benefits:**
- ✅ Single modal instance per photo
- ✅ Single click opens, single click closes
- ✅ Cleaner component architecture
- ✅ Consistent behavior across all photo displays

---

### Alert Component Refactoring (Oct 15, 2025)

**100% Complete - All 23 Components Migrated**

Created reusable `Alert` component with comprehensive props API:
- Supports 8 Bootstrap-compatible types (success, warning, danger, info, etc.)
- Features: dismissible, title, message, children, icons, sizes, bordered variants
- Fade-out animation for dismissible alerts
- Responsive adjustments for mobile devices

**Components Converted:**
- UpdateProfile, Profile, NewDestination, UpdateDestination
- NewExperience, UpdateExperience, Destinations, Experiences
- ExperiencesByTag, SingleDestination, ImageUpload, SingleExperience

**Before:** Manual Bootstrap alert markup in every component
**After:** `<Alert type="info" message="..." />`

See: `documentation/ALERT_MODAL_CONVERSION_SUMMARY.md`

---

### Cookie Management Infrastructure (Oct 15, 2025)

**Comprehensive Cookie Utility System**
- Migrated from manual cookie parsing to `js-cookie` library
- Added `store2` for localStorage management
- Cookie consent management with automatic localStorage fallback
- Expirable storage with metadata tracking

**Core Functions:**
1. `getCookieData(cookieName)` - Retrieve and parse JSON cookie
2. `setCookieData(cookieName, data, expirationMs)` - Store JSON data
3. `getCookieValue(cookieName, key, maxAge?)` - Get specific key with age validation
4. `setCookieValue(cookieName, key, value, expirationMs, maxAge?)` - Upsert with auto-cleanup
5. `deleteCookieValue(cookieName, key, expirationMs)` - Remove specific key
6. `deleteCookie(cookieName)` - Remove entire cookie
7. `cleanupExpiredEntries(cookieName, maxAge, expirationMs)` - Explicit cleanup

**Performance Benefits:**
- 90% fewer cookies: N individual → 1 JSON-encoded cookie
- 40-50% smaller storage: ~500 bytes → ~200-300 bytes for 10 experiences
- Automatic maintenance: No manual cleanup required
- Future-ready: Supports preferences, feature flags, session tracking

**New Components:**
- `src/components/CookieConsent/CookieConsent.jsx` - Toast-based consent UI
- `src/components/Toast/Toast.jsx` - Bootstrap Toast component wrapper
- `src/contexts/ToastContext.jsx` - Global toast notification provider

See: `documentation/COOKIE_UTILITY_REFACTORING.md`

---

### Currency Formatting Utilities (Oct 15, 2025)

**Smart Currency Formatting**
- Created `formatCurrency()` with intelligent decimal handling
- No decimals for whole amounts: `$100`, `$1,000`
- Decimals only when cents present: `$100.50`, `$1,234.56`
- Multi-currency support (USD, EUR, GBP, JPY)
- Locale-aware formatting with `Intl.NumberFormat`

**Implementation:**
- `src/utilities/currency-utils.js` - Core formatting functions
- `src/utilities/currency-utils.test.js` - Comprehensive test suite
- Integrated into `SingleExperience.jsx` for all cost displays

**Helper Functions:**
- `formatCurrency(amount, currency)` - Main formatter
- `formatCostEstimate(cost)` - For experience costs
- `formatCostRange(min, max)` - For cost ranges
- `formatTotal(items)` - Sum and format array of costs

See: `documentation/CURRENCY_FORMATTING_IMPLEMENTATION.md`

---

### OAuth Integration (Oct 10-15, 2025)

**Social Login Providers**
- Facebook OAuth 2.0
- Google OAuth 2.0
- Twitter OAuth 2.0 (X)

**Features:**
- Account linking for existing users
- Profile photo handling from OAuth providers
- JWT token creation for OAuth users
- CSRF protection with state parameter

**New Files:**
- `config/passport.js` - Passport strategies for all providers
- `routes/api/auth.js` - OAuth routes and callbacks
- `src/utilities/oauth-service.js` - Frontend OAuth handling
- `src/components/SocialLoginButtons/SocialLoginButtons.jsx` - Social login UI
- `.env.example` - OAuth environment variables template

**Backend Integration:**
- `app.js` - Passport initialization and session management
- Account linking endpoints
- Linked accounts status endpoint
- Unlink social account endpoint

See: `documentation/BOOTSTRAP_OAUTH_IMPLEMENTATION.md`, `documentation/OAUTH_SETUP_GUIDE.md`

---

### Permissions & Role-Based Access Control (Oct 12-18, 2025)

**Comprehensive Permission Framework** ✅ Production Ready

**User Roles:**
- **Super Admin**: Full access to all resources and user management
- **Regular User**: Standard permissions with owner/collaborator/contributor roles

**Permission Levels (for Resources):**
- **Owner**: Full control (creator of resource)
- **Collaborator**: Can edit and modify plan item states
- **Contributor**: Can add posts (reserved for future functionality)

**Core Features:**
- Role-based access control with priority system (Owner: 100, Collaborator: 50, Contributor: 10)
- Permission inheritance with circular dependency prevention (max depth: 3 levels)
- Backwards compatibility: `isOwner()` checks BOTH legacy `user` attribute AND owner role
- Security: Owner-only permission management

**New Files:**
- `src/utilities/permissions.js` - Frontend permission utilities
- `src/utilities/user-roles.js` - Role constants and display names
- `utilities/permissions.js` - Backend permission logic
- `utilities/permission-enforcer.js` - Middleware for API routes
- `utilities/user-roles.js` - Backend role constants
- `tests/api/permissions.test.js` - Comprehensive permission tests

**New View:**
- `src/views/AllUsers/AllUsers.jsx` - Super admin user management page
- `src/views/AllUsers/AllUsers.css` - User management styling

**API Updates:**
- All destination/experience/plan controllers updated with permission checks
- User role management endpoints
- Migration script: `migrations/migrate-user-roles.js`

**Testing:**
- 50+ permission test cases covering all scenarios
- Role inheritance testing
- Circular dependency prevention testing
- Backwards compatibility verification

See: `documentation/PERMISSIONS_FRAMEWORK.md`, `documentation/API_PERMISSIONS_REFERENCE.md`, `documentation/PERMISSION_ENFORCER_GUIDE.md`

---

### Security Enhancements (Oct 12, 2025)

**CodeQL Vulnerability Fixes**
- Fixed 7 critical/high severity vulnerabilities
- SQL injection prevention
- XSS protection with DOMPurify
- CSRF protection with csrf-csrf
- Rate limiting with express-rate-limit
- Helmet.js for HTTP header security

**New Security Infrastructure:**
- `utilities/backend-logger.js` - Comprehensive backend logging
- `utilities/api-logging-middleware.js` - API request/response logging
- `utilities/controller-helpers.js` - Standardized error handling
- Input sanitization across all API endpoints

See: `documentation/SECURITY_ENHANCEMENTS.md`, `documentation/SECURITY_IMPLEMENTATION_SUMMARY.md`

---

### Plan Model Implementation (Oct 10-12, 2025)

**Migration from experience.users to Plan Model**

**Old Architecture:**
```javascript
experience.users = [{
  user: ObjectId,
  plannedDate: Date,
  items: [...]
}]
```

**New Architecture:**
```javascript
Plan = {
  _id: ObjectId,
  experience: ObjectId,
  user: ObjectId,
  plannedDate: Date,
  items: [...],
  completedItems: [...],
  isComplete: Boolean,
  permissions: [...]
}
```

**Benefits:**
- ✅ Proper data model with separate Plan collection
- ✅ Enables collaborative planning with permissions
- ✅ Better query performance
- ✅ Scalable for future features (notes, budgets, etc.)

**Automatic Lifecycle Management:**
- Plans auto-created when user adds experience
- Plans auto-deleted when last item removed and no completed items
- Seamless UX with no manual plan management

**Collaborative Features:**
- Multiple users can collaborate on same plan
- Owner/Collaborator permissions
- Avatar display for all collaborators
- Plan metrics: Total items, completed items, completion percentage

See: `documentation/PLAN_MODEL_IMPLEMENTATION.md`, `documentation/PLAN_LIFECYCLE.md`, `documentation/COMPLETE_PLAN_MODEL_MIGRATION.md`

---

### Modal System Refactoring (Oct 14-15, 2025)

**Reusable Modal Component**
- Created unified `Modal` component with consistent API
- Responsive sizing: sm (400px), md (600px), lg (800px), xl (1000px)
- Auto-sizing based on content
- Consistent styling across all modals

**Features:**
- Backdrop click to close (configurable)
- ESC key to close
- Header with title and close button
- Footer with action buttons
- Center alignment
- Smooth fade/scale animations

**Modals Converted:**
- PhotoModal, AlertModal, ConfirmModal
- Plan item modals (add/edit)
- Destination/Experience forms
- Profile update modal

See: `documentation/MODAL_REFACTORING_SUMMARY.md`

---

### UI/UX Improvements (Oct 9-15, 2025)

**Animated Purple Gradients**
- Applied subtle animated gradients across entire application
- Gradient animations: 4s (fast), 8s (standard), 15s (slow)
- Elements: buttons, badges, progress bars, scrollbar, modal headers
- GPU-accelerated with `will-change` properties
- 60fps smooth animations

**Animation Keyframes:**
- `gradientShift` - 8-second infinite gradient animation
- `gradientPulse` - Pulsing background effect

**Utility Classes:**
- `.gradient-animated` - Standard 8s animation
- `.gradient-animated-fast` - Fast 4s animation
- `.gradient-animated-slow` - Slow 15s animation
- `.gradient-pulse` - Pulsing effect
- `.gradient-hover-animate` - Triggers on hover

**Responsive Typography**
- Converted static font sizes to responsive `clamp()` values
- Body text: `clamp(0.875rem, 1.5vw, 1rem)`
- Section headings: `clamp(1rem, 2.5vw, 1.25rem)`
- Modal titles: `clamp(1.25rem, 3vw, 1.8rem)`

**UI Icon Updates:**
- Replaced "+" with "✚" (heavy plus sign) for better visual clarity
- Updated NavBar logo button
- Updated ExperienceCard add buttons

**PhotoCard Improvements:**
- Fixed height: `max(600px, 40vh)` desktop, `max(400px, 35vh)` mobile
- Improved image scaling with intelligent height detection
- Dynamic resizing based on natural image dimensions

**Button Layout Fixes:**
- Fixed button wrapping issues (`flex-wrap: nowrap`)
- Centered buttons on mobile while maintaining desktop right-alignment
- Responsive sizing for different breakpoints

**State Management Fixes:**
- Fixed add/remove experience button state sync
- Fixed favorite destinations button state sync
- Optimistic UI updates with proper error recovery
- `previousState` tracking for reliable state reversion

See: Original sections below for detailed implementation notes

---

## Development Best Practices

### Code Organization
- **Components**: Reusable React components in `src/components/`
- **Views**: Page-level components in `src/views/`
- **Utilities**: Helper functions in `src/utilities/` (frontend) and `utilities/` (backend)
- **API**: Backend routes in `routes/api/`
- **Controllers**: Business logic in `controllers/api/`
- **Models**: Mongoose schemas in `models/`

### Testing
- **Frontend**: React Testing Library (`npm test`)
- **Backend API**: Jest + Supertest (`npm run test:api`)
- **Coverage**: Run `npm run test:api:coverage`
- **Debug Mode**: `npm run test:api:debug`

### Git Commit Message Format
Follow conventional commits:
```
feat: Add new feature
fix: Bug fix
refactor: Code refactoring
docs: Documentation updates
test: Test additions/updates
style: Code style changes (formatting)
chore: Build process or auxiliary tool changes
```

Add detailed body with:
- What changed
- Why it changed
- Any breaking changes
- Testing notes

### Documentation
- **Major Features**: Create detailed docs in `documentation/`
- **API Changes**: Update `documentation/API_PERMISSIONS_REFERENCE.md`
- **Breaking Changes**: Document in relevant guides
- **Migration**: Create migration scripts in `migrations/`

---

## Technical Stack

### Frontend
- React 18.2.0
- React Router 6.17.0
- React Bootstrap 2.9.0
- Bootstrap 5.3.8
- React Icons 5.5.0
- js-cookie 3.0.5
- store2 2.14.4
- DOMPurify 3.2.7

### Backend
- Express 4.18.2
- Mongoose 7.6.2
- Passport 0.7.0 (OAuth strategies)
- JWT (jsonwebtoken 9.0.2)
- Helmet 8.1.0 (security headers)
- express-rate-limit 8.1.0
- csrf-csrf 4.0.3
- AWS SDK S3 Client 3.705.0

### Development
- React Scripts 5.0.1
- Storybook 9.1.10
- Jest 27.5.1
- Supertest 7.1.4
- MongoDB Memory Server 10.2.3
- Puppeteer 24.24.0

---

## Environment Setup

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/biensperience

# JWT
SECRET=your-jwt-secret-here

# OAuth - Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3001/api/auth/facebook/callback

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# OAuth - X (Twitter)
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=http://localhost:3001/api/auth/twitter/callback

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-bucket-name

# Session
SESSION_SECRET=your-session-secret

# CSRF
CSRF_SECRET=your-csrf-secret

# Debug
REACT_APP_DEBUG=false
```

See `.env.example` for complete template.

---

## Browser Compatibility

### Tested Browsers
- Chrome/Edge (Chromium)
- Safari
- Firefox

### CSS Features Used
- `clamp()` - Modern CSS (supported in all evergreen browsers)
- CSS Animations - Full support
- CSS Gradients - Full support
- `will-change` - Full support

---

## Accessibility

### Current Features
- Proper ARIA labels on all interactive elements
- Sufficient color contrast for gradients
- Responsive font sizing for better readability
- Focus states on all buttons
- Semantic HTML throughout
- Keyboard navigation support

### Future Enhancements
- Add `prefers-reduced-motion` support for animations
- Enhanced screen reader announcements for state changes
- Improved keyboard navigation for complex modals

---

## Performance Optimizations

### CSS
- GPU-accelerated animations with `will-change`
- Animations run at 60fps
- Minimal repaints and reflows

### React
- `useCallback` for event handlers to prevent re-renders
- Proper dependency arrays in all hooks
- Optimistic UI updates reduce perceived latency
- Lazy loading for images

### API
- Efficient MongoDB queries with proper indexing
- Pagination for large datasets
- Response caching where appropriate
- Rate limiting to prevent abuse

---

## Known Issues & Future Improvements

### Potential Improvements
1. Extract animation utilities to separate CSS variables file
2. Add `prefers-reduced-motion` media queries
3. Implement global state management (Redux/Zustand)
4. Add loading skeletons for better perceived performance
5. Implement service workers for offline support
6. Add image optimization pipeline
7. Implement infinite scroll for large lists
8. Add real-time collaboration with WebSockets

### Known Issues
- None currently identified after recent fixes

---

## Migration Notes

### Backwards Compatibility
- Cookie utility fully backwards compatible
- Old cookies naturally expire and get replaced
- Permission system checks both legacy `user` field and new `permissions` array
- No breaking changes to existing functionality

### Database Migrations
- User role migration: `migrations/migrate-user-roles.js`
- Run migrations before deploying permission changes

---

## Style Guide Compliance

All changes follow established style guide in `style-guide.md`:
- Consistent purple gradient theme
- Proper use of CSS variables
- Consistent spacing and border radius values
- Responsive design with mobile-first approach
- Smooth transitions and animations (0.2s - 0.6s range)

---

## Quick Reference

### Common Tasks
```bash
# Start development server
npm start

# Build for production
npm run build

# Run frontend tests
npm test

# Run backend API tests
npm run test:api

# Run backend tests with debug logging
npm run test:api:debug

# Run tests in watch mode
npm run test:api:watch

# Generate coverage report
npm run test:api:coverage

# Start with PM2
npm run pm2:start

# Restart PM2
npm run pm2:restart

# Stop PM2
npm run pm2:stop

# Start Storybook
npm run storybook
```

### File Locations
- **Components**: `src/components/[ComponentName]/[ComponentName].jsx`
- **Views**: `src/views/[ViewName]/[ViewName].jsx`
- **Frontend Utils**: `src/utilities/[util-name].js`
- **Backend Utils**: `utilities/[util-name].js`
- **API Routes**: `routes/api/[resource].js`
- **Controllers**: `controllers/api/[resource].js`
- **Models**: `models/[model-name].js`
- **Tests**: `tests/api/[resource].test.js`
- **Documentation**: `documentation/[TOPIC].md`
- **Migrations**: `migrations/[migration-name].js`

---

## Original Development Notes (Oct 9, 2025)

### Animated Purple Gradients
Applied subtle animated gradients across the entire application to enhance the purple theme.

#### Files Modified:
- `src/styles/shared/animations.css` - Added gradient animation keyframes and utility classes
- `src/styles/theme.css` - Applied animated gradients to global elements
- `src/styles/shared/modal.css` - Added animated gradients to modal headers
- `src/styles/alerts.css` - Added animated gradients to alert components

---

### State Management Fixes

#### Issue: Button State Changes Requiring View Refresh
Fixed state synchronization issues in add/remove buttons and favorite toggles.

#### Files Modified:
1. **`src/components/ExperienceCard/ExperienceCard.jsx`**
   - Improved optimistic UI updates with proper error handling
   - Added `previousState` tracking for reliable state reversion on errors
   - Ensured `updateData()` is called and awaited properly

2. **`src/views/SingleExperience/SingleExperience.jsx`**
   - Fixed `handleExperience()` to refresh experience data after API calls
   - Fixed `handleAddExperience()` to refresh experience data and maintain consistency
   - Added optimistic updates with error recovery
   - Fixed button visibility issues in experience actions container

3. **`src/components/FavoriteDestination/FavoriteDestination.jsx`**
   - Improved state management with `previousState` tracking
   - Added null check for `getData()` function
   - Enhanced error handling and state reversion

#### Changes Made:
- **Optimistic Updates**: UI updates immediately before API call for better UX
- **Error Recovery**: Previous state is restored if API call fails
- **Data Refresh**: Proper awaiting of data refresh functions to ensure consistency
- **Loading States**: Better loading state management to prevent double-clicks

---

### Button Visibility Fixes

#### Issue: Edit Buttons Not Visible on Hover in SingleExperience View
Fixed visibility issues where edit/delete buttons weren't showing properly.

#### Files Modified:
- **`src/views/SingleExperience/SingleExperience.css`**
  - Added explicit visibility rules for `.experience-actions` buttons
  - Added explicit visibility rules for `.plan-item-actions` buttons
  - Ensured buttons are always visible with `opacity: 1` and `visibility: visible`
  - Added flex-wrap to experience actions for better responsive behavior

---

## Testing Notes

### Areas to Test
1. **OAuth Authentication**
   - Sign in with Facebook/Google/X
   - Account linking
   - Profile photo from OAuth providers
   - Error scenarios (network failures, OAuth denials)

2. **Permissions**
   - Super admin user management
   - Owner/Collaborator resource access
   - Permission inheritance
   - Legacy user field compatibility

3. **Plan Management**
   - Create/update/delete plans
   - Collaborative planning
   - Auto-deletion when empty
   - Plan metrics accuracy

4. **Forms**
   - All form fields render correctly
   - Tooltips position properly
   - Validation feedback works
   - Input groups styled correctly

5. **Modals**
   - Photo modals (no duplicates)
   - Form modals
   - Alert/Confirm modals
   - Responsive sizing

6. **Currency & URLs**
   - Currency formatting (whole vs decimal amounts)
   - URL normalization (auto-https prefix)
   - Edge cases (empty, invalid input)

---

*Last Updated: October 18, 2025*
