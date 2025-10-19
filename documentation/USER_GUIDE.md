# Biensperience User Guide

## Overview
Biensperience is a collaborative travel experience planning platform that helps users discover, plan, and share travel experiences around the world.

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Features](#features)
4. [Admin Features](#admin-features)
5. [Technical Features](#technical-features)

---

## Getting Started

### Creating an Account
- **Email Signup**: Register with email, name, and password
- **Social Login**: Sign in with Facebook, Google, or X (Twitter)
- **Profile Setup**: Add profile photo and favorite destinations

### Authentication
- Secure JWT-based authentication
- HTTP-only cookies for token storage
- 24-hour session duration
- OAuth 2.0 for social logins

---

## User Roles & Permissions

### Regular Users
- Create and manage own destinations and experiences
- Add experiences to personal plans
- Collaborate on shared plans
- Favorite destinations
- View other users' public content

### Super Admins
- All regular user capabilities
- Full CRUD access to all destinations, experiences, and plans
- Edit any user's profile
- Manage user roles via Admin Panel
- Access to user management dashboard

### Resource-Level Permissions
- **Owner**: Full control (creator of resource)
- **Collaborator**: Can edit and modify plan items
- **Contributor**: Can add posts (reserved for future)

---

## Features

### Destinations

#### Creating Destinations
- Name, city, state/province, country
- Photos with credits
- Travel tips from the community

#### Managing Destinations
- Update destination details
- Add/remove photos
- Share travel tips
- Mark as favorite

### Experiences

#### Creating Experiences
- Linked to specific destination
- Experience types (tags): Culinary, Adventure, Cultural, etc.
- Photos and descriptions
- Estimated cost and planning time
- Multi-step plan items

#### Planning Experiences
- Add experience to personal plan
- Set planned date
- Track completion status
- Manage plan items:
  - Mark items complete
  - Track actual vs estimated costs
  - Hierarchical items (parent/child structure)
  - Add custom URLs and notes

#### Collaborative Planning
- Invite collaborators to plans
- Real-time collaboration
- See who else is planning the same experience
- Avatar display for all collaborators

### Plans

#### Plan Management
- Automatic plan creation when adding experience
- Track completion percentage
- Monitor costs (estimated vs actual)
- Sync plans when experience details change
- Plans auto-delete when empty (with no completed items)

#### Plan Synchronization
- Detect when experience plan has changed
- Review added, removed, and modified items
- Selective sync (choose which changes to apply)
- Preserve completion status and actual costs

---

## Admin Features

### User Management Dashboard
**Access**: Super Admins only

Features:
- **Statistics**: Total users, Super Admins, Regular Users
- **Search**: Find users by name or email
- **Filter**: View by role (All, Super Admins, Regular Users)
- **Sort**: Click column headers to sort
- **Role Management**: Promote/demote users
- **Safety**: Cannot change own role

### Profile Management
Super Admins can:
- View any user's profile
- Edit profile details (name, email, photos)
- Helpful for account support and moderation

---

## Technical Features

### Security

#### Authentication & Authorization
- Bcrypt password hashing (12 salt rounds)
- CSRF protection on OAuth flows
- Rate limiting on auth endpoints (5 attempts/15 min)
- Secure HTTP-only cookies
- Permission-based access control

#### Data Protection
- No sensitive data in logs
- Input sanitization across all endpoints
- Helmet.js HTTP security headers
- SQL injection prevention
- XSS protection with DOMPurify

### Performance

#### Optimizations
- Efficient MongoDB queries with indexing
- Pagination for large datasets
- Response caching where appropriate
- GPU-accelerated CSS animations
- Lazy loading for images

#### Cookie Management
- Single JSON-encoded cookie vs multiple cookies
- 90% reduction in cookie count
- 40-50% smaller storage footprint
- Automatic cleanup of expired data
- localStorage fallback support

### User Experience

#### Real-Time Updates
- Profile changes appear instantly in navbar
- No logout/login required
- Optimistic UI updates
- Error recovery with state reversion

#### Responsive Design
- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly interfaces
- Responsive typography with clamp()

#### Accessibility
- Proper ARIA labels
- Sufficient color contrast
- Focus states on all interactive elements
- Semantic HTML
- Keyboard navigation support

### Forms & Validation

#### Smart Forms
- Unified FormField component
- Bootstrap integration
- Automatic validation feedback
- Input groups (currency, time units)
- Tooltip support with Popper.js

#### Data Normalization
- Automatic HTTPS prefix for URLs
- Currency formatting (smart decimal handling)
- Date validation and formatting

### Internationalization

#### String Management
- All UI strings in `lang.constants.js`
- Easy translation support
- Centralized text management
- Dynamic content with placeholders

---

## API Structure

### Endpoints

**Authentication**:
- POST `/api/users` - Create account
- POST `/api/users/login` - Login
- GET `/api/users/check-token` - Validate session
- GET `/api/auth/:provider` - OAuth login

**Destinations**:
- GET `/api/destinations` - List all
- POST `/api/destinations` - Create
- GET `/api/destinations/:id` - View one
- PUT `/api/destinations/:id` - Update
- DELETE `/api/destinations/:id` - Delete

**Experiences**:
- GET `/api/experiences` - List all
- POST `/api/experiences` - Create
- GET `/api/experiences/:id` - View one
- PUT `/api/experiences/:id` - Update
- DELETE `/api/experiences/:id` - Delete

**Plans**:
- GET `/api/plans/user/:userId` - User's plans
- POST `/api/plans/experience/:experienceId` - Create plan
- PUT `/api/plans/:planId` - Update plan
- DELETE `/api/plans/:planId` - Delete plan

**Admin** (Super Admin only):
- GET `/api/users/all` - All users
- PUT `/api/users/:id/role` - Update user role

---

## Development

### Tech Stack

**Frontend**:
- React 18.2.0
- React Router 6.17.0
- React Bootstrap 2.9.0
- Bootstrap 5.3.8
- React Icons 5.5.0

**Backend**:
- Express 4.18.2
- Mongoose 7.6.2
- Passport 0.7.0 (OAuth)
- JWT (jsonwebtoken 9.0.2)
- AWS SDK S3 Client 3.705.0

**Development Tools**:
- Storybook 9.1.10
- Jest 27.5.1
- Supertest 7.1.4
- MongoDB Memory Server 10.2.3

### Environment Variables

Required configuration:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/biensperience

# JWT
SECRET=your-jwt-secret

# OAuth (optional)
FACEBOOK_APP_ID=...
GOOGLE_CLIENT_ID=...
TWITTER_CLIENT_ID=...

# AWS S3 (for photos)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

### Scripts

```bash
# Development
npm start                 # Start dev server
npm test                  # Run tests
npm run test:api          # Backend API tests
npm run storybook         # Component library

# Production
npm run build             # Build for production
npm run pm2:start         # Start with PM2
npm run pm2:restart       # Restart PM2
npm run pm2:stop          # Stop PM2
```

---

## Best Practices

### For Users
1. Use descriptive names for experiences and destinations
2. Add photos to make content discoverable
3. Share travel tips to help the community
4. Keep plans updated with actual costs and completion
5. Collaborate with fellow travelers

### For Developers
1. Follow conventional commit messages
2. Add tests for new features
3. Document breaking changes
4. Use lang.constants for all UI strings
5. Maintain accessibility standards

---

## Support

### Common Issues

**Can't edit a destination/experience**:
- Verify you're the owner or Super Admin
- Check if you're logged in
- Try refreshing the page

**Plan out of sync**:
- Click "Sync Now" button
- Review and select changes to apply
- Completion status will be preserved

**Profile changes not showing**:
- Changes should appear instantly
- If not, check browser console for errors
- Clear cache and refresh

### Getting Help
- Check documentation in `/documentation`
- Review error messages in browser console
- Contact admin for account issues

---

*Last Updated: January 2025*
*Version: 0.1.2*
