// Language constants for UI strings organized by context
const en = {
  button: {
    add: "Add",
    addChild: "Add Child",
    addPlanItem: "Add Plan Item",
    addCollaborator: "Manage Collaborators",
    addCollaborators: "Manage Collaborators",
    adding: "Adding...",
    cancel: "Cancel",
    create: "Create",
    delete: "Delete",
    confirmUpdate: "Confirm Update",
    editDate: "Update Planned Date",
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
    removeFavoriteExp: "- Remove",
    removeFavoriteDest: "- Remove",
    addToPlan: "+ Add to Planned Experiences",
    removeFromPlan: "- Remove",
    markComplete: "👍 Mark Complete",
    done: "✅ Done",
    undoComplete: "❎ Undo Complete",
    expPlanAdded: "✅ Planned",
    favorited: "❤️ Favorited",
    upload: "Upload",
    uploading: "Uploading...",
    createExperience: "Create Experience",
    createDestination: "Create Destination",
    backToExperiences: "← Back to Experiences",
    backToDestinations: "← Back to Destinations",
    viewProfile: "View Profile",
    editProfile: "Edit Profile",
    home: "Home",
    syncNow: "🔄 Sync Now",
    syncing: "Syncing...",
    edit: "Edit",
  },

  alert: {
    loginFailed:
      "Login unsuccessful. Please check your credentials and try again.",
    signupFailed:
      "Account creation unsuccessful. Please check your information and try again.",
    notEnoughTimeWarning:
      "Warning: You may not have enough time to plan this experience adequately.",
    noExperiencesOrDestinations:
      "No {type} found on this profile yet. Start by adding your first one!",
    noExperiencesInDestination:
      "No experiences in this destination yet. Be the first to add one!",
    noTravelTips: "No travel tips shared yet. Add the first one!",
    planOutOfSync: "Plan Out of Sync",
    planOutOfSyncMessage:
      "The experience plan has changed since you created this plan. Click \"Sync Now\" to update your plan with the latest items.",
    noChangesDetected: "No changes detected.",
    planAlreadyInSync: "Your plan is already in sync with the experience.",
    syncPreserveNote:
      "Your completion status and actual costs will be preserved for existing items.",
    selectChangesToApply: "Select the changes you want to apply to your plan:",
    planNotFound: "Plan not found.",
    noPlanItems: "No plan items yet.",
    changesSavedSuccessfully: "Changes Saved Successfully!",
    addedCollaborators: "Added {count} collaborator{plural}:",
    removedCollaborators: "Removed {count} collaborator{plural}:",
    noChangesMade: "No changes were made.",
    searchCollaboratorsHelp:
      "Search for users by name or email to add as collaborators. They will be able to view and edit this {context}.",
  },

  modal: {
    confirmDelete: "Delete Experience",
    confirmDeleteMessage:
      "Are you sure you want to delete '{name}'? This action cannot be undone.",
    confirmDeletePlanItemTitle: "Delete Plan Item",
    confirmDeletePlanItem:
      "Are you sure you want to delete this plan item? This cannot be undone.",
    confirmDeleteTravelTip: "Are you sure you want to delete this travel tip?",
    confirmExperienceUpdate: "Update Experience",
    confirmUpdateReview: "Please review the changes before updating:",
    addCollaboratorToExperience: "Manage Experience Collaborators",
    addCollaboratorToPlan: "Manage Plan Collaborators",
    collaboratorAddedSuccess: "Collaborator{plural} Added Successfully!",
    collaboratorAddedMessage: "{name} has been added as a collaborator to your {context} and can now view and edit it.",
    multipleCollaboratorsAddedMessage: "{count} collaborators have been added to your {context} and can now view and edit it.",
    syncPlanTitle: "Sync Plan with Experience",
    removeExperienceTitle: "Remove Experience from Your Plans",
  },

  heading: {
    signInToAccount: "Sign In To Your Account",
    createAccount: "Create Your Account",
    createdBy: "Created by",
    createExperience: "Create an Experience",
    updateExperience: "Update Experience",
    newDestination: "New Destination",
    createDestination: "Create a Destination",
    estimatedCost: "Estimated Cost:",
    planningTime: "Planning Time:",
    planYourExperience: "Plan Your Experience",
    editPlannedDate: "Update Planned Date",
    travelTips: "Travel Tips",
    favoriteDestinations: "Favorite Destinations",
    preferredExperienceTypes: "Preferred Experience Types",
    plannedExperiences: "Planned",
    experienceDestinations: "✈️ Destinations",
    createdExperiences: "Created",
    popularExperiences: "Popular Experiences",
    experiencesIn: "Experiences in",
    updateProfile: "Update {name}",
    thePlan: "The Plan",
    myPlan: "My Plan",
    collaborators: "Collaborators",
  },

  label: {
    destinationLabel: "Destination",
    address: "Address",
    title: "Title",
    costEstimate: "Cost Estimate ($)",
    planningDays: "Planning Days",
    parentPlanItem: "Parent Plan Item",
    url: "URL",
    country: "Country",
    whenDoYouWantExperience: "When do you want to have this experience?",
    experienceTypes: "Experience Types",
    plannedDate: "Planned Date",
    totalCost: "Total Cost",
    completion: "Completion",
    planningTime: "Planning Time",
    notSet: "Not set",
    setOneNow: "Set One Now",
    day: "day",
    days: "days",
    collaborators: "Collaborators:",
    itemDescription: "Item Description",
    urlOptional: "URL (optional)",
    cost: "Cost",
    planningTimeLabel: "Planning Time",
    selectAll: "Select All",
    addedItems: "✚ Added Items ({count})",
    removedItems: "✖ Removed Items ({count})",
    modifiedItems: "✎ Modified Items ({count})",
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
    itemDescription: "Enter item description",
    urlPlaceholder: "https://example.com",
  },

  helper: {
    nameRequired:
      "Give your experience an exciting name that captures what makes it special! ✨",
    destinationRequired: "Pick where this adventure takes place, or ",
    createNewDestination: "Add a new destination to our map 🗺️",
    experienceTypesOptional:
      "Tag your experience to help others discover it (food, adventure, culture, etc.)",
    addressOptional:
      "Add a specific address if you have one - totally optional! 📍",
    photoOptional: "Show off this experience with some awesome photos! 📸",
    photosOptional:
      "Bring your experience to life with photos (optional but recommended!)",
    cityRequired: "Which city is calling your name?",
    stateProvinceRequired: "The state or province where adventure awaits",
    countryRequired: "Which country will host this experience?",
    noneTopLevel: "None (Top Level)",
    requiresDaysToPlan:
      "Heads up! This experience needs at least {days} days of planning time.",
    planningDaysOptional:
      "How many days should travelers plan ahead? (Optional)",
    costEstimateOptional:
      "Give future travelers a ballpark budget (completely optional)",
    profileName: "This is how you'll appear to other travelers",
    profileEmail: "We'll use this for account stuff - we promise not to spam!",
    currentPassword: "We need your current password to make changes",
    newPassword: "Pick something memorable (at least 3 characters)",
    confirmPassword: "Type it again so we know you've got it!",
    profilePhoto: "Let other travelers put a face to your adventures!",
    destinationPhoto: "Upload photos that capture this destination's vibe",
    experiencePhoto: "Share photos that inspire others to try this experience",
    map: "map",
  },

  message: {
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    noPhotoMessage: "No profile photo yet. ",
    uploadPhotoNow: "Upload one now",
    noFavoriteDestinations:
      "No favorite destinations yet. Explore our destinations and add your favorites!",
    addFavoriteDestinations: "Add some favorite destinations",
    noExperiencesYet: "No experiences planned yet. ",
    addExperiences: "Add some experiences",
    addOneNow: "Add one now",
    peopleCreatingPlan: "{count} people are creating this plan",
    personCreatingPlan: "{count} person is creating this plan",
    peoplePlanningExperience: "{count} people are planning this experience",
    personPlanningExperience: "{count} person is planning this experience",
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

  tooltip: {
    syncPlan: "Sync your plan with the latest experience changes",
    setPlannedDate: "Click to set a planned date",
    edit: "Edit",
    delete: "Delete",
  },

  cookieConsent: {
    message: "We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve user experience and analyze website traffic. By clicking \"Accept,\" you agree to our website's cookie use as described in our Cookie Policy.",
    accept: "Accept",
    decline: "Decline",
  },

  admin: {
    userManagement: "User Management",
    superAdminPanel: "Super Admin Panel",
    totalUsers: "Total Users",
    superAdmins: "Super Admins",
    regularUsers: "Regular Users",
    allRoles: "All Roles",
    superAdminsOnly: "Super Admins Only",
    regularUsersOnly: "Regular Users Only",
    searchPlaceholder: "Search by name or email...",
    users: "Users",
    usersFiltered: "Users ({filtered} of {total})",
    name: "Name",
    email: "Email",
    role: "Role",
    joined: "Joined",
    actions: "Actions",
    makeSuperAdmin: "Make Super Admin",
    makeRegularUser: "Make Regular User",
    cannotChangeOwnRole: "You cannot change your own role",
    you: "You",
    roleUpdated: "{name}'s role updated to {role}",
    noUsersMatch: "No users match your filters",
    noUsersFound: "No users found",
    loadingUsers: "Loading users...",
    accessDenied: "Access denied. Only super admins can view this page.",
    backToHome: "← Back to Home",
  },

  social: {
    signInWith: "Sign in with {provider}",
    continueWith: "Continue with {provider}",
    facebook: "Facebook",
    google: "Google",
    twitter: "X",
    orSignInWith: "Or sign in with",
  },
  email: {
    passwordReset: {
      subject: "{appName} - Reset Your Password",
      heading: "Reset Your Password",
      greeting: "Hello {userName},",
      body: "We received a request to reset your password for your {appName} account. Click the button below to create a new password:",
      buttonText: "Reset Password",
      warningTitle: "⚠️ Important:",
      warningText: "This link will expire in 1 hour for security reasons.",
      ignoreText: "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
      securityText: "For security, this link can only be used once and will expire after use.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
    passwordResetConfirmation: {
      subject: "{appName} - Password Changed Successfully",
      heading: "✓ Password Changed",
      greeting: "Hello {userName},",
      successTitle: "✓ Success!",
      successText: "Your password has been changed successfully.",
      body: "This email confirms that your {appName} account password was recently changed.",
      securityText: "If you did not make this change, please contact us immediately at support@biensperience.com.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
    emailConfirmation: {
      subject: "{appName} - Confirm Your Email Address",
      heading: "Welcome to {appName}!",
      greeting: "Hello {userName},",
      body: "Thank you for signing up for {appName}! To complete your registration and start planning your adventures, please confirm your email address.",
      buttonText: "Confirm Email Address",
      infoTitle: "ℹ️ Important:",
      infoText: "This link will expire in 24 hours for security reasons.",
      altLinkText: "If the button doesn't work, you can copy and paste this link into your browser:",
      ignoreText: "If you didn't create an account with {appName}, you can safely ignore this email.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
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
