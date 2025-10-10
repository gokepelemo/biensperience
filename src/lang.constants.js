// Language constants for UI strings organized by context
const en = {
  button: {
    add: "Add",
    addChild: "Add Child",
    addPlanItem: "+ Add Plan Item",
    cancel: "Cancel",
    create: "Create",
    delete: "Delete",
    confirmUpdate: "Confirm Update",
    editDate: "Edit Planned Date",
    editExperience: "Edit Experience",
    login: "Login",
    logout: "Logout",
    remove: "Remove",
    signIn: "Sign In",
    signInArrow: "Sign In ↪",
    signup: "Sign Up",
    skip: "Skip",
    update: "Update",
    updateChild: "Update Child",
    updateDate: "Update Date",
    updateExperience: "Update Experience",
    setDateAndAdd: "Set Date & Add",
    addDestinationCreateExperience: "Add Destination ➡️ Create New Experience",
    addFavoriteExp: "+ Plan this Experience",
    addFavoriteDest: "+ Add to Favorite Destinations",
    removeFavoriteExp: "- Remove from Planned Experiences",
    removeFavoriteDest: "- Remove from Favorites",
    addToPlan: "Add to Planned Experiences",
    removeFromPlan: "Remove from Planned Experiences",
    markComplete: "👍 Mark Complete",
    done: "✅ Done",
    undoComplete: "❎ Undo Complete",
    expPlanAdded: "✅ Planned",
    favorited: "❤️ Favorited",
    upload: "Upload",
    uploading: "Uploading...",
  },

  alert: {
    loginFailed: "Log In Failed - Try Again",
    signupFailed: "Sign Up Failed - Try Again",
    notEnoughTimeWarning:
      "Warning: You may not have enough time to plan this experience adequately.",
    noExperiencesOrDestinations:
      "There are no {type} on this profile yet. Add one now.",
    noExperiencesInDestination:
      "There are no experiences in this destination yet. ",
    noTravelTips: "No travel tips added yet.",
  },

  modal: {
    confirmDelete: "Confirm Deletion",
    confirmDeleteMessage:
      "Are you sure you want to delete the experience '{name}'? This action cannot be undone.",
    confirmDeletePlanItem:
      "Are you sure you want to delete this plan item? This action cannot be undone.",
    confirmDeleteTravelTip: "Are you sure you want to delete this travel tip?",
    confirmExperienceUpdate: "Confirm Experience Update",
    confirmUpdateReview: "Please review the changes before updating:",
  },

  heading: {
    signInToAccount: "Sign In To Your Account",
    createAccount: "Create Your Account",
    createdBy: "Created by",
    createExperience: "Create an Experience",
    editExperience: "Edit Experience",
    newDestination: "New Destination",
    createDestination: "Create a Destination",
    estimatedCost: "Estimated Cost:",
    planningTime: "Planning Time:",
    planYourExperience: "Plan Your Experience",
    editPlannedDate: "Edit Planned Date",
    travelTips: "Travel Tips",
    favoriteDestinations: "Favorite Destinations",
    preferredExperienceTypes: "Preferred Experience Types",
    plannedExperiences: "Planned Experiences",
    experienceDestinations: "Experience Destinations",
    popularExperiences: "Popular Experiences",
    experiencesIn: "Experiences in",
    updateProfile: "Update {name}",
  },

  label: {
    destinationLabel: "Destination: ",
    title: "Title",
    costEstimate: "Cost Estimate ($)",
    planningDays: "Planning Days",
    parentPlanItem: "Parent Plan Item",
    url: "URL",
    country: "Country:",
    whenDoYouWantExperience: "When do you want to have this experience?",
    experienceTypes: "Experience Types",
  },

  placeholder: {
    email: "Email Address",
    password: "Password",
    confirmPassword: "Confirm Password",
    name: "Name (ex. John Doe)",
    nameField: "Name",
    emailField: "Email",
    emailExample: "Email (ex. john@doe.com)",
    experienceName:
      "e.g. Brewery Tour at Lakefront Brewery with a Local in Milwaukee",
    address:
      "Address (optional). A specific address to the location if available.",
    experienceType: "e.g. Culinary, Winery, Brewery, High Adrenaline",
    planItem: "ex. Book a ticket on Skyscanner",
    costEstimate: "ex. 350",
    planningDays: "Planning Days (ex. 30)",
    url: "ex. https://www.tripadvisor.com/fun-adventure",
    city: "e.g. London",
    stateProvince: "e.g. United Kingdom",
    country: "e.g. England",
    language: "e.g. Language",
    spanish: "e.g. Spanish",
    photoCredit: "Photo Credit e.g. Unsplash",
    photoCreditUrl: "Photo Credit URL e.g. http://unsplash.com",
  },

  helper: {
    nameRequired: "Name (required). A descriptive title in natural language.",
    destinationRequired:
      "Destination (required). Select from one of the destination cities or ",
    createNewDestination: "create a new one",
    experienceTypesOptional:
      "Experience types (optional) in a comma separated list.",
    photoOptional: "Photo (optional)",
    cityRequired: "City (required)",
    stateProvinceRequired: "State/Province (required)",
    countryRequired: "Country (required)",
    noneTopLevel: "None (Top Level)",
    requiresDaysToPlan:
      "This experience requires {days} days to plan adequately.",
  },

  message: {
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    noPhotoMessage: "You don't have a profile photo. ",
    uploadPhotoNow: "Upload one now",
    noFavoriteDestinations:
      "There are no favorite destinations on this profile yet. Look through our destinations and ",
    addFavoriteDestinations: "add some favorite destinations",
    noExperiencesYet: "There are no experiences on this profile yet. ",
    addExperiences: "Add some experiences",
    addOneNow: "Add one now",
  },

  nav: {
    login: "Login",
    signup: "Sign Up",
    logout: "Logout",
    profile: "Profile",
    destinations: "Destinations",
    experiences: "Experiences",
    photos: "Photos",
  },

  table: {
    title: "Title",
    costEstimate: "Cost Estimate",
    planningDays: "Planning Days",
    actions: "",
  },

  image: {
    alt: {
      preview: "Preview",
      photo: "Photo",
    },
    photoCredit: "Photo Credit:",
  },

  viewMeta: {
    defaultTitle: "Biensperience",
    defaultDescription:
      "Plan and organize your travel experiences around the world",
    defaultKeywords: "travel, experiences, destinations, planning, adventure",
    defaultOgImage: "/logo.png",
  },

  console: {
    userAlreadyAdded: "User is already added.",
    userRemovedFromExperience: "User isn't added to this experience anymore.",
    fileUploadInfo: "file is ",
    expressAppRunning: "Express app running on ",
    databaseConnected: "Connected to ",
  },
};

// All available languages
const languages = { en };

// Get current language from environment or default to 'en'
const getCurrentLanguage = () => {
  return process.env.REACT_APP_LANG || "en";
};

// Get language object for current language
const getLang = () => {
  const currentLang = getCurrentLanguage();
  return languages[currentLang] || languages.en;
};

// Export both the full language object and the getter function
const lang = {
  get current() {
    return getLang();
  },
  // Keep backward compatibility
  en: languages.en,
};

module.exports = { lang, getCurrentLanguage, getLang };
