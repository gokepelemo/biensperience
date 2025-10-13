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
export function filterExperiences(experiences, filterBy, userId, userPlans = []) {
  switch (filterBy) {
    case "planned":
      // Check if user has a plan for this experience
      return experiences.filter(exp =>
        userPlans.some(plan => plan.experience?._id === exp._id || plan.experience === exp._id)
      );

    case "unplanned":
      // Check if user does NOT have a plan for this experience
      return experiences.filter(exp =>
        !userPlans.some(plan => plan.experience?._id === exp._id || plan.experience === exp._id)
      );

    case "created":
      return experiences.filter(exp =>
        exp.user === userId || (exp.user && exp.user._id === userId)
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
