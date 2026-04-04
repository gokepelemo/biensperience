import re
import sys

with open('controllers/api/experiences.js', 'r') as f:
    content = f.read()

original = content

# 1. Add photo-utils import after existing imports block
content = content.replace(
    "const { aggregateGroupSignals } = require('../../utilities/hidden-signals');",
    "const { aggregateGroupSignals } = require('../../utilities/hidden-signals');\nconst { ensureDefaultPhotoConsistency, setDefaultPhotoByIndex } = require('../../utilities/photo-utils');"
)

# 2. Remove default_photo_id from select strings (various patterns)
content = content.replace("photos default_photo_id permissions experience_type", "photos permissions experience_type")
content = content.replace('select: "name photos default_photo_id feature_flags bio"', 'select: "name photos feature_flags bio"')
content = content.replace("photos default_photo_id oauthProfilePhoto photo'", "photos oauthProfilePhoto photo'")  # single quotes
content = content.replace('photos default_photo_id oauthProfilePhoto photo"', 'photos oauthProfilePhoto photo"')  # double quotes
content = content.replace("select: '_id name email photos default_photo_id'", "select: '_id name email photos'")
content = content.replace('select: "name email photo photos default_photo_id"', 'select: "name email photo photos"')

# 3. Change populate path 'photos' to 'photos.photo' in populate blocks
# .populate({ path: 'photos', select: 'url caption width height' })
content = content.replace("{ path: 'photos', select: 'url caption width height' }", "{ path: 'photos.photo', select: 'url caption width height' }")
# .populate({ path: 'photos', select: 'url caption' })
content = content.replace("{ path: 'photos', select: 'url caption' }", "{ path: 'photos.photo', select: 'url caption' }")

# .populate("photos", "url caption photo_credit photo_credit_url width height")
content = content.replace('.populate("photos", "url caption photo_credit photo_credit_url width height")', '.populate("photos.photo", "url caption photo_credit photo_credit_url width height")')

# populate: { path: 'photos', select: 'url caption' } (single line)
content = content.replace("populate: { path: 'photos', select: 'url caption' }", "populate: { path: 'photos.photo', select: 'url caption' }")

# Nested path: "photos" with model: "Photo"
content = content.replace('            path: "photos",\n            model: "Photo"', '            path: "photos.photo",\n            model: "Photo"')

# path: "photos", select: 'url caption' (inside nested array)
content = content.replace("            path: \"photos\",\n            select: 'url caption'", "            path: \"photos.photo\",\n            select: 'url caption'")

# 4. Change .populate({ path: "photos", model: "Photo" }) (top-level standalone populate)
content = content.replace('      .populate({\n        path: "photos",\n        model: "Photo"\n      });', '      .populate({\n        path: "photos.photo",\n        model: "Photo"\n      });')

# 5. Change populate path: 'photos' with select: 'url caption' in nested arrays (showUserExperiences)
content = content.replace("          path: 'photos',\n          select: 'url caption'", "          path: 'photos.photo',\n          select: 'url caption'")

# 6. Change populate path: 'photos' with select: 'url caption' in showExperiencesByUser (different indentation)
content = content.replace("        path: 'photos',\n        select: 'url caption'", "        path: 'photos.photo',\n        select: 'url caption'")

# 7. Change path: "photos" with model, select inside permission populate nested array
content = content.replace(
    '          path: "photos",\n          model: "Photo",\n          select: \'url caption\'',
    '          path: "photos.photo",\n          model: "Photo",\n          select: \'url caption\''
)

# 8. Change $lookup localField: 'photos' -> 'photos.photo'
content = content.replace(
    "{ $lookup: { from: 'photos', localField: 'photos', foreignField: '_id', as: 'photos' } }",
    "{ $lookup: { from: 'photos', localField: 'photos.photo', foreignField: '_id', as: 'photos' } }"
)

# 9. Remove default_photo_id: 1 from $project stages
content = content.replace("              default_photo_id: 1, \n", "")

# 10. Remove default_photo_id: plan.user.default_photo_id from usersWithPlans
content = content.replace("          default_photo_id: plan.user.default_photo_id,\n", "")

# 11. Remove 'default_photo_id' from allowedFields
content = content.replace("'plan_items', 'photos', 'default_photo_id', 'visibility', 'permissions'", "'plan_items', 'photos', 'visibility', 'permissions'")

# 12. Replace consistency check block
old_consistency = """    // Adjust default_photo_id if necessary
    if (experience.default_photo_id && !experience.photos.includes(experience.default_photo_id)) {
      experience.default_photo_id = experience.photos.length > 0 ? experience.photos[0] : null;
    }"""
new_consistency = """    // Ensure exactly one default photo is set
    ensureDefaultPhotoConsistency(experience);"""
content = content.replace(old_consistency, new_consistency)

# 13. Replace setDefault logic
content = content.replace(
    "    experience.default_photo_id = experience.photos[photoIndex];",
    "    setDefaultPhotoByIndex(experience, photoIndex);"
)

# 14. Fix updatedFields for setDefault
content = content.replace(
    "          updatedFields: ['default_photo_id'],",
    "          updatedFields: ['photos'],"
)

# 15. Fix addPhoto function
old_add_photo = """    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return errorResponse(res, null, 'Photo URL is required', 400);
    }

    // Add photo to photos array
    experience.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url"""
new_add_photo = """    const { photoId } = req.body;

    if (!photoId) {
      return errorResponse(res, null, 'Photo ID is required', 400);
    }

    // Add photo to photos array
    experience.photos.push({
      photo: photoId,
      default: experience.photos.length === 0"""
content = content.replace(old_add_photo, new_add_photo)

# Report changes
print(f"photos.photo references: {content.count('photos.photo')}")
print(f"default_photo_id remaining: {content.count('default_photo_id')}")
print(f"photo-utils import added: {'ensureDefaultPhotoConsistency' in content}")
print(f"setDefaultPhotoByIndex call: {'setDefaultPhotoByIndex(experience, photoIndex)' in content}")
check_add = 'const { photoId }' in content
print(f"photoId in addPhoto: {check_add}")
print(f"Content changed: {content != original}")

with open('controllers/api/experiences.js', 'w') as f:
    f.write(content)

print("Done!")
