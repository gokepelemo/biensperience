# Biensperience Development Log

This document tracks major changes and architectural decisions in the Biensperience application.
For AI agent guidelines and workflows, see [AGENTS.md](./AGENTS.md).

## Current Version: 0.2.0

---

## Integrating with Beads (dependency‑aware task planning)

Beads provides a lightweight issue database and CLI tool (`bd`) for managing tasks. **Use beads for ALL task management, issue tracking, bug tracking, AND context storage.** Replace markdown files and TodoWrite tool with bd for better dependency tracking and persistent context.

### Why Use Beads?

**Problems with Traditional Task Management**:
- TodoWrite tool state is lost between sessions
- Markdown files become stale and scattered
- No dependency tracking between tasks
- Context is lost when switching between issues
- No central place to track "what was done" and "what's next"

**Beads Solution**:
- ✅ Persistent task database (survives session restarts)
- ✅ Dependency-aware (tracks which tasks block others)
- ✅ Context storage (attach notes, decisions, file references)
- ✅ Status tracking (ready, started, blocked, finished)
- ✅ Git integration (link commits to issues)
- ✅ CLI-first (perfect for AI agents)

### Task Management Workflow

**1. Check Current Work**:
```bash
bd ready              # See next available tasks
bd status             # See all active issues
bd show <issue_id>    # View issue details with context
```

**2. Create New Tasks**:
```bash
# Simple task
bd new "Fix failing API token tests"

# With dependencies
bd new "Create monitoring dashboard" --depends-on bd-123

# With tags
bd new "Optimize permission checks" --tag performance --tag security

# With description
bd new "Implement rate limiting" -m "Add rate limiting to permission mutations to prevent abuse. Consider using express-rate-limit with Redis backend."
```

**3. Work on Tasks**:
```bash
bd start <issue_id>   # Mark as started (shows in bd status)
bd edit <issue_id>    # Add context, notes, decisions
bd finish <issue_id>  # Mark as complete
```

**4. Track Blockers**:
```bash
bd block <issue_id> "Waiting for user feedback on permission model"
bd unblock <issue_id>
```

### Context Storage Best Practices

**CRITICAL: Use bd for Context Instead of Markdown Files**

**BAD (Traditional Approach)**:
```markdown
# TODO.md
- [ ] Fix permission tests
- [ ] Add rate limiting
- [ ] Create dashboard

# IMPLEMENTATION_NOTES.md
## Permission Tests
- Issue: Race condition in test
- Fix: Remove double-save
- Status: Complete
```

**GOOD (Beads Approach)**:
```bash
# Create issue with full context
bd new "Fix permission enforcer race condition test" \
  -m "Test calls resource.save() after enforcer already saved atomically.
Remove redundant save() calls and let enforcer handle atomic operations.

File: tests/api/permission-enforcer-security.test.js:559-586
Root cause: Manual save() after atomic findOneAndUpdate
Fix: Remove lines 577-583 and 598-604"

# Add context as work progresses
bd edit bd-123
# (Opens editor to add notes)

# Link git commit
git commit -m "fix: Remove double-save in race condition test

Refs: bd-123"

# Mark complete with summary
bd finish bd-123 -m "Test now passes. Removed manual save() calls on lines 577-583 and 598-604. Enforcer's atomic findOneAndUpdate handles all persistence."
```

### Documentation Storage

**Use bd for Work-in-Progress, Keep md for Architecture**:

| Use bd for | Use .md for |
|------------|-------------|
| ✅ Current tasks | ✅ Architecture decisions (CLAUDE.md) |
| ✅ Implementation notes | ✅ API reference docs |
| ✅ Bug tracking | ✅ Setup instructions |
| ✅ Feature planning | ✅ Security policies |
| ✅ Work context | ✅ Historical changelog |
| ✅ Blockers/dependencies | ✅ User-facing guides |
| ✅ "What's next" items | ❌ Task tracking |
| ✅ Temporary decisions | ❌ Work-in-progress notes |

**Example Workflow**:
```bash
# During feature implementation
bd new "Implement permission monitoring dashboard"
bd start bd-456
bd edit bd-456  # Add implementation notes, decisions, code references

# After feature complete
bd finish bd-456 -m "Dashboard complete. See controllers/api/monitoring.js"

# Then document in CLAUDE.md for posterity
# (Add to "Recent Major Changes" section with date, problem, solution)
```

### Agent Instructions for bd Usage

**Every Session Start**:
```bash
bd ready              # What should I work on?
bd status             # What's in progress?
bd show <issue_id>    # Read context for current work
```

**During Implementation**:
```bash
# Store decisions and context immediately
bd edit <issue_id>
# Add notes about:
# - File paths and line numbers
# - Why certain approaches were chosen
# - Blockers encountered
# - Dependencies discovered

# Create sub-tasks if issue is complex
bd new "Sub-task description" --depends-on <parent_id>
```

**After Completing Work**:
```bash
# Finish with summary
bd finish <issue_id> -m "Summary of what was done, files changed, and any follow-up needed"

# Create follow-up issues if needed
bd new "Follow-up task" --depends-on <completed_id>

# Update documentation if needed
# (CLAUDE.md for major changes, README for setup, etc.)
```

**When Blocked**:
```bash
bd block <issue_id> "Clear description of what's blocking"
bd new "Unblock task" --tag unblocking --depends-on <blocked_id>
```

### Common bd Commands Reference

```bash
# Viewing
bd ready              # Show next available tasks
bd status             # Show all active issues
bd show <id>          # Show issue details
bd list               # List all issues
bd list --tag <tag>   # Filter by tag

# Creating
bd new "description"                    # Create issue
bd new "desc" --depends-on <id>        # With dependency
bd new "desc" --tag <tag>              # With tag
bd new "desc" -m "long description"    # With body

# Updating
bd start <id>         # Mark as started
bd finish <id>        # Mark as finished
bd block <id> "why"   # Mark as blocked
bd unblock <id>       # Unblock
bd edit <id>          # Edit description/body

# Organizing
bd depends <id> <dependency_id>        # Add dependency
bd tag <id> <tag>                      # Add tag
bd priority <id> <high|medium|low>     # Set priority

# Help
bd help               # Show all commands
bd help <command>     # Command-specific help
```

### Integration with Git

**Link commits to issues**:
```bash
# In commit message
git commit -m "fix: Remove race condition

Refs: bd-123
Closes: bd-124"

# View issues linked to commits
bd show bd-123  # Shows linked commits
```

### Integration with CLAUDE.md

**After completing major work**:
1. ✅ Mark issue as finished in bd
2. ✅ Add summary to bd with `bd finish <id> -m "summary"`
3. ✅ Update CLAUDE.md "Recent Major Changes" section
4. ✅ Create follow-up issues if needed

**CLAUDE.md entries should reference bd issues**:
```markdown
### Permission Security Hardening (Nov 1, 2025)

**Issues**: bd-120, bd-121, bd-122
**Status**: Complete

[rest of documentation...]
```

### Example: Complete Feature Implementation Flow

```bash
# 1. User requests feature
# AI creates bd issue
bd new "Implement permission monitoring dashboard" \
  -m "User requested real-time dashboard for permission changes.

Requirements:
- WebSocket for real-time updates
- Filter by resource/user/action
- Export to CSV
- Admin-only access

Dependencies:
- Activity model (bd-45) - Complete
- Permission enforcer (bd-50) - Complete"

# 2. AI breaks down into sub-tasks
bd new "Create monitoring API endpoints" --depends-on bd-456
bd new "Create WebSocket event system" --depends-on bd-456
bd new "Create dashboard React component" --depends-on bd-457 --depends-on bd-458
bd new "Add admin authorization check" --depends-on bd-456

# 3. AI works on first ready task
bd ready  # Shows bd-457 is ready
bd start bd-457

# 4. AI implements and stores context
bd edit bd-457  # Add implementation notes as work progresses

# 5. AI completes task
bd finish bd-457 -m "Created GET /api/monitoring/permissions endpoint.
Returns paginated permission changes with filters.
File: controllers/api/monitoring.js
Tests: tests/api/monitoring.test.js"

git commit -m "feat: Add permission monitoring endpoints

Refs: bd-457"

# 6. AI continues with next ready tasks
bd ready  # Shows bd-458 is now ready
# ... repeat ...

# 7. After all sub-tasks complete
bd finish bd-456 -m "Dashboard complete and tested.
- Real-time updates via WebSocket
- CSV export working
- Admin-only access enforced
- 15 new tests added

Files:
- controllers/api/monitoring.js
- src/views/Monitoring/Dashboard.jsx
- tests/api/monitoring.test.js"

# 8. AI updates CLAUDE.md with architecture decisions
# (If this is a major feature worth documenting)
```

### Migration: TodoWrite → bd

**If you have existing TodoWrite todos**, convert them to bd:

```bash
# TodoWrite: "Fix API token tests"
bd new "Fix API token authentication tests" -m "Tests pass alone but fail in suite. Likely test isolation issue."

# TodoWrite: "Create security report"
bd new "Create permissions security verification report" -m "Document all security controls, test coverage, and compliance verification."

# Then clear TodoWrite
# (No need to maintain two systems)
```

**Note to Agent:** You interact with Beads exclusively through the `bd` command-line tool as part of your execution loop. This replaces TodoWrite for persistent task tracking. Use shared identifiers (e.g., `bd-123`) in commits, documentation, and code comments to link everything together.

## Recent Major Changes (November 2025)

### Vite Migration (Nov 2, 2025)

**Issue**: biensperience-e91d
**Status**: Complete

**Problem**:
- Create React App (CRA) is deprecated and unmaintained
- Slow development server startup (10-30 seconds)
- Slow production builds (30+ seconds)
- Large bundle sizes with suboptimal code splitting
- No native ES modules support
- Outdated tooling (Webpack 5, older Babel)

**Solution**: Migrated to Vite Build Tool

**Migration Steps**:

1. **Removed Create React App**
   - Uninstalled `react-scripts`
   - Removed CRA-specific configuration

2. **Installed Vite**
   - `vite@7.1.12` - Core build tool
   - `@vitejs/plugin-react@5.1.0` - React plugin with Fast Refresh
   - `vite-plugin-env-compatible@2.0.1` - Backward compatibility for `REACT_APP_` env vars

3. **Created Vite Configuration** ([vite.config.js](vite.config.js))
   - React plugin with JSX support in `.js` files
   - ESBuild loader configuration for JSX parsing
   - Environment variable compatibility (`REACT_APP_` prefix)
   - API proxy configuration (port 3000 → port 3001)
   - Path aliases (`@`, `@components`, `@views`, `@utilities`, etc.)
   - Optimized chunk splitting (React vendor, Bootstrap vendor, Icons)
   - Source maps enabled for debugging

4. **Restructured Project**
   - Moved `public/index.html` to root `index.html`
   - Updated asset paths (`%PUBLIC_URL%` → `/`)
   - Added Vite entry point script: `<script type="module" src="/src/index.jsx"></script>`
   - Renamed `src/index.js` → `src/index.jsx`

5. **Fixed ES Modules Compatibility**
   - Converted `src/lang.constants.js` from CommonJS to ES modules
     - Changed `module.exports` → `export`
   - Renamed `src/utilities/seo-meta.js` → `src/utilities/seo-meta.jsx` (contains JSX)
   - Updated imports to use `.jsx` extension where needed

6. **Updated Package Scripts**
   - `npm start` → `vite` (dev server)
   - `npm run dev` → `vite` (alias for start)
   - `npm run build` → `vite build` (production build)
   - `npm run preview` → `vite preview` (preview production build)
   - Removed `eject` script (no longer needed)

7. **Updated PM2 Configuration**
   - [ecosystem.config.js](ecosystem.config.js) already compatible
   - Uses `npm run build` which now runs Vite

**Performance Improvements**:
- **Dev server startup**: ~202ms (vs 10-30s with CRA) - **50-150x faster**
- **Production build**: ~5.15s (vs 30-60s with CRA) - **6-12x faster**
- **Hot Module Replacement (HMR)**: Instant (<50ms) vs 1-5s with CRA
- **Bundle size**: Optimized with better tree-shaking and code splitting

**Features**:
- ✅ Native ES modules in development
- ✅ Lightning-fast HMR
- ✅ Optimized production builds
- ✅ Better code splitting (React vendor, Bootstrap vendor, Icons)
- ✅ Path aliases for cleaner imports
- ✅ Source maps for debugging
- ✅ Backward compatible with `REACT_APP_` environment variables
- ✅ JSX support in `.js` files (for legacy compatibility)

**Architecture**:
- **Frontend dev server**: Port 3000 (Vite)
- **Backend API server**: Port 3001 (Express)
- **Proxy configuration**: `/api` and `/auth` routes proxied to port 3001

**Files Modified**:
- [vite.config.js](vite.config.js) - NEW: Vite configuration
- [index.html](index.html) - Moved from public/ to root
- [package.json](package.json) - Updated scripts and dependencies
- [.env.example](.env.example) - Documented REACT_APP_ compatibility
- [src/index.jsx](src/index.jsx) - Renamed from index.js
- [src/lang.constants.js](src/lang.constants.js) - Converted to ES modules
- [src/utilities/seo-meta.jsx](src/utilities/seo-meta.jsx) - Renamed from .js
- [src/utilities/useSEO.js](src/utilities/useSEO.js) - Updated import path
- [src/components/PageMeta/PageMeta.jsx](src/components/PageMeta/PageMeta.jsx) - Updated import path

**Breaking Changes**:
- None - fully backward compatible with existing code

**Build Warnings** (informational only, no impact):
- Dynamic imports mixed with static imports - Vite optimizes automatically

---

### CSS Optimization and Cleanup (Nov 1, 2025)

**Issue**: biensperience-068f
**Status**: Complete

**Problem**:
- Duplicate CSS across multiple files
- Unused animations bloating bundle size
- Duplicate token definitions in theme.css and design-tokens.css
- Redundant shared/animations.css file
- No clear separation of concerns

**Solution**: Systematic CSS Consolidation and Cleanup

**1. Consolidated animations.css**
- Reduced from 381 lines to 118 lines (-263 lines / 69% reduction)
- Removed unused animations: form field effects, button ripple, modal transitions, card animations, loading skeletons, tooltip animations, alert animations, image effects, dropdown animations, collapse animations, badge animations, nav animations
- Kept essential animations: fadeIn, fadeInUp, fadeInDown, fadeInScale, slideIn, gradientShift, pulse, spin, shake
- Retained essential utility classes: `.fade-in`, `.fade-in-up`, `.slide-in`, `.pulse`, `.spinner`, `.gradient-animated`
- Maintained reduced motion support for accessibility

**2. Refactored theme.css**
- Removed 41 lines of duplicate CSS custom property definitions
- Changed all hardcoded values to use `var()` references to design-tokens.css
- Eliminated duplicate token definitions (now only in design-tokens.css)
- Kept only theme-specific overrides: buttons, links, forms, Bootstrap component styles
- Single source of truth for design values

**3. Removed Duplicate shared/animations.css**
- Deleted 158-line file containing complete duplicates
- All gradient animations consolidated into main animations.css
- All basic animations (fadeIn, fadeInUp, slideIn) already in main file
- Updated [src/index.css](src/index.css) to remove import statement

**Results**:
- **Total reduction**: ~462 lines of CSS removed
- **Zero duplicates**: All duplicate token definitions eliminated
- **Cleaner imports**: Simplified import structure in index.css
- **Maintained functionality**: No features lost, all animations preserved
- **Better performance**: Smaller bundle size, faster parsing
- **Build status**: ✅ Compiling successfully

**Files Modified**:
- [src/styles/animations.css](src/styles/animations.css) - Consolidated (263 lines removed)
- [src/styles/theme.css](src/styles/theme.css) - Refactored to use design tokens (41 lines removed)
- [src/styles/shared/animations.css](src/styles/shared/animations.css) - DELETED (158 lines removed)
- [src/index.css](src/index.css) - Removed duplicate import

---

### Design System with Layout Shift Prevention (Nov 1, 2025)

**Issue**: biensperience-0500
**Status**: Complete

**Problem**:
- Headings could cause layout shifts during render
- Inconsistent spacing and sizing across views
- CSS scattered across multiple files
- No centralized design token system
- Potential cumulative layout shift (CLS) issues affecting Core Web Vitals

**Solution**: Comprehensive Design System

**1. Design Tokens** - Single Source of Truth
- Created centralized CSS custom properties
- Typography tokens: font families, weights, sizes, line heights, letter spacing
- Spacing scale: 0px → 96px (consistent 4px increments)
- Color palette: brand, text, background, semantic, borders
- Shadows: xs → xl scale for depth
- Border radius: sm → 2xl + full
- Transitions: fast → slow with easing curves
- Z-index scale for layering
- File: [src/styles/design-tokens.css](src/styles/design-tokens.css)

**2. Heading System** - Layout Shift Prevention
- CSS containment: `contain: layout style` on all headings
- Fixed hierarchy with predictable sizing
- Semantic variants: `.heading-page`, `.heading-section`, `.heading-card`, `.heading-sub`
- Modifiers: `.heading-center`, `.heading-truncate`, `.heading-underline`, `.heading-gradient`
- Consistent spacing between headings and content
- Accessibility: high contrast mode, reduced motion, focus styles
- File: [src/styles/headings.css](src/styles/headings.css)

**3. Utility Classes** - Atomic Design
- Text utilities: sizes, weights, colors, alignment, overflow
- Spacing utilities: margin, padding with design token scale
- Layout utilities: flexbox, grid, display
- Background & border utilities
- Shadow utilities
- Transition utilities
- Performance utilities: GPU acceleration, CSS containment
- Responsive utilities: hide/show at breakpoints
- Accessibility utilities: `.sr-only`, `.focus-visible`
- File: [src/styles/utilities.css](src/styles/utilities.css)

**4. Documentation** - Comprehensive Guide
- Usage examples for all systems
- Migration guide from legacy styles
- Component patterns (cards, forms, alerts)
- Performance best practices
- Testing for layout shifts with Lighthouse
- File: [src/styles/README.md](src/styles/README.md)

**5. CSS Module Pattern** - Component Isolation
- Recommended approach for component-specific styles
- Prevents style leakage
- Optimizes bundle size (only loads used styles)
- Better tree-shaking

**6. Consistent Button System** - Strict Consistency
- All buttons (`.btn`) get responsive padding: `clamp(0.5rem, 1.5vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)`
- Button sizes (`.btn-sm`, `.btn-lg`) with proportional padding
- Consistent font weight (600), size, border-radius across all variants
- Display: inline-flex for proper alignment
- Gap support for icons
- Global hover effect (translateY -2px, shadow increase)
- Ensures touch targets meet WCAG requirements (min 44x44px)

**Integration**:
- Updated [src/index.css](src/index.css) with proper import order
- Refactored [src/styles/shared/typography.css](src/styles/shared/typography.css) to use design tokens
- Backwards compatible with existing code
- Legacy styles marked for deprecation

**Example Usage**:
```jsx
// Using semantic classes
<h1 className="heading-page heading-center">
  Welcome to Biensperience
</h1>

// Using utility classes
<div className="mt-6 p-4 bg-secondary rounded-lg shadow-md">
  <h2 className="text-2xl font-bold text-primary mb-4">
    Section Title
  </h2>
  <p className="text-base text-secondary leading-relaxed">
    Content goes here
  </p>
</div>

// Using design tokens in component CSS
.custom-component {
  font-size: var(--font-size-lg);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
  contain: layout style;
}
```

**Files Created**:
1. `src/styles/design-tokens.css` - 200+ design tokens
2. `src/styles/headings.css` - Layout shift prevention system
3. `src/styles/utilities.css` - Atomic utility classes
4. `src/styles/README.md` - Complete documentation

**Files Modified**:
1. `src/index.css` - Added design system imports
2. `src/styles/shared/typography.css` - Refactored to use tokens
3. `src/styles/theme.css` - Added consistent button system with responsive padding

**Benefits**:
- ✅ Prevents layout shifts (CLS < 0.1 target)
- ✅ Consistent design language across entire app
- ✅ Optimized CSS performance
- ✅ Single source of truth for all design values
- ✅ Easy maintenance and updates
- ✅ Better developer experience
- ✅ Accessibility built-in
- ✅ Responsive design system
- ✅ CSS Module pattern for component isolation
- ✅ Well-documented for future development

**Performance Impact**:
- CSS containment prevents expensive reflows
- GPU acceleration for animated elements
- Font-display swap prevents FOIT
- Minimal CSS bloat with utility classes
- Better tree-shaking with CSS Modules

**Core Web Vitals**:
- **CLS (Cumulative Layout Shift)**: Improved with CSS containment
- **LCP (Largest Contentful Paint)**: Optimized font loading
- **FID (First Input Delay)**: Reduced with performance optimizations

---

### Typography & Text Visibility Improvements (Nov 1, 2025)

**Issue**: biensperience-1c73
**Status**: Complete

**Problem**:
- Travel Tips heading barely visible on light backgrounds
- Simple tips had fixed font sizes that didn't adapt to content length
- Inconsistent text sizing and colors across components
- No global typography system

**Solution**: Comprehensive Typography Overhaul

**1. Travel Tips Heading Enhancement**
- Font size increased 20%: `clamp(1.5rem, 3.5vw, 2rem)`
- Bolder weight (700), better contrast (`#2d3748`)
- Stronger border (3px) with text shadow
- File: [src/components/TravelTipsList/TravelTipsList.css](src/components/TravelTipsList/TravelTipsList.css)

**2. Dynamic Font Sizing for Simple Tips**
- Intelligent sizing based on text length using `useMemo`
- Short tips (<50 chars): `18-22px` (larger, more impactful)
- Medium tips (50-100 chars): `16-20px`
- Long tips (100-150 chars): `15-18px`
- Very long tips (>150 chars): `14-16px` (prevents overflow)
- File: [src/components/TravelTip/TravelTip.jsx](src/components/TravelTip/TravelTip.jsx)

**3. Global Typography System**
- Created comprehensive h1-h6 hierarchy with responsive `clamp()`
- Proper font weights (800 for h1, 700 for h2-h3, 600 for h4-h6)
- Better letter-spacing (-0.02em to -0.025em)
- Improved line-heights (1.3 headings, 1.6-1.7 body)
- Font smoothing: antialiased for all platforms
- File: [src/styles/shared/typography.css](src/styles/shared/typography.css)

**4. Standardized Color Palette**
```css
--color-text-dark:      #1a202c  /* Headings */
--color-text:           #2d3748  /* Body text */
--color-text-secondary: #4a5568  /* Notes, metadata */
--color-text-muted:     #a0aec0  /* Placeholders */
```

**Files Modified**:
1. `src/components/TravelTip/TravelTip.jsx` - Dynamic sizing logic
2. `src/components/TravelTip/TravelTip.css` - Enhanced styles
3. `src/components/TravelTipsList/TravelTipsList.css` - Heading improvements
4. `src/styles/shared/typography.css` - Global typography system
5. `src/styles/theme.css` - Button typography
6. `src/views/SingleDestination/SingleDestination.css` - Card typography

**Benefits**:
- ✅ Travel Tips heading now clearly visible
- ✅ Simple tips never overflow - auto-sizing based on content
- ✅ Larger font sizes for better readability
- ✅ Consistent typography across entire app
- ✅ Better accessibility (WCAG AA contrast)
- ✅ Responsive from mobile (280px) to 4K displays
- ✅ Performance optimized with `useMemo`

---

## Recent Major Changes (October 2025)

### Log Level Filtering System (Oct 26, 2025)

**Problem: Verbose Debug Logging**
- Debug logging was generating thousands of messages in short periods
- No way to control log verbosity at runtime
- Production environments showed excessive debug information
- Difficult to find relevant logs in development

**Solution: Environment-Based Log Level System**
- Implemented configurable log levels with runtime control
- 5 levels: ERROR (0), WARN (1), INFO (2), DEBUG (3), TRACE (4)
- Environment variable configuration
- Runtime level adjustment via API
- Automatic defaults based on NODE_ENV

**Frontend Logger ([src/utilities/logger.js](src/utilities/logger.js))**
```javascript
// Set via environment variable
REACT_APP_LOG_LEVEL=INFO  // or ERROR, WARN, DEBUG, TRACE

// Runtime control in browser console
logger.setLevel('ERROR')  // Reduce verbosity
logger.setLevel('TRACE')  // Maximum verbosity
logger.getLevel()         // Check current level
```

**Backend Logger ([utilities/backend-logger.js](utilities/backend-logger.js))**
```javascript
// Set via environment variable
LOG_LEVEL=2  // 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE

// Runtime control
backendLogger.setLevel('INFO')
backendLogger.getLevel()
```

**Default Behavior**:
- **Production**: ERROR level (minimal logging)
- **Development**: DEBUG level (comprehensive without trace)
- **Test**: INFO level (important events only)

**Log Level Guidelines**:
- `ERROR`: Critical errors that need immediate attention
- `WARN`: Potential issues or deprecated features
- `INFO`: Important application events (user actions, API calls)
- `DEBUG`: Development debugging information
- `TRACE`: Detailed trace information (very verbose)

**Environment Configuration** (.env.example updated):
```env
# Frontend logging
REACT_APP_LOG_LEVEL=DEBUG

# Backend logging
LOG_LEVEL=2                    # INFO level
LOG_CONSOLE=true               # Console output
LOG_FILE=false                 # File logging
LOG_FORWARDER=false            # HTTP forwarder
LOG_KAFKA=false                # Kafka integration
```

**Benefits**:
- ✅ Control log verbosity per environment
- ✅ Runtime level adjustment for debugging
- ✅ Reduced noise in production
- ✅ Better performance (filtered logs)
- ✅ Easier troubleshooting

---

### Responsive Form Fields with clamp() (Oct 26, 2025)

**Problem: Fixed Form Field Sizing**
- Form fields had static font sizes and padding
- Could become too small on mobile (unreadable)
- Could become too large on wide screens
- Form fields could be hidden when viewport reduced
- Failed WCAG touch target requirements

**Solution: CSS clamp() for Fluid Responsive Sizing**
- Created comprehensive responsive form styling
- All sizing uses clamp(min, preferred, max)
- Maintains readability across all viewport sizes
- Meets WCAG 2.1 Level AA touch targets (44x44px)

**New File: [src/styles/shared/forms.css](src/styles/shared/forms.css)**
```css
/* Form containers */
form {
  width: clamp(300px, 90%, 800px);  /* Never < 300px or > 800px */
}

/* Labels */
.form-label {
  font-size: clamp(0.875rem, 2vw, 1.25rem);  /* 14px - 20px */
}

/* Form controls */
.form-control {
  font-size: clamp(0.875rem, 1.5vw, 1.1rem);  /* 14px - 17.6px */
  padding: clamp(0.5rem, 1.5vw, 0.875rem) clamp(0.75rem, 2vw, 1.25rem);
  min-height: clamp(2.5rem, 6vw, 3.5rem);  /* 40px - 56px */
}

/* Buttons */
.btn {
  min-height: clamp(2.5rem, 6vw, 3rem);  /* Touch-friendly */
}
```

**Accessibility Features**:
- ✅ WCAG 2.1 Level AA touch targets (minimum 40px height)
- ✅ High contrast mode support
- ✅ Reduced motion support
- ✅ Enhanced focus states

**Responsive Breakpoints**:
- **Mobile (< 576px)**: Forms use 95% width, stack vertically
- **Tablet (576-991px)**: Forms use 85% width, balanced layout
- **Desktop (>= 992px)**: Forms use 75% width (max 800px), inline layout

**Benefits**:
- ✅ No form fields hidden at any viewport
- ✅ Readable text from 280px to 4K displays
- ✅ Smooth scaling without breakpoint jumps
- ✅ Better mobile usability
- ✅ Pure CSS (no JavaScript required)

---

### Dynamic Destination Creation in Forms (Oct 26, 2025)

**Problem: Creating Destinations from Experience Forms**
- Users typing non-existent destinations had no quick way to create them
- "+ Create New Destination" option was static in datalist
- Didn't appear when typing unknown destinations

**Solution: Dynamic Datalist Options**
- Implemented `getDestinationOptions()` to generate dynamic options
- Shows "✚ Create New: [user's typed text]" when input doesn't match
- Automatically opens NewDestinationModal when selected
- Pre-fills modal with user's typed input

**Implementation ([src/components/NewExperience/NewExperience.jsx](src/components/NewExperience/NewExperience.jsx))**:
```javascript
const getDestinationOptions = () => {
  const input = destinationInput || newExperience.destination || '';
  const options = [...destinations];

  // Always add create option
  if (input.trim() !== '') {
    options.push({
      name: '✚ Create New',
      country: input,
      isCreateOption: true
    });
  }
  return options;
};
```

**User Flow**:
1. User types "Tokyo" in destination field
2. Datalist shows: existing destinations + "✚ Create New: Tokyo"
3. User selects create option
4. Modal opens automatically with "Tokyo" pre-filled
5. User completes destination creation
6. Experience form updates with new destination

**Benefits**:
- ✅ Inline destination creation workflow
- ✅ Reduced form abandonment
- ✅ Better UX with context-aware options
- ✅ One-click from typing to creation

---

### Centered Form Headers (Oct 26, 2025)

**Updated all form headers for better visual balance**:
- Changed from `col-md-6` to `col-md-12` (full width)
- Added Bootstrap `text-center` class
- Applied to: NewExperience, NewDestination, UpdateExperience, UpdateDestination, UpdateProfile

**Visual Improvement**:
- ✅ Headers span full width
- ✅ Center-aligned for symmetry
- ✅ Consistent across all forms
- ✅ More professional appearance

---

### Encrypted Form Persistence (Oct 26, 2025)

**⚠️ Best Practice: All client-stored data must be encrypted**

**Problem: Unencrypted Form Data in localStorage**
- Form data saved in plain text localStorage
- Security risk for sensitive information
- No user-specific storage (data collision possible)
- No privacy protection

**Solution: Web Crypto API Encryption**
- Implemented PBKDF2 + AES-GCM 256-bit encryption
- User-specific storage keys prevent data leakage
- 24-hour TTL with automatic cleanup
- Backwards compatible with unencrypted data

**New Files**:
- **[src/utilities/crypto-utils.js](src/utilities/crypto-utils.js)**: Encryption/decryption utilities
- **[src/utilities/time-format.js](src/utilities/time-format.js)**: Friendly time formatting

**Encryption Implementation**:
```javascript
// Encrypt form data before storage
const encrypted = await encryptData(formData, userId);

// Decrypt on retrieval
const decrypted = await decryptData(encrypted, userId);
```

**Encryption Details**:
- **Algorithm**: AES-GCM 256-bit
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **IV**: Random 12-byte initialization vector per save
- **Encoding**: Base64 for localStorage compatibility
- **User-Specific**: Unique encryption key per user

**Form Persistence Features**:
- Automatic save after 1 second of inactivity
- Toast notification on restoration with age
- Context-aware messages ("creating" vs "updating")
- Clear form button in toast
- Encrypted storage for all form data

**Storage Format**:
```javascript
{
  data: "base64_encrypted_string",
  encrypted: true,
  timestamp: 1234567890,
  expiresAt: 1234567890 + ttl
}
```

**Usage in Forms**:
```javascript
const { user } = useUser();

const persistence = useFormPersistence(
  'form-id',
  formData,
  setFormData,
  {
    enabled: true,
    userId: user?._id,  // Enable encryption
    ttl: 24 * 60 * 60 * 1000,
    debounceMs: 1000,
    onRestore: (savedData, age) => {
      const message = formatRestorationMessage(age, 'create');
      success(message, { duration: 20000 });
    }
  }
);
```

**Security Benefits**:
- ✅ Form data encrypted at rest
- ✅ User-specific keys prevent cross-user access
- ✅ PBKDF2 adds computational cost for attackers
- ✅ Random IV prevents pattern analysis
- ✅ Authenticated encryption (AES-GCM)

**Best Practice Enforcement**:
> **All client-stored data MUST be encrypted**
> - localStorage data: Use crypto-utils.js
> - IndexedDB data: Use crypto-utils.js
> - Cookie data: Server-side encryption preferred
> - Never store sensitive data unencrypted

---

### Comprehensive Logging Migration (Oct 25, 2025)

**🚨 CRITICAL: NEVER USE console.log, console.warn, OR console.error DIRECTLY**

All logging must use the provided logging utilities:
- **Frontend**: `import logger from '../../utilities/logger'` then `logger.info()`, `logger.error()`, etc.
- **Backend**: `const backendLogger = require('../../utilities/backend-logger')` then `backendLogger.info()`, `backendLogger.error()`, etc.

**Replaced Console Statements with Structured Logging**
- Systematically replaced 200+ `console.log/error/warn` statements across codebase
- Frontend uses `logger` from [src/utilities/logger.js](src/utilities/logger.js)
- Backend uses `backendLogger` from [utilities/backend-logger.js](utilities/backend-logger.js)
- Structured logging format with context data and error objects

**Files Updated (24 total)**:
- Frontend contexts: UserContext, DataContext
- Frontend components: SearchBar, TagInput, ExperienceCard, FavoriteDestination, ImageUpload
- Frontend views: App, AllUsers, SingleDestination, ExperiencesByTag
- Frontend utilities: users-service, change-formatter, currency-utils
- Frontend hooks: useCollaboratorUsers
- Backend config: checkToken, database, passport
- Backend controllers: experiences (deprecated endpoints)
- Backend utilities: aws-s3-upload, error-handler
- Server: server.js

**Logging Methods**:
- `logger.error(message, {context}, error)` - Error events with full context
- `logger.warn(message, {context})` - Warning events
- `logger.info(message, {context})` - Important informational events
- `logger.debug(message, {context})` - Development/debugging information
- `logger.trace(message, {context})` - Detailed trace information

**Files Intentionally Skipped**:
- Test files (appropriate to use console in tests)
- Logger implementations themselves
- Debug utility wrapper
- Documentation/example files
- Standalone utility scripts (sampleData.js, test-email.js)

**Benefits**:
- ✅ Structured logging with consistent format
- ✅ Better debugging with context data
- ✅ Can be integrated with monitoring services
- ✅ Log levels allow filtering in production
- ✅ Error objects properly captured with stack traces

---

### Form Persistence with Browser Storage (Oct 25, 2025)

**Automatic Form Data Persistence**
- Created `src/utilities/form-persistence.js` for localStorage-based form saving
- Created `src/hooks/useFormPersistence.js` React hook for automatic save/restore
- Form data automatically saved after 1 second of inactivity
- 24-hour TTL (time-to-live) for saved data with automatic cleanup

**User Experience**
- Toast notification when form data is restored ("Form data restored from X minutes ago")
- Suggestion to continue editing or clear form to start fresh
- Data cleared automatically on successful form submission
- Data persists across page reloads and browser crashes

**Implementation**:
- `saveFormData(formId, data, ttl)` - Save form state to localStorage
- `loadFormData(formId)` - Load saved form state
- `clearFormData(formId)` - Clear saved data
- `cleanupExpiredForms()` - Remove expired entries
- Debounced saving (1 second) to avoid performance impact

**Integration**:
- NewDestination form: Saves destination details and travel tips
- NewExperience form: Saves experience details and tags
- Future: Can be added to any form component

**Email Verification UX**
- Email verification errors now include "Resend Verification Email" button
- Links to `/resend-confirmation` endpoint
- Clearer call-to-action for users with unverified emails

**Benefits**:
- ✅ No data loss from accidental page refresh or browser crash
- ✅ Better user experience for long forms
- ✅ Automatic cleanup prevents localStorage bloat
- ✅ Easy resend of verification emails
- ✅ Works offline (localStorage)

---

### Photo ID-Based Default Selection and Modal Navigation (Oct 25, 2025)

**ID-Based Photo Tracking**
- Changed `default_photo_index` from storing array index to storing photo `_id`
- Added `default_photo_id` field to Destination, Experience, and User models
- Photos now have `_id: true` in schema to enable MongoDB auto-generated IDs
- Created `utilities/photo-utils.js` (backend) and `src/utilities/photo-utils.js` (frontend)

**Photo Navigation in Modals**
- Enhanced PhotoModal with keyboard arrow key navigation (← →)
- Added previous/next navigation buttons in modal
- Display photo counter (e.g., "2 / 5")
- Updated PhotoCard to pass full photos array and navigation handler
- Smooth navigation between photos without closing modal

**Backend Updates**:
- Updated `controllers/api/destinations.js` to use photo utilities
- Updated `controllers/api/experiences.js` to use photo utilities
- Updated `controllers/api/users.js` to use photo utilities
- Support both `photoId` (new) and `photoIndex` (legacy) API parameters
- Photo removal uses `removePhoto()` utility which auto-adjusts default

**Frontend Updates**:
- Updated `PhotoModal` component with navigation UI and keyboard support
- Updated `PhotoCard` component to enable multi-photo browsing
- Updated `ImageUpload` component to use logger instead of console.log

**Utility Functions**:
- `getDefaultPhoto(resource)` - Get default photo object
- `setDefaultPhotoById(resource, photoId)` - Set default by ID
- `setDefaultPhotoByIndex(resource, index)` - Set default by index (legacy)
- `ensureDefaultPhotoConsistency(resource)` - Maintain ID/index sync
- `removePhoto(resource, photoId)` - Remove photo and adjust default

**Benefits**:
- ✅ Default photo persists correctly even if photo order changes
- ✅ Better user experience with in-modal photo browsing
- ✅ Keyboard accessibility (arrow keys + Escape)
- ✅ Backwards compatible with index-based API
- ✅ Automatic default photo management

---

### Email Verification and String Audit (Oct 25, 2025)

**Email Verification Middleware**
- Created `email-verification-middleware.js` to protect content creation
- Requires verified email for creating/updating experiences and destinations
- OAuth users automatically verified
- Super admins bypass verification check
- Returns descriptive 403 errors with `EMAIL_NOT_VERIFIED` code

**Protected Routes**:
- POST `/api/experiences` - Create experience
- PUT `/api/experiences/:id` - Update experience
- POST `/api/destinations` - Create destination
- PUT `/api/destinations/:id` - Update destination

**Frontend Integration**:
- Updated NewExperience, NewDestination, UpdateExperience, UpdateDestination
- Shows Alert component with verification error message
- Form remains editable after error
- Added email verification strings to lang.constants.js

**Comprehensive String Audit**:
- Identified 213+ hardcoded strings across all JSX files
- Categorized by type: errors, buttons, labels, placeholders, alerts, tooltips, headings, loading states, navigation
- Created detailed audit document: `documentation/STRING_AUDIT_RESULTS.md`
- Added priority strings to `lang.constants.js`
- Future work: systematic migration of all strings for i18n support

**Documentation**:
- Created `documentation/EMAIL_VERIFICATION_IMPLEMENTATION.md`
- Updated `documentation/DATA_MODEL.md` with User model fields and UX flows
- Added 6 comprehensive user experience flow diagrams with success/failure states

**Benefits**:
- ✅ Prevents spam and bot accounts from creating content
- ✅ Ensures user email validity
- ✅ Improves data quality
- ✅ Better i18n preparation
- ✅ Comprehensive UX documentation

---

### Sample Data Generator Interactive Mode (Oct 25, 2025)

**Interactive Super Admin Setup**
- Added `readline` module for interactive prompts
- Prompts for super admin name and email if not provided via flags
- Email validation with regex
- Name presence validation
- Re-prompts on invalid input

**Command-Line Flags**:
- `--admin-name "Full Name"` - Set super admin name
- `--admin-email "email@domain"` - Set super admin email
- Maintains existing `--clear` and `--help` flags

**Output to File**:
- All output written to `sampleData.txt` AND displayed in terminal
- Created `OutputManager` class for dual output
- File includes super admin credentials for reference
- Already in `.gitignore` for security

**Updated Help**:
- Added examples for all usage modes
- Documented output file creation
- Security notes about password storage

**Usage Examples**:
```bash
# Interactive mode
node sampleData.js

# With flags
node sampleData.js --admin-name "John Doe" --admin-email "john@example.com"

# Clear database with custom admin
node sampleData.js --clear --admin-name "Admin" --admin-email "admin@test.com"
```

**Benefits**:
- ✅ No more randomized super admin credentials
- ✅ Persistent credential reference in sampleData.txt
- ✅ User-friendly interactive prompts
- ✅ Flexible flag-based or interactive usage
- ✅ Complete audit trail of generated data

---

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
- `utilities/api-logger-middleware.js` - API request/response logging (consolidated)
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

### Compatibility Notes
- Cookie utility transitions from individual cookies to JSON-encoded cookies
- Old cookies naturally expire and get replaced
- Photo system uses ID-based default selection with index fallback

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
