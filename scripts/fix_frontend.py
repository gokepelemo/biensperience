"""
Fix all frontend files for photos consolidation.
Changes default_photo_id references and fixes photos array access.
"""
import re

def fix_file(path, changes):
    """Apply a list of (old, new) replacements to a file."""
    with open(path, 'r') as f:
        content = f.read()
    original = content
    for old, new in changes:
        content = content.replace(old, new)
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"  CHANGED: {path}")
        remaining = content.count('default_photo_id')
        if remaining:
            print(f"    WARNING: {remaining} default_photo_id occurrences remain")
    else:
        print(f"  NO CHANGE: {path}")


# ---------------------------------------------------------------
# 1. src/utilities/photo-utils.js  - add getPhotoObjects helper
# ---------------------------------------------------------------
fix_file('src/utilities/photo-utils.js', [(
    "export function getPhotoEntries(resource) {",
    """export function getPhotoObjects(resource) {
  return (resource?.photos || []).map(entry => entry?.photo).filter(Boolean);
}

export function getPhotoEntries(resource) {"""
)])


# ---------------------------------------------------------------
# 2. src/utilities/avatar-cache.js
# ---------------------------------------------------------------
fix_file('src/utilities/avatar-cache.js', [(
    """  // 1. photos + default_photo_id
  if (user.photos?.length > 0 && user.default_photo_id) {
    const defaultId = user.default_photo_id?._id || user.default_photo_id;
    const match = user.photos.find(p => {
      const photoId = p?._id || p;
      return photoId?.toString() === defaultId?.toString();
    });
    if (match && typeof match === 'object' && match.url) return match.url;
  }

  // 2. First populated photo
  if (user.photos?.length > 0) {
    const first = user.photos[0];
    if (first && typeof first === 'object' && first.url) return first.url;
  }

  // If photos exist but none could be resolved (unpopulated ObjectIds),
  // return null to force a lazy fetch from the backend which will
  // .populate() them properly. Never fall through to OAuth/legacy —
  // uploaded photos must always take precedence.
  if (user.photos?.length > 0) return null;""",
    """  // 1. photos[].photo — find default or fall back to first
  if (user.photos?.length > 0) {
    // New schema: photos = [{photo: PhotoObj, default: bool}]
    const defaultEntry = user.photos.find(p => p?.default);
    const firstEntry = user.photos[0];
    const photoObj = defaultEntry?.photo || firstEntry?.photo;
    if (photoObj && typeof photoObj === 'object' && photoObj.url) return photoObj.url;
    // Legacy flat schema: photos = [PhotoObj, ...]
    const flatPhoto = defaultEntry || firstEntry;
    if (flatPhoto && typeof flatPhoto === 'object' && flatPhoto.url) return flatPhoto.url;
    // Unpopulated — return null to trigger lazy fetch
    return null;
  }"""
)])


# ---------------------------------------------------------------
# 3. src/components/ExperienceCard/ExperienceCard.jsx
# ---------------------------------------------------------------
fix_file('src/components/ExperienceCard/ExperienceCard.jsx', [
    (
        """    const photos = Array.isArray(experience.photos) ? experience.photos.filter(Boolean) : [];

    if (photos.length > 0) {
      let defaultPhoto;
      if (experience.default_photo_id) {
        const defaultPhotoId = experience.default_photo_id?._id || experience.default_photo_id;
        defaultPhoto = photos.find(photo => photo?._id === defaultPhotoId);
      }
      if (!defaultPhoto) defaultPhoto = photos[0];
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }""",
        """    const photos = Array.isArray(experience.photos) ? experience.photos.filter(Boolean) : [];

    if (photos.length > 0) {
      // New schema: photos = [{photo: PhotoObj, default: bool}]
      const defaultEntry = photos.find(e => e?.default && e?.photo?.url);
      const defaultPhoto = defaultEntry?.photo || photos[0]?.photo || photos[0];
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }"""
    )
])


# ---------------------------------------------------------------
# 4. src/components/DestinationCard/DestinationCard.jsx
# ---------------------------------------------------------------
fix_file('src/components/DestinationCard/DestinationCard.jsx', [(
    """    if (destination.photos && destination.photos.length > 0) {
      let defaultPhoto;
      if (destination.default_photo_id) {
        defaultPhoto = destination.photos.find(photo => photo._id === destination.default_photo_id);
      }
      // Fallback to first photo if default not found or not set
      if (!defaultPhoto) {
        defaultPhoto = destination.photos[0];
      }
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }""",
    """    if (destination.photos && destination.photos.length > 0) {
      // New schema: photos = [{photo: PhotoObj, default: bool}]
      const defaultEntry = destination.photos.find(e => e?.default && e?.photo?.url);
      const defaultPhoto = defaultEntry?.photo || destination.photos[0]?.photo || destination.photos[0];
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }"""
)])


# ---------------------------------------------------------------
# 5. src/components/DestinationCard/DestinationCard.jsx - selectFields
# ---------------------------------------------------------------
fix_file('src/components/DestinationCard/DestinationCard.jsx', [(
    "selectFields: (d) => ({ name: d?.name, photo: d?.default_photo_id }),",
    "selectFields: (d) => ({ name: d?.name, photo: d?.photos?.find(e => e?.default)?.photo }),",
)])


# ---------------------------------------------------------------
# 6. src/views/SingleExperience/components/ExperienceHeader.jsx
# ---------------------------------------------------------------
fix_file('src/views/SingleExperience/components/ExperienceHeader.jsx', [(
    """            <PhotoCard
              photos={experience.photos}
              defaultPhotoId={experience.default_photo_id}""",
    """            <PhotoCard
              photos={(experience.photos || []).map(e => e?.photo).filter(Boolean)}
              defaultPhotoId={(experience.photos || []).find(e => e?.default)?.photo?._id}"""
)])


# ---------------------------------------------------------------
# 7. src/hooks/useGeocodedMarkers.js
# ---------------------------------------------------------------
fix_file('src/hooks/useGeocodedMarkers.js', [
    (
        "photo: dest.default_photo_id?.url || dest.photos?.[0]?.url,",
        "photo: (dest.photos?.find(e => e?.default)?.photo?.url) || dest.photos?.[0]?.photo?.url,"
    ),
    (
        "photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,",
        "photo: (exp.photos?.find(e => e?.default)?.photo?.url) || exp.photos?.[0]?.photo?.url,"
    )
])


# ---------------------------------------------------------------
# 8. src/components/UserAvatar/UserAvatar.jsx - remove debug log
# ---------------------------------------------------------------
fix_file('src/components/UserAvatar/UserAvatar.jsx', [(
    "  debug.log('UserAvatar - user.default_photo_id:', user.default_photo_id);\n",
    ""
)])


# ---------------------------------------------------------------
# 9. src/hooks/usePlanItemNotes.js
# ---------------------------------------------------------------
fix_file('src/hooks/usePlanItemNotes.js', [(
    "        default_photo_id: currentUser.default_photo_id,\n",
    ""
)])


# ---------------------------------------------------------------
# 10. src/components/PhotoUploadModal/PhotoUploadModal.jsx
# ---------------------------------------------------------------
fix_file('src/components/PhotoUploadModal/PhotoUploadModal.jsx', [(
    "      default_photo_id: (entity && entity.default_photo_id) || null\n",
    ""
)])


# ---------------------------------------------------------------
# 11. src/components/PhotoUpload/PhotoUpload.jsx
#     Change setData output to emit [{photo: id, default: bool}]
#     Change initialization to read new shape
# ---------------------------------------------------------------
fix_file('src/components/PhotoUpload/PhotoUpload.jsx', [
    # Fix defaultPhotoIndex init - read from new photos[].default
    (
        """  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(() => {
    const source = Array.isArray(data.photos_full) && data.photos_full.length > 0 
      ? data.photos_full.filter(Boolean) 
      : (data.photos || []).filter(Boolean);
    if (data.default_photo_id && source) {
      const index = source.findIndex(photo =>
        (photo && photo._id && String(photo._id) === String(data.default_photo_id)) || String(photo) === String(data.default_photo_id)
      );
      return index >= 0 ? index : 0;
    }
    return 0;
  });""",
        """  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(() => {
    const source = Array.isArray(data.photos_full) && data.photos_full.length > 0 
      ? data.photos_full.filter(Boolean) 
      : (data.photos || []).filter(Boolean);
    // New schema: photos = [{photo: PhotoObj, default: bool}]
    // Find index of the default entry in photos_full by matching IDs
    if (data.photos && Array.isArray(data.photos) && data.photos[0]?.photo) {
      const defaultEntry = data.photos.find(e => e?.default);
      if (defaultEntry && source.length > 0) {
        const defaultPhotoId = defaultEntry.photo?._id || defaultEntry.photo;
        const index = source.findIndex(p => String(p?._id || p) === String(defaultPhotoId));
        return index >= 0 ? index : 0;
      }
    }
    return 0;
  });"""
    ),
    # Fix sync effect for new shape
    (
        """      // Also sync default photo index
      if (data.default_photo_id) {
        const index = externalPhotos.findIndex(photo =>
          (photo && photo._id && String(photo._id) === String(data.default_photo_id)) ||
          String(photo) === String(data.default_photo_id)
        );
        if (index >= 0) setDefaultPhotoIndex(index);
      }""",
        """      // Also sync default photo index from new photos[].default schema
      if (data.photos && Array.isArray(data.photos) && data.photos[0]?.photo !== undefined) {
        const defaultEntry = data.photos.find(e => e?.default);
        if (defaultEntry) {
          const defaultPhotoId = defaultEntry.photo?._id || defaultEntry.photo;
          const index = externalPhotos.findIndex(p => String(p?._id || p) === String(defaultPhotoId));
          if (index >= 0) setDefaultPhotoIndex(index);
        }
      }"""
    ),
    # Fix useEffect dependency array (remove data.default_photo_id)
    (
        "  }, [data.photos_full, data.photos, data.default_photo_id]);",
        "  }, [data.photos_full, data.photos]);"
    ),
    # Fix setData output - emit photos as [{photo, default}] instead of [ids] + default_photo_id
    (
        """      setData((prevData) => ({
        ...prevData,
        photos: photoIds,
        photos_full: activePhotos,
        default_photo_id: activePhotos.length > 0 ? (activePhotos[newDefaultIndex]?._id || activePhotos[newDefaultIndex]) : null
      }));""",
        """      setData((prevData) => ({
        ...prevData,
        photos: activePhotos.map((photo, idx) => ({
          photo: photo?._id || photo,
          default: idx === newDefaultIndex
        })),
        photos_full: activePhotos
      }));"""
    )
])


# ---------------------------------------------------------------
# 12. src/views/Profile/Profile.jsx
#     Remove default_photo_id from API calls
# ---------------------------------------------------------------
fix_file('src/views/Profile/Profile.jsx', [
    (
        "              mergeProfile({ photos: photosFull, default_photo_id: data.default_photo_id || null });",
        "              mergeProfile({ photos: data.photos || [] });"
    ),
    (
        "const resp = await updateUserApi(user._id, { photos: data.photos || [], default_photo_id: data.default_photo_id || null });",
        "const resp = await updateUserApi(user._id, { photos: data.photos || [] });"
    ),
    (
        "const updated = await updateUserApi(user._id, { photos: data.photos || [], default_photo_id: data.default_photo_id || null });",
        "const updated = await updateUserApi(user._id, { photos: data.photos || [] });"
    )
])


# ---------------------------------------------------------------
# 13. src/views/SingleExperience/SingleExperience.jsx
#     Remove default_photo_id from state merge after photo save
# ---------------------------------------------------------------
fix_file('src/views/SingleExperience/SingleExperience.jsx', [
    (
        "              default_photo_id: data.default_photo_id\n",
        ""
    ),
    (
        "                default_photo_id: data.default_photo_id || updated.default_photo_id\n",
        ""
    )
])


# ---------------------------------------------------------------
# 14. src/views/SingleDestination/SingleDestination.jsx
#     Remove default_photo_id from state merge
# ---------------------------------------------------------------
fix_file('src/views/SingleDestination/SingleDestination.jsx', [
    (
        "              default_photo_id: data.default_photo_id\n",
        ""
    ),
    (
        "                default_photo_id: data.default_photo_id || updated.default_photo_id\n",
        ""
    )
])


# ---------------------------------------------------------------
# 15. src/components/SearchBar/SearchBar.jsx
# ---------------------------------------------------------------
fix_file('src/components/SearchBar/SearchBar.jsx', [(
    "              default_photo_id: result.default_photo_id,\n",
    ""
)])


# ---------------------------------------------------------------
# 16. src/components/DestinationWizardModal/DestinationWizardModal.jsx
# ---------------------------------------------------------------
fix_file('src/components/DestinationWizardModal/DestinationWizardModal.jsx', [(
    "      if (newData.default_photo_id) updatePayload.default_photo_id = newData.default_photo_id;\n",
    ""
)])


# ---------------------------------------------------------------
# 17. src/components/ExperienceWizardModal/ExperienceWizardModal.jsx
# ---------------------------------------------------------------
fix_file('src/components/ExperienceWizardModal/ExperienceWizardModal.jsx', [(
    "      if (newData.default_photo_id) updatePayload.default_photo_id = newData.default_photo_id;\n",
    ""
)])


# ---------------------------------------------------------------
# 18. src/components/PlanItemDetailsModal/PhotosTab.jsx
# ---------------------------------------------------------------
fix_file('src/components/PlanItemDetailsModal/PhotosTab.jsx', [(
    "    default_photo_id: photos[0]?._id || null\n",
    ""
)])


# ---------------------------------------------------------------
# 19. src/components/UpdateExperience/UpdateExperience.jsx
# ---------------------------------------------------------------
fix_file('src/components/UpdateExperience/UpdateExperience.jsx', [
    (
        "      const originalDefaultId = originalExperience.default_photo_id;\n",
        ""
    ),
    (
        "      const currentDefaultId = experience.default_photo_id;\n",
        ""
    ),
    (
        "      // Check if original default_photo_id is actually in the photos array (valid reference)\n",
        ""
    ),
    (
        "        default_photo_id: experience.default_photo_id,\n",
        ""
    )
])


# ---------------------------------------------------------------
# 20. src/components/UpdateDestination/UpdateDestination.jsx
# ---------------------------------------------------------------
fix_file('src/components/UpdateDestination/UpdateDestination.jsx', [
    (
        "      ? String(getId(originalDestination.default_photo_id))\n",
        ""
    ),
    (
        "      ? String(getId(destination.default_photo_id))\n",
        ""
    ),
    (
        "      const originalDefaultId = originalDestination.default_photo_id;\n",
        ""
    ),
    (
        "      const currentDefaultId = destination.default_photo_id;\n",
        ""
    ),
    (
        "        default_photo_id: destination.default_photo_id,\n",
        ""
    )
])


# ---------------------------------------------------------------
# 21. src/views/Profile/UpdateProfile.jsx
# ---------------------------------------------------------------
fix_file('src/views/Profile/UpdateProfile.jsx', [
    (
        "    const originalDefaultId = originalUser.default_photo_id;\n",
        ""
    ),
    (
        "    const currentDefaultId = formData.default_photo_id;\n",
        ""
    ),
    (
        "    // Check if original default_photo_id is actually in the photos array (valid reference)\n",
        ""
    ),
    (
        "          const actualFieldName = field === 'default_photo' ? 'default_photo_id' : field;\n",
        "          const actualFieldName = field;\n"
    )
])


# ---------------------------------------------------------------
# 22. src/components/CuratorPlanners/CuratorPlanners.jsx
# ---------------------------------------------------------------
fix_file('src/components/CuratorPlanners/CuratorPlanners.jsx', [(
    "                    default_photo_id: planner.userPhotoId,\n",
    ""
)])


# ---------------------------------------------------------------
# 23. Stories
# ---------------------------------------------------------------
fix_file('src/stories/DestinationCard.stories.jsx', [(
    "  default_photo_id: null,\n",
    ""
)])

fix_file('src/stories/ExperienceCard.stories.jsx', [(
    "  default_photo_id: null,\n",
    ""
)])

fix_file('src/stories/Layouts/ProfileLayouts.stories.jsx', [
    ("  default_photo_id: 'photo1',\n", ""),
    (
        "              defaultPhotoId={sampleUser.default_photo_id}\n",
        ""
    )
])

fix_file('src/stories/Views/DestinationDetailView.stories.jsx', [(
    "  default_photo_id: 'photo-1',\n",
    ""
)])


print("\nDone! Checking remaining occurrences:")
import subprocess
result = subprocess.run(
    ['grep', '-rn', 'default_photo_id', 'src/', '--include=*.js', '--include=*.jsx', '--include=*.ts', '--include=*.tsx'],
    capture_output=True, text=True
)
if result.stdout:
    print(result.stdout)
else:
    print("No default_photo_id remaining in src/")
