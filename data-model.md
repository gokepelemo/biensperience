# Biensperience Data Model

Complete reference for all MongoDB collections and their relationships.

## Platform Overview

Biensperience is a collaborative travel planning platform that enables users to create, share, and plan travel experiences. The platform features:

- **Experience Creation**: Users create detailed travel experiences with hierarchical plan items, photos, cost estimates, and cost tracking
- **Collaborative Planning**: Users can create personal plans from experiences and collaborate with others during the experience
- **Document Management**: Upload and process travel documents with AI-powered data extraction
- **Social Features**: Follow users, favorite destinations, and share experiences
- **Permission System**: Role-based access control with inheritance (owner → collaborator → contributor)
- **Audit Logging**: Complete activity tracking for all data changes
- **API Access**: Token-based programmatic access to platform features

## Data Flow Architecture

### Frontend State Management

The application uses a multi-layered state management approach:

#### 1. React Context Layer
- **DataContext**: Centralized state for destinations, experiences, and plans with optimistic updates
- **UserContext**: User authentication, profile, and preferences
- **ToastContext**: Global notification system
- **NavigationIntentContext**: Navigation state management
- **ExperienceWizardContext**: Multi-step experience creation flow

#### 2. Event-Driven Updates
- **Event Bus**: Cross-tab synchronization using vector clocks for causal ordering
- **Optimistic UI**: Immediate UI updates with conflict resolution
- **Stale-While-Revalidate**: Background data refresh while showing cached data

#### 3. Local Storage & Persistence
- **Form Persistence**: Automatic draft saving with encryption
- **Session Management**: User sessions with automatic cleanup
- **Preferences**: Theme, currency, timezone, language persistence

### API Architecture

#### Controller Pattern
All API endpoints follow a consistent pattern:
```javascript
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const { enforcePermission } = require('../../utilities/permission-enforcer');

async function update(req, res) {
  try {
    const resource = await Model.findById(req.params.id);
    const canEdit = await enforcePermission(req.user, resource, 'collaborator');
    if (!canEdit) return errorResponse(res, null, 'Insufficient permissions', 403);

    Object.assign(resource, req.body);
    await resource.save();
    return successResponse(res, resource, 'Updated successfully');
  } catch (error) {
    return errorResponse(res, error, 'Error updating resource');
  }
}
```

#### Permission Enforcement
- **Frontend**: UI hiding/disabling based on permissions
- **Backend**: Database-level permission checks on all mutations
- **Inheritance**: Permissions flow from destinations to experiences to plans
- **Roles**: Owner (full control) → Collaborator (edit) → Contributor (view)

#### Response Format
```javascript
// Success
{ success: true, data: {...}, message: "..." }

// Error
{ success: false, error: "Error message", details: {...} }
```

### Component Architecture

#### Design System
Reusable component library with consistent styling:
- **Button**: Primary actions with variants (primary, outline, success, etc.)
- **Pill**: Status indicators and tags
- **SkeletonLoader**: Loading state placeholders
- **Form**: Unified form components with validation
- **Table**: Responsive data tables
- **Layout**: Flex utilities (FlexBetween, FlexCenter, SpaceY, Container)

#### Component Patterns
- **Optimistic Updates**: Immediate UI feedback with error rollback
- **Loading States**: Skeleton placeholders prevent layout shift
- **Error Boundaries**: Graceful error handling
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CORE ENTITIES                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│    ┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐           │
│    │     User     │◄────────│   Destination    │◄────────│   Experience     │           │
│    ├──────────────┤ creator ├──────────────────┤ belongs ├──────────────────┤           │
│    │ _id          │         │ _id              │   to    │ _id              │           │
│    │ name         │         │ name             │         │ name             │           │
│    │ email        │         │ country          │         │ destination ────►├───────────┤
│    │ password     │         │ state            │         │ overview         │           │
│    │ role         │         │ overview         │         │ plan_items[]     │           │
│    │ preferences  │         │ travel_tips[]    │         │ experience_type  │           │
│    │ photos[]     │         │ photos[] ───────►├─────────│ photos[] ───────►├───────────┤
│    │ location     │         │ visibility       │         │ visibility       │           │
│    │ apiEnabled   │         │ permissions[]    │         │ permissions[]    │           │
│    │ visibility   │         │ users_favorite[] │         │ difficulty       │           │
│    └──────┬───────┘         └──────────────────┘         │ rating           │           │
│           │                                               └────────┬─────────┘           │
│           │ owns                                                   │                     │
│           │                                                        │ template for        │
│           ▼                                                        ▼                     │
│    ┌──────────────┐                                        ┌──────────────────┐          │
│    │     Plan     │◄───────────────────────────────────────│  (Experience)    │          │
│    ├──────────────┤           derived from                 └──────────────────┘          │
│    │ _id          │                                                                      │
│    │ user ───────►├───────────────────┐                                                  │
│    │ experience ──┤                   │                                                  │
│    │ planned_date │                   │                                                  │
│    │ plan[]       │◄──────────────────┼─────── plan item snapshots                       │
│    │ costs[]      │                   │                                                  │
│    │ permissions[]│                   │                                                  │
│    │ notes        │                   │                                                  │
│    └──────────────┘                   │                                                  │
│                                       │                                                  │
├───────────────────────────────────────┼─────────────────────────────────────────────────┤
│                                 SUPPORTING ENTITIES                                      │
├───────────────────────────────────────┴─────────────────────────────────────────────────┤
│                                                                                          │
│    ┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐           │
│    │    Photo     │         │    Document      │         │   InviteCode     │           │
│    ├──────────────┤         ├──────────────────┤         ├──────────────────┤           │
│    │ _id          │         │ _id              │         │ _id              │           │
│    │ url          │         │ user             │         │ code             │           │
│    │ s3_key       │         │ entityType       │         │ createdBy ──────►├───────────┤
│    │ photo_credit │         │ entityId         │         │ email            │           │
│    │ caption      │         │ s3Key            │         │ experiences[]    │           │
│    │ width/height │         │ extractedText    │         │ destinations[]   │           │
│    │ permissions[]│         │ aiParsedData     │         │ maxUses          │           │
│    └──────────────┘         │ status           │         │ usedCount        │           │
│                             │ metadata[]       │         │ redeemedBy[]     │           │
│                             │ permissions[]    │         │ expiresAt        │           │
│                             └──────────────────┘         │ permissionType   │           │
│                                                          └──────────────────┘           │
│                                                                                          │
│    ┌──────────────┐         ┌──────────────────┐         ┌──────────────────┐           │
│    │   Activity   │         │     Follow       │         │    ApiToken      │           │
│    ├──────────────┤         ├──────────────────┤         ├──────────────────┤           │
│    │ _id          │         │ _id              │         │ _id              │           │
│    │ timestamp    │         │ follower ───────►├─────────│ user ───────────►├───────────┤
│    │ action       │         │ following ──────►├─────────│ tokenHash        │           │
│    │ actor        │         │ status           │         │ tokenPrefix      │           │
│    │ resource     │         └──────────────────┘         │ name             │           │
│    │ target       │                 │                    │ lastUsed         │           │
│    │ previousState│                 │                    │ expiresAt        │           │
│    │ newState     │                 ▼                    │ isActive         │           │
│    │ changes[]    │         ┌──────────────────┐         └──────────────────┘           │
│    │ rollbackToken│         │ User ◄───► User  │                                        │
│    │ metadata     │         │ (social graph)   │                                        │
│    └──────────────┘         └──────────────────┘                                        │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Schema Reference

### User

Authentication and profile data for platform users.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `name` | String | User's full name |
| `email` | String | Unique email address (lowercase, trimmed) |
| `password` | String | bcrypt hashed password |
| `provider` | String | Auth provider: `local`, `facebook`, `google`, `twitter` |
| `facebookId` | String | Facebook OAuth ID |
| `googleId` | String | Google OAuth ID |
| `twitterId` | String | Twitter OAuth ID |
| `oauthProfilePhoto` | String | OAuth profile photo URL |
| `linkedAccounts` | Array | Linked social accounts |
| `photos` | [ObjectId] | References to Photo documents |
| `default_photo_id` | ObjectId | Default profile photo |
| `isSuperAdmin` | Boolean | Super admin flag |
| `role` | String | `super_admin` or `regular_user` |
| `resetPasswordToken` | String | Password reset token |
| `resetPasswordExpires` | Date | Token expiration |
| `emailConfirmed` | Boolean | Email verification status |
| `emailConfirmationToken` | String | Email confirmation token |
| `currentSessionId` | String | Active session ID |
| `sessionCreatedAt` | Number | Session creation timestamp |
| `sessionExpiresAt` | Number | Session expiration timestamp |
| `visibility` | String | `private` or `public` |
| `preferences` | Object | Theme, currency, language, timezone, notifications |
| `inviteCode` | String | Invite code used during signup |
| `apiEnabled` | Boolean | API access enabled |
| `location` | Object | GeoJSON location with city, state, country, coordinates |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `email`, `role`, `provider`, `resetPasswordToken`, `emailConfirmationToken`, `currentSessionId`, `sessionExpiresAt`, `createdAt`, `photos`, `default_photo_id`, `location.coordinates` (2dsphere), `location.city`, `location.country`

---

### Destination

Travel destinations that contain experiences.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `name` | String | Destination name |
| `country` | String | Country name |
| `state` | String | State/province (optional) |
| `overview` | String | Destination description |
| `map_location` | String | Map embed or coordinates |
| `users_favorite` | [ObjectId] | Users who favorited this destination |
| `photos` | [ObjectId] | References to Photo documents |
| `default_photo_id` | ObjectId | Default display photo |
| `travel_tips` | [Mixed] | Array of tips (string or structured object) |
| `visibility` | String | `private`, `contributors`, or `public` |
| `permissions` | [Permission] | Access control list |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Permission Sub-schema:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | User/entity ID |
| `entity` | String | `user`, `destination`, or `experience` |
| `type` | String | `owner`, `collaborator`, or `contributor` |

**Indexes:** `name+country`, `country`, `permissions._id`, `users_favorite`, `createdAt`, `photos`, `default_photo_id`

---

### Experience

Travel experiences/itineraries containing plan items.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `name` | String | Experience name |
| `overview` | String | Description |
| `destination` | ObjectId | Reference to Destination |
| `map_location` | String | Map embed or coordinates |
| `experience_type` | [String] | Tags/categories |
| `experience_type_slugs` | [String] | Slugified tags for search |
| `plan_items` | [PlanItem] | Template plan items |
| `photos` | [ObjectId] | References to Photo documents |
| `default_photo_id` | ObjectId | Default display photo |
| `visibility` | String | `private`, `contributors`, or `public` |
| `permissions` | [Permission] | Access control list |
| `difficulty` | Number | 1-10 scale |
| `rating` | Number | 1-5 scale (supports 0.5 increments) |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Virtual Fields:**
- `cost_estimate` - Calculated sum of all plan item costs
- `max_planning_days` - Maximum planning days from plan items
- `completion_percentage` - Always 0 (completion tracked per-plan)

**PlanItem Sub-schema:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Item ID |
| `text` | String | Item description |
| `photo` | ObjectId | Reference to Photo |
| `url` | String | External link |
| `cost_estimate` | Number | Estimated cost |
| `planning_days` | Number | Days needed |
| `parent` | ObjectId | Parent item for hierarchy |
| `activity_type` | String | `food`, `transport`, `accommodation`, `activity`, `shopping`, `entertainment`, `sightseeing`, `custom` |
| `location` | Object | Address and GeoJSON coordinates |

**Indexes:** `destination`, `name`, `permissions._id+type`, `experience_type`, `experience_type_slugs`, `destination+createdAt`, `createdAt`, `photos`, `default_photo_id`

---

### Plan

User-specific plan derived from an experience.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `experience` | ObjectId | Reference to Experience |
| `user` | ObjectId | Plan owner |
| `planned_date` | Date | Scheduled date |
| `plan` | [PlanItemSnapshot] | Point-in-time item snapshots |
| `costs` | [Cost] | Additional costs |
| `permissions` | [Permission] | Access control list |
| `notes` | String | Plan notes |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Virtual Fields:**
- `total_cost` - Sum of item costs + additional costs
- `max_planning_days` - Maximum planning days from items
- `completion_percentage` - Percentage of completed items

**PlanItemSnapshot Sub-schema:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Snapshot ID |
| `plan_item_id` | ObjectId | Reference to original Experience.plan_items |
| `complete` | Boolean | Completion status |
| `cost` | Number | User-specific cost |
| `planning_days` | Number | User-specific days |
| `text` | String | Item text snapshot |
| `url` | String | URL snapshot |
| `photo` | ObjectId | Photo reference |
| `parent` | ObjectId | Parent item reference |
| `activity_type` | String | Activity type |
| `scheduled_date` | Date | User-specific date |
| `scheduled_time` | String | HH:MM format |
| `location` | Object | Address and GeoJSON coordinates |
| `details` | Object | Notes, chat, photos, documents, transport, parking, discount |
| `assignedTo` | ObjectId | Collaborator assignment |

**Cost Sub-schema:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Cost ID |
| `title` | String | Cost name |
| `description` | String | Details |
| `cost` | Number | Amount |
| `currency` | String | Currency code |
| `plan_item` | ObjectId | Linked plan item |
| `plan` | ObjectId | Reference to Plan |
| `collaborator` | ObjectId | Responsible user |
| `created_at` | Date | Creation timestamp |

**Transport Extension:** Contains mode-specific details for flights, trains, cruises, buses, rideshare, metro, bike rentals.

**Parking Extension:** Stores parking details with type, location, times, costs.

**Discount Extension:** Stores promo codes with discount type, value, expiration.

**Indexes:** `experience+user` (unique), `user`, `experience`, `user+updatedAt`, `experience+permissions._id+type`, `permissions._id+entity`, `plan.location.geo` (2dsphere)

---

### Photo

Photos attached to users, destinations, experiences, or plans.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `url` | String | Public URL |
| `s3_key` | String | S3 object key |
| `photo_credit` | String | Credit attribution |
| `photo_credit_url` | String | Credit link |
| `caption` | String | Photo description |
| `width` | Number | Image width in pixels |
| `height` | Number | Image height in pixels |
| `permissions` | [Permission] | Access control list |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `permissions._id`, `url`, `createdAt`

---

### Document

Uploaded documents with S3 storage and AI processing.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `user` | ObjectId | Document owner |
| `entityType` | String | `plan`, `plan_item`, `experience`, `destination` |
| `entityId` | ObjectId | Attached entity ID |
| `planId` | ObjectId | Plan reference (when entityType is plan_item) |
| `planItemId` | ObjectId | Plan item reference |
| `originalFilename` | String | Original file name |
| `mimeType` | String | MIME type |
| `fileSize` | Number | File size in bytes |
| `documentType` | String | `pdf`, `image`, `word`, `text` |
| `s3Key` | String | S3 object key |
| `s3Url` | String | S3 URL |
| `s3Bucket` | String | S3 bucket name |
| `status` | String | `pending`, `processing`, `completed`, `failed`, `reprocessing` |
| `extractedText` | String | OCR/extracted text |
| `processingResult` | Object | Extraction method, confidence, page count |
| `aiParsedData` | Object | AI-extracted structured data |
| `aiParsingEnabled` | Boolean | Enable AI parsing |
| `permissions` | [Permission] | Access control list |
| `processingOptions` | Object | Language, force LLM, hints |
| `metadata` | [Metadata] | Custom key-value storage |
| `lastProcessedAt` | Date | Last processing timestamp |
| `processAttempts` | Number | Processing attempt count |
| `maxProcessAttempts` | Number | Max retry attempts |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**aiParsedData Fields:** documentType, summary, airline, flightNumber, hotelName, confirmationNumber, totalCost, currency, and type-specific fields.

**Virtual Fields:**
- `canReprocess` - Whether document can be reprocessed
- `isProcessed` - Whether processing completed successfully

**Indexes:** `user`, `entityId`, `user+entityType+entityId`, `planId+planItemId`, `status+createdAt`, `permissions._id+entity`

---

### Activity

Universal audit log for all entity changes.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `timestamp` | Date | Activity timestamp |
| `action` | String | Action type (see enum below) |
| `actor` | Object | User who performed action (_id, email, name, role) |
| `resource` | Object | Affected resource (id, type, name) |
| `target` | Object | Target entity for relationship actions |
| `permission` | Object | Permission-specific data |
| `previousState` | Mixed | State before change (for rollback) |
| `newState` | Mixed | State after change |
| `changes` | Array | Field-level changes |
| `reason` | String | Human-readable reason |
| `metadata` | Object | IP address, user agent, request path/method |
| `rollbackToken` | String | Unique token for state restoration |
| `rollbackOf` | ObjectId | Reference to original activity if rollback |
| `tags` | [String] | Categorization tags |
| `status` | String | `success`, `failure`, `partial` |
| `error` | Object | Error details if failed |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Action Types:**
- Permission: `permission_added`, `permission_removed`, `permission_updated`, `ownership_transferred`
- Resource: `resource_created`, `resource_updated`, `resource_deleted`
- User: `user_registered`, `user_updated`, `user_deleted`, `email_verified`, `password_changed`, `profile_updated`
- Plan: `plan_created`, `plan_updated`, `plan_deleted`, `plan_item_completed`, `plan_item_uncompleted`, `plan_item_note_*`
- Cost: `cost_added`, `cost_updated`, `cost_deleted`
- Social: `favorite_added`, `favorite_removed`, `collaborator_added`, `collaborator_removed`, `follow_*`
- System: `data_imported`, `data_exported`, `backup_created`, `rollback_performed`

**Resource Types:** `User`, `Experience`, `Destination`, `Photo`, `Plan`, `PlanItem`, `Follow`

**Indexes:** `timestamp`, `action`, `actor._id`, `resource.id`, `resource.type`, `target.id`, `tags`, `rollbackToken`, various compound indexes

---

### Follow

Social follow relationships between users.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `follower` | ObjectId | User who is following |
| `following` | ObjectId | User being followed |
| `status` | String | `active`, `pending`, `blocked` |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `follower+following` (unique), `follower+status`, `following+status`

---

### InviteCode

Invite codes for user onboarding with pre-configured resources.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `code` | String | Human-readable code (XXX-XXX-XXX format) |
| `createdBy` | ObjectId | User who created invite |
| `email` | String | Restricted email (optional) |
| `inviteeName` | String | Invitee name for personalization |
| `experiences` | [ObjectId] | Experiences to add on signup |
| `destinations` | [ObjectId] | Destinations to favorite on signup |
| `maxUses` | Number | Maximum uses (null = unlimited) |
| `usedCount` | Number | Current use count |
| `redeemedBy` | [ObjectId] | Users who redeemed code |
| `expiresAt` | Date | Expiration date (optional) |
| `isActive` | Boolean | Active status |
| `customMessage` | String | Custom invite message |
| `permissionType` | String | `owner`, `collaborator`, `contributor` |
| `inviteMetadata` | Object | sentAt, sentFrom, emailSent |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `code`, `createdBy`, `email`, `createdBy+createdAt`, `expiresAt`, `isActive+usedCount`

---

### ApiToken

API tokens for programmatic access.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `user` | ObjectId | Token owner |
| `tokenHash` | String | SHA-256 hash of token |
| `tokenPrefix` | String | First 8 chars for display |
| `name` | String | User-provided name |
| `lastUsed` | Date | Last usage timestamp |
| `expiresAt` | Date | Expiration date (optional) |
| `isActive` | Boolean | Active status |
| `createdFrom` | String | IP address at creation |
| `createdUserAgent` | String | User agent at creation |
| `createdAt` | Date | Document creation timestamp |
| `updatedAt` | Date | Last update timestamp |

**Indexes:** `user`, `tokenHash`, `user+isActive`, `expiresAt`, `createdAt`

---

## Relationship Summary

| From | To | Relationship | Description |
|------|-----|--------------|-------------|
| User | Photo | 1:N | User has profile photos |
| User | Plan | 1:N | User owns plans |
| User | ApiToken | 1:N | User owns API tokens |
| User | InviteCode | 1:N | User creates invite codes |
| User | Follow | N:M | Users follow each other |
| User | Activity | 1:N | User is actor in activities |
| Destination | Experience | 1:N | Destination contains experiences |
| Destination | Photo | N:M | Destinations have photos |
| Experience | Plan | 1:N | Experience is template for plans |
| Experience | Photo | N:M | Experiences have photos |
| Plan | Document | 1:N | Plans have attached documents |
| Photo | Permission | 1:N | Photos have access control |
| Document | Permission | 1:N | Documents have access control |

## Permission Inheritance

```
Destination
    └── permissions[] ──────────────────────────────────────┐
                                                            │
Experience                                                  │
    ├── permissions[] (own) ────────────────────────────────┤
    └── inherits from destination permissions ──────────────┤
                                                            │
Plan                                                        │
    ├── permissions[] (own) ────────────────────────────────┤
    └── inherits from experience permissions ───────────────┘

Photo / Document
    └── permissions[] (own, inherited from parent entity)
```

Permission types: `owner` > `collaborator` > `contributor`
