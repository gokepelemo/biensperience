with open('controllers/api/plans.js', 'r') as f:
    content = f.read()

original = content

# 1. Remove default_photo_id from quick populated plan objects
content = content.replace(
    """      default_photo_id: experience.default_photo_id
    },
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photos: req.user.photos,
      default_photo_id: req.user.default_photo_id""",
    """    },
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photos: req.user.photos"""
)

# 2. Fix the experience object literal in quickPopulatedPlan
content = content.replace(
    """      photos: experience.photos,
      default_photo_id: experience.default_photo_id
    },""",
    """      photos: experience.photos
    },"""
)

# 3. Remove default_photo_id from select strings (various patterns)
content = content.replace(
    "select: 'name email photos default_photo_id oauthProfilePhoto photo',",
    "select: 'name email photos oauthProfilePhoto photo',"
)
content = content.replace(
    "select: 'name email photos default_photo_id oauthProfilePhoto photo'",
    "select: 'name email photos oauthProfilePhoto photo'"
)
content = content.replace(
    "select: 'name destination photos default_photo_id',",
    "select: 'name destination photos',"
)
content = content.replace(
    "select: 'name destination plan_items photos default_photo_id',",
    "select: 'name destination plan_items photos',"
)
content = content.replace(
    "select: 'name email photos default_photo_id oauthProfilePhoto',",
    "select: 'name email photos oauthProfilePhoto',"
)
content = content.replace(
    "select: 'name email photos default_photo_id oauthProfilePhoto'",
    "select: 'name email photos oauthProfilePhoto'"
)

# 4. Update .select() calls that include default_photo_id
content = content.replace(
    ".select('name email photos default_photo_id oauthProfilePhoto photo')",
    ".select('name email photos oauthProfilePhoto photo')"
)
content = content.replace(
    ".select('_id name email photo photos default_photo_id oauthProfilePhoto')",
    ".select('_id name email photo photos oauthProfilePhoto')"
)

# 5. Change populate path 'photos' in nested populates
content = content.replace(
    """        path: 'photos',
        select: 'url caption'""",
    """        path: 'photos.photo',
        select: 'url caption'"""
)
# For the path key-value with single indent (inside populate:)
content = content.replace(
    "populate: { path: 'photos', select: 'url caption' }",
    "populate: { path: 'photos.photo', select: 'url caption' }"
)

# 6. Change .populate('photos', 'url caption') to .populate('photos.photo', 'url caption')
content = content.replace(
    ".populate('photos', 'url caption')",
    ".populate('photos.photo', 'url caption')"
)

# 7. Remove .populate('default_photo_id', 'url caption') (legacy, should be removed)
content = content.replace(
    "\n    .populate('default_photo_id', 'url caption')",
    ""
)

# 8. Remove default_photo_id from userMap building and allUsers mapping
content = content.replace(
    """      photos: u.photos,
      default_photo_id: u.default_photo_id
    };""",
    """      photos: u.photos
    };"""
)

# 9. Fix .populate('experience', '...default_photo_id...') in chains
content = content.replace(
    ".populate('experience', 'name photos default_photo_id')",
    ".populate('experience', 'name photos')"
)
content = content.replace(
    ".populate('experience', 'name destination photos default_photo_id')",
    ".populate('experience', 'name destination photos')"
)
content = content.replace(
    ".populate('experience', 'name destination plan_items photos default_photo_id')",
    ".populate('experience', 'name destination plan_items photos')"
)
content = content.replace(
    ".populate('experience', 'name plan_items photos default_photo_id')",
    ".populate('experience', 'name plan_items photos')"
)
content = content.replace(
    ".populate('experience', 'name photos')",
    ".populate('experience', 'name photos')"
)

# 10. Fix costs.collaborator populate
content = content.replace(
    ".populate('costs.collaborator', 'name email photos default_photo_id')",
    ".populate('costs.collaborator', 'name email photos')"
)

# Report
print(f"photos.photo references: {content.count('photos.photo')}")
print(f"default_photo_id remaining: {content.count('default_photo_id')}")
print(f"Content changed: {content != original}")

with open('controllers/api/plans.js', 'w') as f:
    f.write(content)

print("Done!")
