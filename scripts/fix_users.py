with open('controllers/api/users.js', 'r') as f:
    content = f.read()

original = content

# 1. Add setDefaultPhotoByIndex and ensureDefaultPhotoConsistency to existing photo-utils import
content = content.replace(
    "const { getDefaultPhoto } = require('../../utilities/photo-utils');",
    "const { getDefaultPhoto, ensureDefaultPhotoConsistency, setDefaultPhotoByIndex } = require('../../utilities/photo-utils');"
)

# 2. Remove default_photo_id from allowedFields (user updateUser)
content = content.replace(
    "const allowedFields = ['name', 'email', 'photos', 'default_photo_id', 'password', 'oldPassword', 'preferences', 'location', 'bio', 'links'];",
    "const allowedFields = ['name', 'email', 'photos', 'password', 'oldPassword', 'preferences', 'location', 'bio', 'links'];"
)
# (updateUserAsAdmin)
content = content.replace(
    "const allowedFields = ['name', 'email', 'photos', 'default_photo_id', 'password', 'emailConfirmed', 'feature_flags', 'bio', 'links', 'preferences'];",
    "const allowedFields = ['name', 'email', 'photos', 'password', 'emailConfirmed', 'feature_flags', 'bio', 'links', 'preferences'];"
)

# 3. Remove default_photo_id validation blocks (updateUser)
old_validation_user = """    // Validate default_photo_id if provided
    if (updateData.default_photo_id !== undefined) {
      if (updateData.default_photo_id === null || mongoose.Types.ObjectId.isValid(updateData.default_photo_id)) {
        validatedUpdateData.default_photo_id = updateData.default_photo_id;
      }
    }

    // Validate preferences object if provided"""
new_validation_user = """    // Validate preferences object if provided"""
content = content.replace(old_validation_user, new_validation_user)

# 4. Remove default_photo_id validation blocks (updateUserAsAdmin) - same text
old_validation_admin = """    // Validate default_photo_id if provided
    if (updateData.default_photo_id !== undefined) {
      if (updateData.default_photo_id === null || mongoose.Types.ObjectId.isValid(updateData.default_photo_id)) {
        validatedUpdateData.default_photo_id = updateData.default_photo_id;
      }
    }

    // Add password to validated data if provided"""
new_validation_admin = """    // Add password to validated data if provided"""
content = content.replace(old_validation_admin, new_validation_admin)

# 5. Change .populate("photos", ...) to .populate("photos.photo", ...)
content = content.replace(
    '.populate("photos", "url caption photo_credit photo_credit_url width height")',
    '.populate("photos.photo", "url caption photo_credit photo_credit_url width height")'
)
content = content.replace(
    '.populate("photos", "url caption")',
    '.populate("photos.photo", "url caption")'
)

# 6. Remove default_photo_id from select strings
content = content.replace(
    ".select('name email photos default_photo_id oauthProfilePhoto photo createdAt feature_flags bio location')",
    ".select('name email photos oauthProfilePhoto photo createdAt feature_flags bio location')"
)
content = content.replace(
    ".select('photos default_photo_id oauthProfilePhoto')",
    ".select('photos oauthProfilePhoto')"
)

# 7. Remove default_photo_id from user broadcasts (updateUser broadcast)
content = content.replace(
    """            photos: user.photos,
            default_photo_id: user.default_photo_id,
            oauthProfilePhoto: user.oauthProfilePhoto,
            photo: user.photo,
            preferences: user.preferences,
            location: user.location,
            bio: user.bio,
            links: user.links,
            feature_flags: user.feature_flags""",
    """            photos: user.photos,
            oauthProfilePhoto: user.oauthProfilePhoto,
            photo: user.photo,
            preferences: user.preferences,
            location: user.location,
            bio: user.bio,
            links: user.links,
            feature_flags: user.feature_flags"""
)

# 8. Replace removePhoto consistency check
old_remove = """    // Clear default_photo_id if the removed photo was the default
    if (user.default_photo_id && removedPhoto && user.default_photo_id.toString() === removedPhoto._id.toString()) {
      user.default_photo_id = null;
    }"""
new_remove = """    // Ensure exactly one default photo is set
    ensureDefaultPhotoConsistency(user);"""
content = content.replace(old_remove, new_remove)

# 9. Replace setDefaultPhoto logic
content = content.replace(
    "    user.default_photo_id = user.photos[photoIndex]._id;",
    "    setDefaultPhotoByIndex(user, photoIndex);"
)

# 10. Change .populate('photos', 'url') to .populate('photos.photo', 'url')
content = content.replace(".populate('photos', 'url')", ".populate('photos.photo', 'url')")

# Report
print(f"photos.photo references: {content.count('photos.photo')}")
print(f"default_photo_id remaining: {content.count('default_photo_id')}")
print(f"photo-utils funcs added: {'ensureDefaultPhotoConsistency' in content}")
print(f"Content changed: {content != original}")

with open('controllers/api/users.js', 'w') as f:
    f.write(content)

print("Done!")
