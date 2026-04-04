import re

with open('controllers/api/destinations.js', 'r') as f:
    content = f.read()

original = content

# 1. Add photo-utils import
content = content.replace(
    "const { successResponse, errorResponse, paginatedResponse } = require('../../utilities/controller-helpers');",
    "const { successResponse, errorResponse, paginatedResponse } = require('../../utilities/controller-helpers');\nconst { ensureDefaultPhotoConsistency, setDefaultPhotoByIndex } = require('../../utilities/photo-utils');"
)

# 2. Remove default_photo_id from allowedFields
content = content.replace(
    "const allowedFields = ['name', 'country', 'state', 'overview', 'photos', 'default_photo_id', 'travel_tips', 'tags', 'map_location', 'location'];",
    "const allowedFields = ['name', 'country', 'state', 'overview', 'photos', 'travel_tips', 'tags', 'map_location', 'location'];"
)

# 3. Change .populate("photos", ...) to .populate("photos.photo", ...)
content = content.replace(
    '.populate("photos", "url caption photo_credit photo_credit_url width height")',
    '.populate("photos.photo", "url caption photo_credit photo_credit_url width height")'
)

# 4. Change await destination.populate('photos') to 'photos.photo'
content = content.replace(
    "await destination.populate('photos');",
    "await destination.populate('photos.photo');"
)

# 5. Change showDestination's .populate("photos") - the simple one
content = content.replace(
    'const destination = await Destination.findById(req.params.id).populate(\n      "photos"\n    );',
    'const destination = await Destination.findById(req.params.id).populate(\n      "photos.photo"\n    );'
)

# 6. Replace consistency check for removePhoto
old_check = """    // Clear default_photo_id if the removed photo was the default
    if (destination.default_photo_id && removedPhoto && destination.default_photo_id.toString() === removedPhoto._id.toString()) {
      destination.default_photo_id = null;
    }"""
new_check = """    // Ensure exactly one default photo is set
    ensureDefaultPhotoConsistency(destination);"""
content = content.replace(old_check, new_check)

# 7. Replace setDefaultPhoto logic
content = content.replace(
    "    destination.default_photo_id = destination.photos[photoIndex]._id;",
    "    setDefaultPhotoByIndex(destination, photoIndex);"
)

# 8. Fix updatedFields for setDefault
content = content.replace(
    "          updatedFields: ['default_photo_id'],",
    "          updatedFields: ['photos'],"
)

# Report
print(f"photos.photo references: {content.count('photos.photo')}")
print(f"default_photo_id remaining: {content.count('default_photo_id')}")
print(f"photo-utils import added: {'ensureDefaultPhotoConsistency' in content}")
print(f"Content changed: {content != original}")

with open('controllers/api/destinations.js', 'w') as f:
    f.write(content)

print("Done!")
