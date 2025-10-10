// Sorting utilities
export function sortItems(items, sortBy) {
  const sorted = [...items];

  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));

    case "alphabetical-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));

    case "created-newest":
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    case "created-oldest":
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    case "updated-newest":
      return sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    case "updated-oldest":
      return sorted.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

    default:
      return sorted;
  }
}

// Filtering utilities
export function filterExperiences(experiences, filterBy, userId) {
  switch (filterBy) {
    case "planned":
      return experiences.filter(exp =>
        exp.users && exp.users.some(u => u.user === userId || u.user._id === userId)
      );

    case "unplanned":
      return experiences.filter(exp =>
        !exp.users || !exp.users.some(u => u.user === userId || u.user._id === userId)
      );

    case "all":
    default:
      return experiences;
  }
}

export function filterDestinations(destinations, filterBy, userId) {
  switch (filterBy) {
    case "planned":
      return destinations.filter(dest =>
        dest.users_favorite && dest.users_favorite.includes(userId)
      );

    case "unplanned":
      return destinations.filter(dest =>
        !dest.users_favorite || !dest.users_favorite.includes(userId)
      );

    case "all":
    default:
      return destinations;
  }
}
