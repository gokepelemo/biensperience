# Avatar Photo URL Fix

**Date**: October 13, 2025  
**Issue**: Avatar images showing ObjectId in src attribute instead of actual photo URLs  
**Status**: ✅ Resolved

## Problem Description

Avatar components (both in UsersListDisplay for collaborators/plans and UserAvatar) were rendering with ObjectId values in the `src` attribute:

```html
<img src="65403e0f6e435eb1b1a7bf00" alt="Goke Pelemo">
```

This caused broken images to display as the browser tried to fetch invalid URLs.

## Root Cause Analysis

### Data Model Structure
The User model has a complex photo structure:
- **Legacy `photo` field**: References a Photo document (ObjectId)
- **New `photos` array**: Array of photo objects with embedded data
- **`default_photo_index`**: Points to which photo in the array to display

### API Population Issues
Multiple API endpoints were not properly populating nested photo references:

1. **Experiences API** (`controllers/api/experiences.js`):
   - Was populating `permissions._id` to get user data
   - Only selected `name photo` but didn't populate the nested `photo` reference
   - Result: Frontend received ObjectId instead of photo URL

2. **Plans API** (`controllers/api/plans.js`):
   - Multiple endpoints only selected `name email` for user population
   - Didn't include photo fields at all
   - Manual permission population didn't include photo data

### Frontend Component Assumptions
The `UserAvatar` component assumed `user.photo` was a direct URL string, but it could be:
- An ObjectId (unpopulated reference)
- A Photo object with `url` property (populated reference)
- Undefined (using new `photos` array instead)

## Solution Implementation

### 1. Backend API Updates

#### Experiences API (`controllers/api/experiences.js`)
Enhanced the `showExperience` function to deeply populate photo data:

```javascript
async function showExperience(req, res) {
  try {
    let experience = await Experience.findById(req.params.id)
      .populate("destination")
      .populate("user")
      .populate({
        path: "permissions._id",
        select: "name photo photos default_photo_index",
        populate: {
          path: "photo",
          select: "url caption"
        }
      });
    res.status(200).json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
    res.status(400).json({ error: 'Failed to fetch experience' });
  }
}
```

**Changes**:
- Added `photos` and `default_photo_index` to selection
- Added nested `populate` for the `photo` reference to get actual URL

#### Plans API (`controllers/api/plans.js`)
Updated **6 locations** where user data is populated:

**Location 1 - Create Plan** (line ~82):
```javascript
const populatedPlan = await Plan.findById(plan._id)
  .populate('experience', 'name destination')
  .populate({
    path: 'user',
    select: 'name email photo photos default_photo_index',
    populate: {
      path: 'photo',
      select: 'url caption'
    }
  });
```

**Location 2 - Get Plan by ID** (line ~118):
```javascript
const plan = await Plan.findById(id)
  .populate('experience', 'name destination plan_items')
  .populate({
    path: 'user',
    select: 'name email photo photos default_photo_index',
    populate: {
      path: 'photo',
      select: 'url caption'
    }
  })
  .populate({
    path: 'experience',
    populate: {
      path: 'destination',
      select: 'name country'
    }
  });
```

**Location 3 - Get Experience Plans** (line ~151):
```javascript
const plans = await Plan.find({
  experience: experienceId,
  $or: [
    { user: req.user._id },
    { 
      'permissions': {
        $elemMatch: {
          '_id': req.user._id,
          'type': { $in: ['collaborator', 'owner'] }
        }
      }
    }
  ]
})
.populate({
  path: 'user',
  select: 'name email photo photos default_photo_index',
  populate: {
    path: 'photo',
    select: 'url caption'
  }
})
.populate({
  path: 'experience',
  select: 'name destination',
  populate: {
    path: 'destination',
    select: 'name country'
  }
})
.sort({ updatedAt: -1 });
```

**Location 4 - Manual Permissions Population** (line ~182):
```javascript
// Manually populate collaborator user data in permissions array
const plansWithCollaborators = await Promise.all(plans.map(async (plan) => {
  const planObj = plan.toObject();
  if (planObj.permissions && planObj.permissions.length > 0) {
    const userPermissions = planObj.permissions.filter(p => p.entity === 'user');
    const userIds = userPermissions.map(p => p._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email photo photos default_photo_index')
      .populate('photo', 'url caption');
    
    // Create a map for quick lookup
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = { 
        name: u.name, 
        email: u.email, 
        _id: u._id,
        photo: u.photo,
        photos: u.photos,
        default_photo_index: u.default_photo_index
      };
    });
    
    // Enhance permissions with user data
    planObj.permissions = planObj.permissions.map(p => {
      if (p.entity === 'user' && userMap[p._id.toString()]) {
        return {
          ...p,
          user: userMap[p._id.toString()]
        };
      }
      return p;
    });
  }
  return planObj;
}));
```

**Locations 5 & 6 - Update Plan Functions** (lines ~352, ~471):
```javascript
const updatedPlan = await Plan.findById(plan._id)
  .populate('experience', 'name destination')
  .populate({
    path: 'user',
    select: 'name email photo photos default_photo_index',
    populate: {
      path: 'photo',
      select: 'url caption'
    }
  });
```

### 2. Frontend Component Updates

#### UserAvatar Component (`src/components/UserAvatar/UserAvatar.jsx`)
Added intelligent photo URL extraction function:

```javascript
// Helper function to get photo URL from various formats
const getPhotoUrl = (user) => {
  // If photo is a string, use it directly (URL)
  if (typeof user.photo === 'string') {
    return user.photo;
  }
  
  // If photo is an object with url property
  if (user.photo && typeof user.photo === 'object' && user.photo.url) {
    return user.photo.url;
  }
  
  // If using photos array with default_photo_index
  if (user.photos && user.photos.length > 0) {
    const photoIndex = user.default_photo_index || 0;
    const photo = user.photos[photoIndex];
    if (photo && photo.url) {
      return photo.url;
    }
  }
  
  return null;
};

const photoUrl = getPhotoUrl(user);

const avatarContent = (
  <>
    {photoUrl ? (
      <img src={photoUrl} alt={user.name} />
    ) : (
      <div className="avatar-initials">
        {user.name?.charAt(0).toUpperCase()}
      </div>
    )}
  </>
);
```

**Handles**:
- Direct URL strings (legacy data)
- Populated Photo objects with `url` property
- New `photos` array with `default_photo_index`
- Graceful fallback to initials if no photo available

## Testing & Verification

### Test Cases
1. ✅ User with legacy `photo` field (ObjectId reference, properly populated)
2. ✅ User with new `photos` array and `default_photo_index`
3. ✅ User with no photo (displays initials)
4. ✅ Collaborators in experience plan items
5. ✅ Plan owners in "My Plan" dropdown
6. ✅ Multiple collaborators with overlapping avatars

### Affected Views
- **SingleExperience.jsx**: 
  - Experience tab collaborators (via UsersListDisplay)
  - My Plan tab collaborators (via UsersListDisplay)
  - Plan dropdown owner names
- **Profile views**: User avatars throughout
- **Navigation**: User profile avatar in navbar

## Files Modified

### Backend
- `controllers/api/experiences.js` (1 location)
- `controllers/api/plans.js` (6 locations)

### Frontend
- `src/components/UserAvatar/UserAvatar.jsx`

## Deployment

**Build**: +56 bytes to JS bundle (140.2 kB total)  
**Server**: PM2 restart #210  
**Status**: Successfully deployed

## Related Documentation

- [Reusable User Components](./REUSABLE_USER_COMPONENTS.md)
- [Data Model](./DATA_MODEL.md)
- [S3 CORS Fix](./S3_CORS_FIX.md)

## Future Considerations

### User Model Migration
Consider adding a virtual getter for `photoUrl` to the User model:

```javascript
userSchema.virtual('photoUrl').get(function() {
  if (typeof this.photo === 'string') return this.photo;
  if (this.photo && this.photo.url) return this.photo.url;
  if (this.photos && this.photos.length > 0) {
    const index = this.default_photo_index || 0;
    return this.photos[index]?.url || null;
  }
  return null;
});
```

This would centralize the photo URL logic and make it available throughout the backend.

### API Consistency
Create a reusable population configuration object:

```javascript
const USER_PHOTO_POPULATE = {
  path: 'user',
  select: 'name email photo photos default_photo_index',
  populate: {
    path: 'photo',
    select: 'url caption'
  }
};

// Usage
.populate(USER_PHOTO_POPULATE)
```

This would ensure consistency across all API endpoints and make future updates easier.

## Lessons Learned

1. **Deep Populate**: When dealing with nested references, always populate all levels
2. **Flexible Components**: Frontend components should handle multiple data formats gracefully
3. **Data Model Evolution**: Support both legacy and new data structures during transitions
4. **Comprehensive Updates**: Check all API endpoints that return user data, not just the obvious ones
5. **Manual Population**: When manually populating (like in permissions arrays), include all necessary fields

## Success Metrics

✅ All avatar images now display correctly  
✅ No broken image icons  
✅ Proper S3 URLs in src attributes  
✅ Graceful fallback to initials when no photo available  
✅ Consistent behavior across all views and components  
✅ No performance degradation from additional populates
