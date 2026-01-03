// Language constants for UI strings organized by context
const en = {
  button: {
    add: "Add",
    addChild: "Add Child",
    addChildItem: "Add Child Item",
    addPlanItem: "Add Plan Item",
    addCollaborator: "Collaborators",
    addCollaborators: "Collaborators",
    adding: "Adding...",
    cancel: "Cancel",
    clearForm: "Clear Form",
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
    resetPassword: "Reset Password",
    updateDate: "Update Date",
    updateExperience: "Update Experience",
    setDateAndAdd: "Set Date & Add",
    addDestinationCreateExperience: "Add Destination ➡️ Create New Experience",
    addFavoriteExp: "+ Plan It",
    addFavoriteDest: "+ Favorite",
    removeFavoriteExp: "- Remove",
    removeFavoriteDest: "- Remove",
    addToPlan: "+ Add to Planned Experiences",
    removeFromPlan: "- Remove",
    markComplete: "👍 Complete",
    done: "✅ Done",
    undoComplete: "❎ Undo",
    expPlanAdded: "✅ Planned",
    favorited: "❤️ Favorited",
    upload: "Upload",
    uploading: "Uploading...",
    createExperience: "Create Experience",
    createDestination: "Create Destination",
    backToExperiences: "← Back to Experiences",
    backToExperience: "Back to Experience",
    viewAllExperiences: "View All Experiences",
    backToDestinations: "← Back to Destinations",
    backToHome: "← Back to Home",
    backToLogin: "← Back to Login",
    backToOverview: "← Back to Overview",
    viewProfile: "View Profile",
    editProfile: "Edit Profile",
    home: "Home",
    showMore: "Show More",
    showLess: "Show Less",
    loadMore: "Load More",
    syncNow: "Sync Now",
    syncing: "Syncing...",
    edit: "Edit",
    quickTip: "Quick Tip",
    details: "Detailed Tip",
    addTip: "Add Tip",
    saveChanges: "Save Changes",
    saving: "Saving...",
    removeExperience: "Remove Experience",
    confirmSync: "Confirm Sync",
    tryAgain: "Try Again",
    addNewItem: "Add new item",
    saveChangesTooltip: "Save changes",
    addNewItemTooltip: "Add new item",
    cancelTooltip: "Cancel action",
    backTooltip: "Go back",
    editTooltip: "Edit this item",
    deleteTooltip: "Delete this item",
    favoriteTooltip: "Add to favorites",
    unfavoriteTooltip: "Remove from favorites",
    planTooltip: "Add to your plan",
    removeFromPlanTooltip: "Remove from your plan",
    shareTooltip: "Share this item",
    forgotPassword: "Forgot Password?",
    rememberMe: "Remember me",
    viewDetails: "View Details",
    updating: "Updating...",
    creating: "Creating...",
    continue: "Continue",
    saveContinue: "Save & Continue",
    addFinish: "Add & Finish",
    sendInvite: "Send Invite",
    createNewExperience: "Create New Experience",
    addDestination: "Add Destination",
    browseExperiences: "Browse Experiences",
    addPhotoCredits: "+ Add Photo Credits",
  },

  alert: {
    loginFailed:
      "Login unsuccessful. Please check your credentials and try again.",
    signupFailed:
      "Account creation unsuccessful. Please check your information and try again.",
    notEnoughTimeWarning:
      "Warning: You may not have enough time to plan this experience adequately.",
    noExperiencesOrDestinations:
      "No {type} found on this profile yet. Start by adding your first one.",
    noExperiencesInDestination:
      "No experiences in this destination yet. Be the first to add one.",
    noTravelTips: "No travel tips shared yet. Add the first one.",
    welcomeFreshStart: "It looks like this is a fresh start. Get started by creating your first destination or experience.",
    welcomeTitle: "Welcome{name}",
    noDestinationsYet: "No destinations yet. Be the first to add one.",
    noExperiencesYet: "No experiences yet. Create the first one.",
    planOutOfSync: "Plan Out of Sync",
    planOutOfSyncMessage:
      "The experience plan has changed since you created this plan. Update your plan with the latest items.",
    noChangesDetected: "No changes detected.",
    planAlreadyInSync: "Your plan is already in sync with the experience.",
    syncPreserveNote:
      "Your completion status and actual costs will be preserved for existing items.",
    selectChangesToApply: "Select the changes you want to apply to your plan:",
    planNotFound: "Plan not found.",
    noPlanItems: "No plan items yet.",
    changesSavedSuccessfully: "Changes saved successfully.",
    addedCollaborators: "Added {count} collaborator{plural}:",
    removedCollaborators: "Removed {count} collaborator{plural}:",
    noChangesMade: "No changes were made.",
    searchCollaboratorsHelp:
      "Search for users by name or email to add as collaborators. They will be able to view and edit this {context}.",
    emailNotVerified: "Email Verification Required",
    emailNotVerifiedMessage: "You must verify your email address before creating or updating content. Please check your email for a verification link.",
    emailNotVerifiedAction: "Resend Verification Email",
    userNotFound: "User Not Found",
    userNotFoundMessage: "The user profile you're looking for doesn't exist or has been removed.",
    unableToLoadProfile: "Unable to Load Profile",
    profileLoadError: "There was an error loading this profile. Please try again.",
    invalidUserId: "Invalid user ID.",
    failedToLoadProfile: "Failed to load profile.",
    failedToLoadResource: "Failed to load. Please try again.",
    onlySuperAdminsCanUpdateRoles: "Only super admins can update user roles.",
    userRoleUpdated: "User role updated successfully.",
    onlySuperAdminsCanUpdateEmail: "Only super admins can update email confirmation.",
    emailConfirmed: "Email confirmed successfully.",
    emailUnconfirmed: "Email unconfirmed successfully.",
    returnToHome: "Return to Home",
    tryAgain: "Try Again",
    changesDetected: "Changes detected.",
    loadingUserData: "Loading user data.",
    loadingProfile: "Loading your profile.",
    accessDeniedAction: "Access denied. Super admin privileges required.",
    notAuthorizedToUpdateDestination: "You are not authorized to update this destination.",
    notAuthorizedToUpdateExperience: "You are not authorized to update this experience.",
    failedToLoadInviteCodes: "Failed to load invite codes. Please try again.",
    failedToLoadInviteDetails: "Failed to load invite details.",
    loadingInviteDetails: "Loading invite details...",
    loadingInviteTracking: "Loading invite tracking data...",
    failedToLoadDashboardData: "Failed to load dashboard data",
    failedToLoadUpcomingPlans: "Failed to load upcoming plans",
    failedToLoadActivityFeed: "Failed to load activity feed",
    loadingExperiences: "Loading experiences...",
    loadingMoreExperiences: "Loading more experiences...",
    loadingAnalytics: "Loading analytics...",
    confirmingEmail: "Confirming your email address...",
    resettingPassword: "Resetting Password...",
    unableToLoadDashboard: "We were unable to load your dashboard data.",
    failedToFollowUser: "Failed to follow user",
    failedToUnfollowUser: "Failed to unfollow user",
    failedToAddCost: "Failed to add cost",
    failedToAddDetail: "Failed to add detail",
    failedToAddNote: "Failed to add note",
    failedToUpdateNote: "Failed to update note",
    failedToCreateInviteCode: "Failed to create invite code",
    failedToLoadCountryData: "Failed to load country data",
    failedToResendVerificationEmail: "Failed to resend verification email",
    noCsvDataToProcess: "No CSV data to process",
    failedToCreateBulkInvites: "Failed to create bulk invites",
    failedToDeactivateInviteCode: "Failed to deactivate invite code",
    pleaseEnableApiAccessFirst: "Please enable API access first",
    onlySuperAdminsCanUpdateEmailConfirmation: "Only super admins can update email confirmation",
  },

  success: {
    experienceCreated: "Experience created.",
    experienceCreatedExcited: "Experience created successfully!",
    experienceUpdated: "Experience updated.",
    experienceDeleted: "Experience deleted.",
    destinationCreated: "Destination created.",
    destinationUpdated: "Destination updated.",
    planItemDeleted: "Plan item deleted.",
    profileUpdated: "Profile updated.",
    userProfileUpdated: "User profile updated successfully.",
    apiTokenCreated: "API token created successfully. Make sure to copy it now.",
    changesSaved: "Changes saved successfully.",
    resendConfirmation: "Verification email sent. Please check your inbox.",
    photosUpdated: "Photos updated successfully",
    nowFollowing: "Now following this user",
    unfollowed: "Unfollowed user",
    preferencesSaved: "Your preferences have been saved successfully.",
  },

  // User-friendly notifications (actionable and context-aware)
  notification: {
    plan: {
      created: "You're planning this experience! Check out your plan in the My Plan tab.",
      removed: "Removed from your plans. You can add it back anytime.",
      dateUpdated: "Your planned date has been updated",
      syncComplete: "Your plan is now in sync with the experience",
      itemAdded: "New item added to your plan",
      itemUpdated: "Plan item updated",
      itemDeleted: "Item removed from your plan",
      itemCompleted: "Item marked as complete! Nice work!",
      itemUncompleted: "Item marked as incomplete",
      reordered: "Your plan order has been saved",
    },
    experience: {
      created: "{name} is now live! Start planning or invite collaborators.",
      updated: "Your changes to {name} have been saved.",
      deleted: "{name} has been deleted. This action cannot be undone.",
    },
    destination: {
      created: "{name} has been added to Biensperience!",
      updated: "Your changes to {name} have been saved.",
      deleted: "{name} has been deleted.",
    },
    invite: {
      created: "Invite code created: {code}. {emailMsg}",
      csvParsed: "Parsed {count} invites from CSV",
      bulkCreated: "Created {count} invite codes{emailMsg}",
      deactivated: "Invite code deactivated. It can no longer be used.",
      emailSent: "Verification email resent. Check your inbox.",
    },
    admin: {
      roleUpdated: "User role updated to {role}",
      emailConfirmed: "Email {action} successfully",
      stateRestored: "Your previous state has been restored",
    },
    collaborator: {
      added: "{name} can now collaborate on this plan",
      removed: "{name} is no longer a collaborator",
      invited: "Invite sent to {email}. They'll receive an email with instructions to join.",
      assigned: "{name} is now responsible for this item",
      unassigned: "This item is no longer assigned to anyone",
    },
    profile: {
      updated: "Your profile has been updated. Changes are now visible to others.",
      photoUpdated: "Your profile photo has been updated",
      emailConfirmed: "Email confirmed! You now have full access to all features.",
      passwordChanged: "Your password has been changed successfully",
    },
    auth: {
      signedIn: "Welcome back!",
      signedOut: "You've been signed out. See you next time!",
      oauthSuccess: "Welcome back! You're signed in with {provider}.",
    },
    note: {
      added: "Your note has been added and is visible to collaborators",
      updated: "Note updated. All collaborators can see your changes.",
      deleted: "Note deleted",
    },
    photo: {
      uploaded: "Photo uploaded successfully",
      deleted: "Photo removed",
      setDefault: "Default photo updated",
    },
    share: {
      copied: "Link copied to clipboard",
      failed: "Failed to copy link",
    },
    favorite: {
      added: "{name} added to your favorites",
      removed: "{name} removed from your favorites",
    },
    api: {
      tokenCreated: "Your new API token is ready. Copy it now - you won't see it again!",
      tokenCopied: "Token copied! Paste it in your application to connect.",
      tokenRevoked: "Token revoked. It can no longer be used to access your data.",
      accessEnabled: "API access enabled. You can now create tokens below.",
      accessDisabled: "API access disabled. All existing tokens have been revoked for security.",
    },
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
    collaboratorAddedSuccess: "Collaborator{plural} added successfully",
    collaboratorAddedMessage: "{name} has been added as a collaborator to your {context} and can now view and edit it.",
    multipleCollaboratorsAddedMessage: "{count} collaborators have been added to your {context} and can now view and edit it.",
    syncPlanTitle: "Sync Plan with Experience",
    removeExperienceTitle: "Remove Experience from Your Plans",
    removeExperienceFromPlans: "Remove from Your Plans?",
    removeExperienceMessage: "You are about to remove",
    removeExperienceConfirmButton: "Remove from Plans",
    deleteDestination: "Delete Destination?",
    noPlansFallback: "No Plans",
    
    // Additional modal titles
    addNewDestination: "Add New Destination",
    resetPassword: "Reset Password",
    activityDetails: "Activity Details",
    deletePhoto: "Delete Photo",
    photoUrlRequired: "Photo URL Required",
    photoUploadSuccess: "Photos Uploaded Successfully",
    unableToUpdateExperience: "Unable to Update Experience",
    updateFailed: "Update Failed",
    
    // Error titles
    pageError: "Page Error",
    formError: "Form Error",
    experienceError: "Experience Error",
    destinationError: "Destination Error",
    accessDenied: "Access Denied",
    userNotFound: "User Not Found",
    unableToLoadProfile: "Unable to Load Profile",
    
    // Error messages
    errorLoadingPage: "We encountered an error loading this page. Please try again or return home.",
    errorLoadingForm: "Error loading the form. Please try again.",
    errorLoadingExperience: "Error loading experience details.",
    errorLoadingDestination: "Error loading destination details.",
    photoUrlRequiredMessage: "Please enter a valid photo URL to continue.",
    updateFailedMessage: "Failed to update. Please try again.",
    experienceNotFoundOrNoPermission: "Experience not found or you don't have permission to update it.",
    
    // Confirmation messages
    deletePhotoConfirm: "Are you sure you want to permanently delete this photo? This action cannot be undone.",
    removeExperienceConfirm: "Are you sure you want to remove this experience from your plans?",
    unsavedChangesMessage: "You have unsaved changes. Are you sure you want to leave?",
    deactivateInviteConfirm: "Are you sure you want to deactivate this invite code?",

    // Add Date Modal
    addDateModal: {
      title: "Schedule Date",
      titleTimeOnly: "Schedule Time",
      forLabel: "For:",
      dateLabel: "Date",
      timeLabel: "Time",
      timeOptional: "(optional)",
      inheritedFromParent: "(from parent)",
      timezoneInfo: "Times are in your timezone:",
      selectDate: "Please select a date",
      dateBeforeMinDate: "Scheduled date cannot be before the planned date",
      clearDate: "Clear Date",
      save: "Save",
      saving: "Saving...",
    },

    // Transfer Ownership Modal
    transferOwnership: {
      titleChecking: "Checking...",
      titleDeleteExperience: "Delete Experience",
      titleTransferOwnership: "Transfer Ownership",
      titleConfirmAction: "Confirm Action",
      checkingStatus: "Checking experience status...",
      hasActivePlanSingular: "This experience has an active plan",
      hasActivePlansPlural: "This experience has active plans",
      otherUserHasPlanSingular: "{count} other user has created a plan for this experience.",
      otherUsersHavePlansPlural: "{count} other users have created plans for this experience.",
      cannotDeleteDirectly: "Since other users are planning this experience, you cannot delete it directly. Choose how you'd like to proceed:",
      transferOwnershipAction: "Transfer Ownership",
      transferOwnershipDescription: "Give ownership to another user who can continue managing the experience.",
      archiveExperienceAction: "Archive Experience",
      archiveExperienceDescription: "Move to archive. The experience remains accessible to users with plans, but will no longer appear in public listings.",
      noPlansExist: "No users have created plans for this experience. You can safely delete it.",
      searchUserPrompt: "Search for a user to transfer ownership of \"{name}\" to:",
      searchPlaceholder: "Search by name or email...",
      searchingUsers: "Searching...",
      typeToSearch: "Type to search users...",
      selectedUser: "Selected user:",
      confirmDelete: "Delete \"{name}\"?",
      confirmDeleteWarning: "This action cannot be undone. The experience and all its data will be permanently removed.",
      confirmTransfer: "Transfer to {name}?",
      confirmTransferWarning: "{name} will become the new owner of \"{experienceName}\" and will have full control over it. You will lose ownership access.",
      confirmArchive: "Archive \"{name}\"?",
      confirmArchiveWarning: "The experience will be moved to archive. Users with existing plans can still access it, but it won't appear in public listings or search results.",
      buttonDeletePermanently: "Delete Permanently",
      buttonTransferOwnership: "Transfer Ownership",
      buttonArchiveExperience: "Archive Experience",
      buttonBack: "Back",
      buttonCancel: "Cancel",
      buttonProcessing: "Processing...",
      successDeleted: "\"{name}\" has been deleted.",
      successTransferred: "Ownership of \"{name}\" has been transferred to {newOwner}.",
      successArchived: "\"{name}\" has been archived.",
      errorMissingExperienceId: "Experience ID is missing",
      errorMissingUser: "Please select a user to transfer ownership to.",
      errorCheckFailed: "Failed to check experience status",
      errorProcessFailed: "Failed to process request",
    },
  },

  emptyState: {
    noLocationData: "No Location Data",
    noLocationDataDescription: "None of the experiences in this country have location coordinates. Try the cards view instead.",
    noDestinationsYet: "No Destinations Yet",
    noDestinationsYetDescription: "There are no destinations added for {country} yet.",
    noExperiencesYet: "No Experiences Yet",
    noExperiencesYetDescription: "There are no experiences added for {country} yet.",
    noExperiencesFound: "No Experiences Found",
    noExperiencesFoundDescription: "No experiences match your current filters. Try adjusting your search criteria or browse all experiences.",
    noExperiencesInDestination: "No experiences in this destination yet",
    noExperiencesInDestinationDescription: "Be the first to add one and help others discover amazing activities here.",
  },

  page: {
    experiences: {
      title: "All Experiences",
      ogTitle: "Discover Amazing Travel Experiences",
      description: "Browse our curated collection of travel experiences from around the world. Discover unique adventures, plan your trips, and create unforgettable memories.",
      keywords: "travel experiences, adventures, trip planning, travel activities, tourism, bucket list, world travel",
    },
    destinations: {
      title: "All Destinations",
      ogTitle: "Discover Amazing Travel Destinations",
      description: "Explore our curated collection of travel destinations from around the world. Find your next adventure destination with detailed information, photos, and travel tips.",
      keywords: "travel destinations, world destinations, travel planning, tourism, vacation spots, travel guide, countries, cities",
    },
    allUsers: {
      title: "All Users - Admin Panel",
      description: "Super admin panel for managing all users and their roles.",
    },
  },

  heading: {
    signInToAccount: "Sign In To Your Account",
    createAccount: "Create Your Account",
    createdBy: "Created by",
    createExperience: "Create an Experience",
    updateExperience: "Update Experience",
    newDestination: "New Destination",
    createDestination: "Create a Destination",
    estimatedCost: "Estimated Cost",
    trackedCosts: "Tracked Costs",
    planningTime: "Planning Time",
    planYourExperience: "Plan It",
    editPlannedDate: "Update Planned Date",
    travelTips: "Travel Tips",
    favoriteDestinations: "Favorite Destinations",
    preferredExperienceTypes: "Preferred Experience Types",
    plannedExperiences: "Planned",
    experienceDestinations: "✈️ Destinations",
    createdExperiences: "Created",
    popularDestinations: "Popular Destinations",
    curatedExperiences: "Curated Experiences",
    updateProfile: "Update {name}",
    thePlan: "The Plan",
    myPlan: "My Plan",
    myPlans: "My Plans",
    plans: "Plans",
    collaborators: "Collaborators",
    experiencesIn: "Experiences in {destinationName}",
    dashboardUnavailable: "Dashboard Unavailable"
  },

  label: {
    name: "Name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    orSignUpWith: "Or sign up with",
    orSignInWith: "Or sign in with",
    destinationLabel: "Destination",
    address: "Address",
    title: "Title",
    overview: "Overview",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    costEstimate: "Cost Estimate",
    costEstimatePerPersonTooltip: "Estimated cost per person",
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
    person: "person",
    people: "people",
    collaborators: "Collaborators",
    itemDescription: "Item Description",
    urlOptional: "URL (optional)",
    cost: "Cost",
    planningTimeLabel: "Planning Time",
    estimatedLabel: "Estimated:",
    actualLabel: "Actual:",
    activityType: "Activity Type",
    selectAll: "Select All",
    addedItems: "Added Items ({count})",
    removedItems: "Removed Items ({count})",
    modifiedItems: "Modified Items ({count})",
    details: "Details",
    note: "Note:",
    travelTipsType: "Type",
    travelTipsDescription: "Details",
    travelTipsAdditionalNote: "Additional Notes",
    travelTipsIcon: "Icon (Optional)",
    travelTipsCategory: "Category",
    travelTipsExchangeRate: "Exchange Rate Info",
    travelTipsCallToAction: "Call-to-Action (Optional)",
    searchUser: "Search User",
    selectedCollaborators: "Selected Collaborators",
    emailAndNameRequired: "Email and name are required",
    sharedPlan: "Shared",
    sharedPlanTooltip: "This plan was shared with you by {ownerName}. As a collaborator, you can view progress, add notes, and track costs, but you cannot delete the plan or remove other collaborators.",
    totalSpent: "Tracked Costs",
    trackedCosts: "Tracked Costs",
    messages: "Messages",
    planItem: "Plan Item",
    photos: "Photos",
    // Navigation and tab labels
    dashboard: "Dashboard",
    preferences: "Preferences",
    editProfile: "Edit Profile",
    created: "Created",
    destinations: "Destinations",
    // View mode labels
    cardView: "Card View",
    compactView: "Compact View",
    activityView: "Activity View",
    timelineView: "Timeline View",
  },

  aria: {
    // Modal and overlay accessibility
    close: "Close",
    closePhotoViewer: "Close photo viewer",
    dismissAlert: "Dismiss alert",
    
    // Navigation
    mainNavigation: "Main navigation",
    mainContent: "Main content",
    authentication: "Authentication",
    biensperienceHome: "Biensperience home",
    scrollToTop: "Scroll to top of page",
    toggleNavigationMenu: "Toggle navigation menu",
    browseDestinations: "Browse destinations",
    browseExperiences: "Browse experiences",
    viewDashboard: "View dashboard",
    userMenuFor: "User menu for {name}",
    userAccountOptions: "User account options",
    viewYourProfile: "View your profile",
    trackYourInviteCodes: "Track your invite codes",
    adminPanelManageUsers: "Admin panel - manage all users",
    createNewDestination: "Create a new destination",
    createNewExperience: "Create a new experience",
    logOutOfAccount: "Log out of your account",
    
    // Profile actions
    emailConfirmed: "Email confirmed",
    profileActions: "Profile Actions",
    editDestination: "Edit Destination",
    
    // Photos and images
    photoUpload: "Photo upload",
    uploadedPhotos: "Uploaded photos",
    photoCreditName: "Photo credit name",
    photoCreditUrl: "Photo credit URL",
    chooseImageFiles: "Choose image files to upload",
    photoUrl: "Photo URL",
    photoViewer: "Photo viewer",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    clickToViewFullSize: "Click to view full size photo",
    defaultPhoto: "Default photo",
    switchToFileUpload: "Switch to file upload",
    useUrlInstead: "Use a URL instead",
    
    // Search and filters
    globalSearch: "Global search",
    searchResults: "Search results",
    sortAndFilterOptions: "Sort and filter options",
    sortExperiences: "Sort experiences",
    
    // Form actions
    restoreSavedFormData: "Restore saved form data",
    discardSavedFormData: "Discard saved form data",
    createDestinationContinue: "Create destination and continue to experience",
    
    // Tips and help
    deleteTip: "Delete tip",
    moreInformation: "More information",
    
    // Plan and item actions
    editPlanItemTitle: "Edit plan item title",
    deletePlanItem: "Delete plan item",
    addDetailsToPlanItem: "Add details to plan item",
    
    // Misc actions
    removeFile: "Remove file",
    selectCurrency: "Select currency",
    removeCustomField: "Remove custom field",
    copyAddressToClipboard: "Copy address to clipboard",
    filterDetailTypes: "Filter detail types",
    navigationTabs: "Navigation tabs",
    locked: "locked",
    remove: "remove",
    required: "required",
    
    // View modes
    cardsView: "Cards view",
    mapView: "Map view",
    listView: "List view",
    gridView: "Grid view",
    
    // Plan and item management
    planTabs: "Plan tabs",
    togglePlansDropdown: "Toggle plans dropdown",
    planActionsMenu: "Plan actions menu",
    itemActions: "Item actions",
    pinnedItem: "Pinned item",
    clearAddress: "Clear address",
    showActualCostEstimate: "Show actual cost estimate",
    
    // Misc
    emailAddress: "Email Address",
  },

  placeholder: {
    email: "Email Address",
    password: "Password",
    confirmPassword: "Confirm Password",
    name: "Name (ex. John Doe)",
    nameField: "Name",
    emailField: "Email",
    emailExample: "Email (ex. john@doe.com)",
    search: "Search...",
    experienceName:
      "e.g. Brewery Tour at Lakefront Brewery with a Local in Milwaukee",
    overview:
      "Describe what makes this experience special, what travelers can expect, and any highlights they should know about...",
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
    addressPlaceholder: "e.g. 123 Main St, City, Country",
    travelTipSimple: "Add a helpful tip...",
    travelTipDescription: "Main tip content (required)",
    travelTipNote: "Optional additional details or context",
    travelTipCategory: "e.g., Shopping, Nightlife",
    travelTipIcon: "Custom emoji or icon (optional)",
    travelTipExchangeRate: "e.g., 1 USD = 0.85 EUR (as of Jan 2025)",
    travelTipCtaLabel: "Button text (e.g., 'Book Now')",
    travelTipCtaUrl: "https://example.com",
    searchNameOrEmail: "Type name or email...",
    searchByNameOrEmail: "Search by name or email...",
    collaboratorEmail: "collaborator@example.com",
    collaboratorName: "Collaborator's full name",
    enterCurrentPassword: "Enter your current password",
    confirmNewPassword: "Confirm your new password",
    enterNewPassword: "Enter new password",
    reEnterNewPassword: "Re-enter new password",
    travelTipInsider: "Share an insider tip...",
    travelTipInsiderExample: "Share an insider tip (e.g., 'Best time to visit is spring')",
    forgotPasswordEmail: "your.email@example.com",
    directImageUrl: "Enter direct image URL (e.g., https://example.com/image.jpg)",
    cityExample: "e.g., Paris, Tokyo, New York",
    stateProvinceExample: "e.g., California, Ontario, Île-de-France",
    countryExample: "e.g., United States, Canada, France",
    inviteUserEmail: "user@example.com",
    welcomeMessage: "Welcome to Biensperience",
    tokenNameOptional: "Token name (optional)",
    searchActivities: "Search activities...",
    planItemExample: "e.g., Book flight tickets",
    enterYourName: "Enter your name",
    enterYourEmail: "Enter your email",
    destinationOverview: "Describe what makes this destination special, what travelers can expect, and any highlights they should know about...",
  },

  helper: {
    nameRequired:
      "Give your experience an exciting name that captures what makes it special.",
    overviewOptional:
      "Share a brief description to help travelers understand what they're in for.",
    destinationRequired: "Pick where this adventure takes place, or ",
    createNewDestination: "add a new destination to our map 🗺️",
    experienceTypesOptional:
      "Tag your experience to help others discover it (food, adventure, culture, etc.).",
    addressOptional:
      "Add a specific address if you have one - totally optional.",
    photoOptional: "Show off this experience with some awesome photos.",
    photosOptional:
      "Bring your experience to life with photos (optional but recommended).",
    cityRequired: "Which city is calling your name?",
    stateProvinceRequired: "The state or province where adventure awaits.",
    countryRequired: "Which country will host this experience.",
    noneTopLevel: "None (Top Level)",
    requiresDaysToPlan:
      "Heads up. This experience needs at least {days} of planning time.",
    planningDaysOptional:
      "How many days should travelers plan ahead? (Optional).",
    planningTimeTooltip:
      "Recommended time to plan and prepare for this experience before your trip. Does not include travel time to the destination.",
    costEstimateTooltip:
      "Estimated cost per person. Forecasted budget from the experience creator. Your costs may vary based on your choices and circumstances.",
    trackedCostTooltip:
      "Real expenses you've incurred. Track receipts, bookings, and payments to compare against the estimate.",
    costEstimateOptional:
      "Give future travelers a ballpark budget per person (completely optional).",
    profileName: "This is how you'll appear to other travelers.",
    profileEmail: "We'll use this for account stuff - we promise not to spam.",
    currentPassword: "We need your current password to make changes.",
    newPassword: "Pick something memorable (at least 3 characters).",
    confirmPassword: "Type it again so we know you've got it.",
    profilePhoto: "Let other travelers put a face to your adventures.",
    destinationPhoto: "Upload photos that capture this destination's vibe.",
    experiencePhoto: "Share photos that inspire others to try this experience.",
    map: "map",
    travelTipsHelp: "Add helpful tips for travelers. Choose quick tip for quick notes, or detailed tip for in-depth information and links.",
    travelTipsIconHelp: "Leave blank to use default icon for this type.",
    travelTipsCtaHelp: "Add a button with a link for more information.",
    planningDays: "Days needed to plan this without rushing",
    costEstimate: "Estimated cost per person in your preferred currency",
    inviteEmailHelpText: "We'll send them an invitation to join",
  },

  message: {
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    joinCommunity: "Join our community of travelers and start planning your next adventure.",
    agreeToTermsPrefix: "I agree to the",
    and: "and",
    noPhotoMessage: "No profile photo yet.",
    uploadPhotoNow: "Upload One Now",
    noFavoriteDestinations:
      "No favorite destinations yet. Explore our destinations and add your favorites.",
    addFavoriteDestinations: "Add Some Favorite Destinations",
    noInviteCodes: "You haven't created any invite codes yet{first_name_suffix}.",
    selectInviteCode: "Select an invite code to view details.",
    noInviteRedemptions: "No one has redeemed this invite code yet",
    noExperiencesYet: "No experiences planned yet. ",
    addExperiences: "Add Some Experiences",
    addOneNow: "Add one now.",
    addOneNowButton: "Add One Now",
    peopleCreatingPlan: "{count} people are creating this plan",
    personCreatingPlan: "{count} person is creating this plan",
    peoplePlanningExperience: "{count} people are planning this experience",
    personPlanningExperience: "{count} person is planning this experience",
    typeAtLeast2CharsToSearch: "Type at least 2 characters to search",
    noUsersFoundTryDifferent: "No users found. Try a different search term.",
    selected: "Selected ({count}):",
    quickCreateNote: "You can add more details (description, photos, travel tips) by visiting the",
    destinationsPage: "destinations page",
    later: "later.",
  },

  formPersistence: {
    momentsAgo: "moments ago",
    minutesAgo: "{minutes} minute{plural} ago",
    hoursAgo: "{hours} hour{plural} ago",
    daysAgo: "{days} day{plural} ago",
    restoredCreating: "Your progress was restored from {timeAgo}. You can continue creating.",
    restoredUpdating: "Your progress was restored from {timeAgo}. You can continue updating.",
    savedSuccessfully: "Form progress saved.",
    clearingForm: "Clearing saved form data...",
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
    costEstimate: "Cost Estimate (per person)",
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

  // Photo upload component strings
  photo: {
    // Labels
    creditName: "Photo credit name",
    creditUrl: "Photo credit URL",
    chooseFile: "Choose image file",
    photoUrl: "Photo URL",
    uploadedPhotos: "Uploaded photos",
    photosCount: "Photos ({active} active, {disabled} disabled)",
    urlsInQueue: "URLs in queue ({count})",

    // Placeholders
    directImageUrl: "Enter direct image URL (e.g., https://example.com/image.jpg)",

    // Button text
    uploadAllUrls: "Upload All ({count})",
    uploadFile: "Upload a file instead",
    addUrl: "Add a URL instead",
    updateUrlInQueue: "Update URL in queue",
    addUrlToQueue: "Add URL to queue",
    setAsDefault: "Set as Default",
    enablePhoto: "✓ Enable",
    disablePhoto: "✗ Disable",
    deletePhoto: "🗑️ Delete",

    // Badges
    defaultBadge: "Default",
    disabledBadge: "Disabled",
    invalidUrl: "Invalid image URL",

    // Help text
    acceptedFormats: "Accepted formats: JPG, PNG, GIF. Maximum size: 5MB per file. You can select multiple files.",
    tipDisabledPhotos: "Disabled photos (shown in gray with red border) will be removed when you save.",
    tipEnablePhotos: "Click <strong>Enable</strong> to keep them.",
    tipLabel: "💡 Tip:",
    clickToToggle: "Click to enable/disable this photo",

    // Alerts and errors
    enterPhotoUrl: "Please enter a photo URL",
    enterValidUrl: "Please enter a valid URL",
    unsafeUrl: "This URL uses an unsupported protocol or is unsafe",
    urlAlreadyAdded: "This URL has already been added to the queue",
    noUrlsInQueue: "No URLs in queue to upload",
    uploadSuccess: "Successfully uploaded {count} photo(s) from URLs",

    // Modals
    deletePhotoTitle: "Delete Photo?",
    deletePhotoMessage: "You are about to permanently delete this photo",
    deletePhotoConfirm: "Delete Permanently",
    deleteHint: "Click a photo below to delete it:",
  },

  // Search component strings
  search: {
    defaultPlaceholder: "Search destinations, experiences, users...",
    noResultsFor: "No results found for \"{query}\"",
    minCharacters: "Type at least 2 characters to search",
    searching: "Searching...",
    globalSearch: "Global search",
    searchResults: "Search results",
  },

  // Loading states
  loading: {
    default: "Loading...",
    page: "Loading page...",
    destinations: "Loading destinations...",
    moreDestinations: "Loading more destinations...",
    experience: "Loading experience...",
    destination: "Loading destination...",
    profile: "Loading profile...",
    favoriteDestinations: "Loading favorite destinations...",
    preferredExperiences: "Loading preferred experience types...",
    activities: "Loading activities...",
    inviteCodes: "Loading invite codes...",
    plan: "Loading plan...",
    loadMore: "Load More ({remaining} remaining)",
  },

  // Form validation messages
  validation: {
    destinationAlreadyExists: "A destination named \"{name}\" already exists. Please choose a different destination.",
    experienceAlreadyExists: "An experience named \"{name}\" already exists. Please choose a different name.",
    titleRequired: "Please enter a title for the experience.",
    experienceNameRequired: "Please enter an experience name",
    destinationRequired: "Please select a destination from the list or create a new destination first.",
    selectDestinationRequired: "Please select a destination",
    checkPermissions: "Please check that you have the correct permissions and try again.",
    missingRequiredData: "Missing required data",
    noPreviewAvailable: "No preview available",
  },

  // Form field labels (additional)
  formLabel: {
    cityTown: "City / Town",
    stateProvince: "State / Province",
    country: "Country",
    overview: "Overview",
    photos: "Photos",
    cityName: "City Name",
  },

  // Form helper text (additional)
  formHelper: {
    uploadPhotosDestination: "Upload photo(s) to this destination (optional)",
    uploadPhotosExperience: "Upload multiple photos for this experience (optional)",
    searchDestinations: "Type to search for destinations...",
  },

  // Travel tips
  travelTip: {
    deleteTitle: "Delete Travel Tip?",
    deleteMessage: "You are about to permanently delete this travel tip",
    deleteConfirm: "Delete Permanently",
    insiderTipPlaceholder: "Share an insider tip (e.g., 'Best time to visit is spring')",
  },

  // Experience/Destination creation success
  creationSuccess: {
    experienceTitle: "Experience Created!",
    experienceMessage: "Your experience has been created successfully",
    destinationTitle: "Destination Created!",
    destinationMessage: "Your destination has been created successfully",
  },

  // Destination autocomplete
  destinationAutocomplete: {
    createNew: "✚ Create \"{term}\"",
    newDestination: "New Destination",
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
    moreInformation: "More information",
    clickToViewNotes: "Click to view notes",
    clickToViewDetails: "Click to view details",
    clickToEditTitle: "Click to edit title",
    clickToEditScheduledDate: "Click to edit scheduled date",
    pinnedToTop: "Pinned to top",
    pinnedToTopExpandCollapse: "Pinned to top - click to expand/collapse",
    viewNotesAssignmentsDetails: "View notes, assignments, and other details",
    planActions: "Plan actions",
    actions: "Actions",
    removeFromQueue: "Remove from queue",
    editYourProfile: "Edit Your Profile",
    // Experience form tooltips (friendly & playful)
    experienceName: "Give it a snappy title — make travelers curious!",
    overview: "Describe the experience in a few sentences: highlights, expectations, and must-knows.",
    destination: "Where does this adventure happen? Pick a place or add a new destination 🗺️",
    mapLocation: "Optional: add a precise address or landmark to help visitors find the spot.",
    experienceTypes: "Tag this experience (e.g., Culinary, Adventure) so others can discover it.",
    photos: "Add eye-catching photos — visuals make people want to join! (optional)",
  },

  cookieConsent: {
    message: "We use cookies to enhance your experience.",
    accept: "Accept",
    decline: "Decline",
    learnMore: "Learn More",
  },

  admin: {
    userManagement: "Users",
    superAdminPanel: "Administer users and roles on the platform",
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
    cannotChangeOwnRole: "You cannot change your own role.",
    confirmEmail: "Confirm Email",
    unconfirmEmail: "Unconfirm Email",
    you: "You",
    roleUpdated: "{name}'s role updated to {role}",
    noUsersMatch: "No users match your filters.",
    noUsersFound: "No users found.",
    loadingUsers: "Loading users.",
    accessDenied: "Access denied. Only super admins can view this page.",
    failedToLoadUsers: "Failed to load users.",
    allUsersTitle: "All Users - Admin Panel",
    allUsersDescription: "Super admin panel for managing all users and their roles.",
    backToHome: "← Back to Home",
  },

  api: {
    tokens: "API Tokens",
    access: "API Access",
    accessTitle: "API Access",
    accessDescription: "Enable API access to use API tokens for programmatic access",
    accessEnabled: "API access enabled",
    accessDisabled: "API access disabled and all tokens revoked",
    accessDisabledMessage: "API access is currently disabled. Enable it above to create and use API tokens.",
    failedToToggleAccess: "Failed to toggle API access.",
    enableAccessFirst: "Please enable API access first.",
    tokenCreated: "API token created successfully. Make sure to copy it now.",
    failedToCreateToken: "Failed to create API token.",
    tokenCopied: "Token copied to clipboard.",
    failedToCopyToken: "Failed to copy token.",
    tokenRevoked: "Token revoked successfully.",
    failedToRevokeToken: "Failed to revoke token.",
    failedToLoadTokens: "Failed to load API tokens.",
    createNewToken: "Create New Token",
    createTokenTitle: "Create New Token",
    tokenNamePlaceholder: "Token name (optional)",
    tokenNameHelp: "Give your token a descriptive name to remember what it's for",
    generateToken: "Generate Token",
    creatingToken: "Creating...",
    yourTokens: "Your Tokens",
    yourTokensTitle: "Your Tokens",
    loading: "Loading...",
    loadingTokens: "Loading...",
    noTokensYet: "You don't have any API tokens yet. Create one above to get started.",
    noTokensMessage: "You don't have any API tokens yet. Create one above to get started.",
    newTokenCreated: "New Token Created",
    newTokenTitle: "New Token Created",
    copyTokenMessage: "Make sure to copy your token now. You won't be able to see it again.",
    newTokenWarning: "Make sure to copy your token now. You won't be able to see it again.",
    copiedIt: "I've copied it, dismiss this message.",
    dismissMessage: "I've copied it, dismiss this message.",
    active: "Active",
    activeStatus: "Active",
    revoked: "Revoked",
    revokedStatus: "Revoked",
    prefix: "Prefix",
    prefixLabel: "Prefix:",
    created: "Created",
    createdLabel: "Created:",
    lastUsed: "Last used",
    lastUsedLabel: "Last used:",
    expires: "Expires",
    expiresLabel: "Expires:",
    never: "Never",
    neverLabel: "Never",
    revoke: "Revoke",
    revokeButton: "Revoke",
    revokeConfirm: "Are you sure you want to revoke this token? This action cannot be undone.",
    usageInstructions: "How to use your API token:",
    usageTitle: "How to use your API token:",
    usageStep1: "Include the token in the Authorization header",
    usageStep2: "Format: Authorization: Bearer YOUR_TOKEN_HERE",
    usageStep3: "API tokens bypass CSRF protection",
    usageStep4: "Tokens have the same permissions as your user account",
    example: "Example:",
    exampleTitle: "Example:",
    copyButton: "Copy",
    closeButton: "Close",
  },

    // AI system prompts (default prompts for AI tasks). These are placed here
    // so they can be localized in the future and overridden at call sites.
    prompts: {
    autocomplete: `You are a helpful travel assistant that provides autocomplete suggestions for travel-related content.
  Provide concise, relevant completions that match the user's writing style.
  Only output the completion text, no explanations.`,

    edit_language: `You are an expert editor for travel content.
  Improve the grammar, clarity, and flow of the text while maintaining the original meaning and tone.
  Fix any spelling or punctuation errors.
  Only output the edited text, no explanations or commentary.`,

    improve_description: `You are a skilled travel writer who creates engaging, vivid descriptions of destinations and experiences.
  Enhance the description to be more compelling, informative, and evocative while keeping it authentic and accurate.
  Maintain a friendly, conversational tone suitable for travel planning.
  Only output the improved description, no explanations.`,

    summarize: `You are a travel content summarizer.
  Create a concise, informative summary that captures the essential details.
  Focus on key highlights, practical information, and what makes the destination or experience unique.
  Only output the summary, no explanations.`,

    generate_tips: `You are an experienced traveler sharing practical tips.
  Generate helpful, actionable travel tips based on the destination or experience.
  Include local insights, best practices, and things to be aware of.
  Format tips as a JSON array of strings. Only output valid JSON.`,

    translate: `You are a professional translator specializing in travel content.
  Translate the text while preserving the meaning, tone, and cultural nuances.
  Adapt any culturally-specific references appropriately.
  Only output the translated text, no explanations.`
    },

  // Feature flag error messages and descriptions
  featureFlags: {
    // Generic messages
    accessDenied: "Feature Access Denied",
    featureNotAvailable: "This feature is not available for your account.",
    upgradeToPremium: "Upgrade to premium to unlock this feature.",
    joinBeta: "Join the beta program to access this feature.",
    contactSupport: "Contact support for more information.",

    // Specific flag messages
    ai_features: {
      name: "AI Features",
      description: "AI-powered text assistance including autocomplete, improvement, translation, and summarization.",
      deniedTitle: "AI Features Not Available",
      deniedMessage: "AI-powered features require a premium subscription. These features include intelligent autocomplete, text improvement, translation, and content summarization.",
      upgradeMessage: "Upgrade your account to unlock AI-powered writing assistance.",
      tier: "premium"
    },
    beta_ui: {
      name: "Beta UI",
      description: "Access to new user interface features currently in testing.",
      deniedTitle: "Beta Features Not Available",
      deniedMessage: "This feature is part of our beta program. Beta users get early access to new features before they're released to everyone.",
      upgradeMessage: "Join our beta program to try new features before anyone else.",
      tier: "beta"
    },
    advanced_analytics: {
      name: "Advanced Analytics",
      description: "Detailed insights and analytics about your travel planning.",
      deniedTitle: "Advanced Analytics Not Available",
      deniedMessage: "Advanced analytics provide detailed insights into your travel patterns, spending, and planning habits.",
      upgradeMessage: "Upgrade to premium to access advanced analytics.",
      tier: "premium"
    },
    real_time_collaboration: {
      name: "Real-Time Collaboration",
      description: "Collaborate with others in real-time on shared plans.",
      deniedTitle: "Real-Time Collaboration Not Available",
      deniedMessage: "Real-time collaboration allows multiple users to edit and update plans simultaneously.",
      upgradeMessage: "Upgrade to premium for real-time collaboration features.",
      tier: "premium"
    },
    document_ai_parsing: {
      name: "AI Document Parsing",
      description: "Automatically extract information from travel documents.",
      deniedTitle: "AI Document Parsing Not Available",
      deniedMessage: "AI document parsing automatically extracts booking details, confirmations, and other information from uploaded documents.",
      upgradeMessage: "Upgrade to premium for AI-powered document processing.",
      tier: "premium"
    },
    bulk_export: {
      name: "Bulk Export",
      description: "Export multiple plans and experiences at once.",
      deniedTitle: "Bulk Export Not Available",
      deniedMessage: "Bulk export allows you to download multiple plans and experiences in various formats.",
      upgradeMessage: "Upgrade to premium for bulk export functionality.",
      tier: "premium"
    },

    // Error codes
    errorCodes: {
      FEATURE_FLAG_REQUIRED: "This feature requires a specific subscription or access level.",
      FEATURE_EXPIRED: "Your access to this feature has expired.",
      FEATURE_NOT_ENABLED: "This feature is not enabled for your account."
    }
  },

  dashboard: {
    myPlansDescription: "Your saved plans with progress and cost tracking",
  },
  invite: {
    heading: "Invite Users",
    inviteCode: "Invite Code",
    inviteCodeOptional: "Invite Code (optional)",
    inviteCodeHelp: "If you have an invite code, enter it here to unlock pre-configured experiences and destinations.",
    enterInviteCode: "Enter invite code",
    validatingCode: "Validating invite code...",
    validCode: "Valid invite code",
    invalidCode: "Invalid or expired invite code",
    emailInvite: "Email Invite",
    inviteByEmail: "Invite by Email",
    inviteCollaborator: "Invite Collaborator",
    invitedBy: "Invited by {name}",
    inviteDetails: "Invite Details",
    preConfigured: "This invite includes:",
    experiencesIncluded: "Experiences to collaborate on",
    destinationsIncluded: "Destinations to explore",
    enterEmailForDetails: "Enter your email address to see who invited you",
    customMessage: "Message from {name}:",
    sendInvite: "Send Invite",
    sendingInvite: "Sending invite...",
    inviteSent: "Invite sent successfully.",
    inviteSentTo: "Invite sent to {email}",
    inviteNotSent: "Failed to send invite email.",
    inviteCreated: "Invite code created: {code}",
    copyInviteLink: "Copy Invite Link",
    inviteLinkCopied: "Invite link copied to clipboard.",
    emailPlaceholder: "Enter email address",
    emailsPlaceholder: "Enter email addresses (one per line or comma-separated)",
    namePlaceholder: "Recipient's name (optional)",
    messagePlaceholder: "Add a personal message (optional)",
    selectExperiences: "Select experiences to include",
    selectDestinations: "Select destinations to include",
    noExperiencesSelected: "No experiences selected.",
    noDestinationsSelected: "No destinations selected.",
    inviteExistingUser: "Invite existing user as collaborator",
    inviteNewUser: "Invite new user to join application",
    emailAlreadyExists: "This email is already registered.",
    emailAvailable: "Email available - will send invite.",
    confirmInvites: "Confirm Invites",
    confirmInviteMessage: "Send invites to the following email addresses?",
    willBeInvited: "Will be invited:",
    alreadyRegistered: "Already registered:",
    bulkInviteSuccess: "{count} invite{plural} sent successfully",
    bulkInvitePartial: "{sent} invite{plural} sent, {failed} failed",
  },
  cost: {
    addCost: "Track Cost",
    addCostToItem: "Track cost for this item",
    editCost: "Edit Cost",
    costs: "Tracked Costs",
    costTitle: "Cost Title",
    costTitlePlaceholder: "e.g., Flight tickets, Hotel booking",
    costTitleRequired: "Please enter a title for this cost",
    costAmount: "Amount",
    costAmountPlaceholder: "0.00",
    costDescription: "Description (optional)",
    costDescriptionPlaceholder: "Add details about this cost",
    currency: "Currency",
    category: "Category",
    categoryPlaceholder: "Select a category (optional)",
    categoryAccommodation: "Accommodation",
    categoryTransport: "Transport",
    categoryFood: "Food & Dining",
    categoryActivities: "Activities",
    categoryEquipment: "Equipment",
    categoryOther: "Other",
    costDate: "Date",
    costDateHelp: "When was this cost incurred?",
    assignedTo: "Paid by",
    paidFor: "Paid for",
    assignedToPlaceholder: "Select who paid (optional)",
    assignedToPlanItem: "For Plan Item",
    assignedToPlanItemPlaceholder: "Select plan item (optional)",
    sharedCost: "Shared cost (split among all)",
    generalCost: "General cost (not linked to item)",
    costAdded: "Cost added successfully",
    costUpdated: "Cost updated successfully",
    costDeleted: "Cost deleted",
    confirmDeleteCost: "Are you sure you want to delete this cost?",
    noCostsYet: "No costs tracked yet.",
    totalCosts: "Total Tracked Costs",
    costsByPerson: "Costs by Person",
    costsByItem: "Costs by Item",
    costsByCategory: "Costs by Category",
    sharedCosts: "Shared Costs",
    generalCosts: "General Costs",
    perPersonShare: "Per Person Share",
    costSummary: "Cost Summary",
    addFirstCost: "Track your first cost",
    individualCosts: "Individual Costs",
    grandTotal: "Grand Total",
    exportCsv: "Export CSV",
    viewAll: "View All",
    collapse: "Collapse",
    expand: "Expand",
    costBreakdown: "Cost Breakdown",
    uncategorized: "Uncategorized",
    splitEvenly: "split evenly among {count} people",
  },

  // Profile update view strings
  profile: {
    // Page titles
    editUserProfile: "Edit User Profile: {name} ({email})",
    updateYourProfile: "Update Your Profile",
    editUserTitle: "Edit User - {name}",
    editProfileTitle: "Edit Profile - {name}",
    adminDescription: "Admin: Update user profile settings, change name, email, and account settings.",
    selfDescription: "Update your Biensperience profile settings, change your name, email, and profile photo. Manage your travel planning account.",
    adminOgDescription: "Admin: Update user profile and account settings",
    selfOgDescription: "Update your Biensperience profile and account settings",
    keywords: "edit profile, update profile, account settings, profile photo, user settings",

    // Section headers
    basicInfo: "Basic Information",
    changePassword: "Change Password",
    profilePhoto: "Profile Photo",
    curatorProfile: "Curator Profile",
    superAdminPermissions: "Super Admin Permissions",
    dangerZone: "Danger Zone",

    // Form labels
    name: "Name",
    emailAddress: "Email Address",
    location: "Location",
    currentPassword: "Current Password",
    newPassword: "New Password",
    password: "Password",
    confirmNewPassword: "Confirm New Password",
    curatorBio: "Bio",

    // Curator fields
    curatorBioPlaceholder: "Tell others about yourself, your travel expertise, and what makes your curated experiences special...",
    curatorBioTooltip: "A short bio that will be displayed on your profile and curated experiences (max 500 characters)",
    curatorLinks: "Links",
    curatorLinksTooltip: "Add website, social media, or other links to share on your curator profile",
    linkTitle: "Link title",
    linkUrl: "https://example.com",
    linkUsername: "username",
    removeLink: "Remove link",
    addLink: "Add Link",

    // Admin section - Role
    currentRole: "Current Role: {role}",
    superAdmin: "Super Admin",
    regularUser: "Regular User",
    roleDescription: "Change this user's role. Super admins have full access to all resources and user management.",
    makeSuperAdmin: "Make Super Admin",
    makeRegularUser: "Make Regular User",

    // Admin section - Email status
    emailStatus: "Email Status",
    emailConfirmed: "Confirmed",
    emailUnconfirmed: "Unconfirmed",
    emailStatusDescription: "Manually confirm or unconfirm this user's email address.",
    confirmEmail: "Confirm Email",
    unconfirmEmail: "Unconfirm Email",

    // Admin section - Feature flags
    featureFlags: "Feature Flags",
    featureFlagsDescription: "Add or remove feature flags to control access to premium and experimental features for this user.",
    addFeatureFlag: "Add a feature flag...",
    allFlagsAdded: "All flags have been added",
    allFlagsAddedHelp: "All available feature flags have been added.",
    flagSelectHelp: "Select a flag from the dropdown to add it. Click the × to remove a flag.",
    removeFlagAriaLabel: "Remove {flag} flag",

    // Danger zone
    deleteAccount: "Delete Account",
    deleteAccountDescription: "Permanently delete your account and all associated data. This action cannot be undone.",
    demoAccountWarning: "This is a demo account and cannot be deleted. It is used for demonstration purposes. You can still explore all other features of the application.",
    demoCannotDelete: "Demo account cannot be deleted",

    // Change tracking
    changesDetected: "Changes detected:",
    currentLocation: "📍 Current location: {location}",

    // Location field
    locationPlaceholder: "Enter city, zip code, or address",
    locationTooltip: "Enter a city name, zip/postal code, or full address. We'll look up the location to show your city and country on your profile.",
    useCurrentLocation: "Use current location",
    locationNotSet: "Not set",

    // Password validation messages
    oldPasswordRequired: "Old password is required to change password",
    newPasswordRequired: "New password is required",
    passwordRequired: "Password is required",
    confirmNewPasswordPrompt: "Please confirm your new password",
    confirmPasswordPrompt: "Please confirm the password",
    newPasswordsDoNotMatch: "New passwords do not match",
    passwordsDoNotMatch: "Passwords do not match",
    passwordMinLength: "Password must be at least 3 characters",

    // Tooltips for password fields
    setPasswordTooltip: "Set a new password for this user",
    enterNewPasswordPlaceholder: "Enter your new password",
    enterPasswordPlaceholder: "Enter password",

    // Geolocation error messages
    geolocationNotSupported: "Geolocation is not supported by your browser",
    locationAccessDenied: "Location access denied. Please enable location permissions in your browser.",
    locationUnavailable: "Could not determine your location. Please try again or enter manually.",
    locationTimeout: "Location request timed out. Please try again.",
    locationFailed: "Failed to get your location. Please enter it manually.",
    locationLookupFailed: "Could not determine your location. Please enter it manually.",
    locationSet: "Location set to {location}",

    // Photo change tracking
    noPhotos: "No photos",
    photosCount: "{count} photo",
    photosCountPlural: "{count} photos",
    photoIndex: "Photo {index}",
    none: "None",

    // Modal strings
    confirmProfileUpdate: "Confirm Profile Update",
    confirmUpdateReview: "Please review your changes before updating:",
    updateProfile: "Update Profile",
    close: "Close",

    // Error messages
    failedToUpdateProfile: "Failed to update profile. Please try again.",

    // Private profile
    privateProfileTitle: "Private Profile",
    privateProfileDescription: "This user has set their profile to private.",
  },

  // Invite tracking view strings
  inviteTracking: {
    // Page meta
    pageTitle: "Invite Tracking - Biensperience",
    pageDescription: "Track your invite codes and see detailed analytics about who has joined Biensperience using your invitations. Monitor usage statistics and redemption data.",
    pageKeywords: "invite tracking, invite codes, analytics, user referrals, Biensperience",
    ogTitle: "Invite Tracking Dashboard - Biensperience",
    ogDescription: "Monitor your invite code performance and see who has joined the platform through your referrals.",

    // Page header
    heading: "Invite Tracking",
    headerDescription: "Track your invite codes and see who has joined using them",

    // Tab titles
    tabOverview: "Overview",
    tabDetails: "Invite Details",
    tabAnalytics: "Analytics",

    // Status badges
    inactive: "Inactive",
    expired: "Expired",
    expiringSoon: "Expiring Soon",
    fullyUsed: "Fully Used",
    inUse: "In Use",
    available: "Available",

    // Date formatting
    never: "Never",
    any: "Any",

    // Statistics cards
    totalInvites: "Total Invites",
    active: "Active",
    redemptions: "Redemptions",

    // Card headers
    myInviteCodes: "My Invite Codes",

    // Empty states
    noInviteCodesDescription: "Create invite codes to share Biensperience with friends and family.",
    shareToGetStarted: "No one has used this invite code yet. Share it to get started!",

    // Modal tabs
    tabAllInvites: "All Invites",
    tabCreateSingle: "Create Single",
    tabBulkUpload: "Bulk Upload",

    // Invite details section
    inviteCodeDetails: "Invite Code Details",
    code: "Code",
    status: "Status",
    usage: "Usage",
    restrictedTo: "Restricted to",
    created: "Created",
    expires: "Expires",
    preConfiguredResources: "Pre-configured Resources",
    experiencesCount: "Experiences ({count})",
    destinationsCount: "Destinations ({count})",
    redeemedBy: "Redeemed By ({count})",
    noRedemptionsYet: "No Redemptions Yet",
    user: "User",
    email: "Email",
    joined: "Joined",

    // Analytics section
    inviteAnalytics: "Invite Analytics",
    totalInvitesCreated: "Total Invites Created",
    totalRedemptions: "Total Redemptions",
    redemptionRate: "Redemption Rate",
    avgRedemptionsPerInvite: "Avg Redemptions/Invite",
    activeInvites: "Active Invites",
    unusedInvites: "Unused Invites",

    // Activity section
    recentActivity: "Recent Activity",
    last7Days: "Last 7 Days",
    last30Days: "Last 30 Days",
    redemptionsSuffix: "redemptions",
    createdSuffix: "created",

    // Status breakdown
    inviteStatusBreakdown: "Invite Status Breakdown",
    emailRestricted: "Email Restricted",

    // Pre-configured resources analytics
    withExperiences: "With Experiences",
    withDestinations: "With Destinations",

    // Search and filter
    searchPlaceholder: "Search by code or email...",
    filterAll: "All Statuses",
    filterActive: "Active",
    filterAvailable: "Available",
    filterInUse: "In Use",
    filterExpired: "Expired",
    filterExpiringSoon: "Expiring Soon",
    filterFullyUsed: "Fully Used",
    filterInactive: "Inactive",
    clearFilters: "Clear",
    showingResults: "Showing {count} of {total} invites",
    noMatchingInvites: "No matching invites",
    tryDifferentSearch: "Try adjusting your search or filter criteria",

    // Deactivation
    deactivate: "Deactivate",
    deactivateInvite: "Deactivate Invite",
    deactivateConfirmTitle: "Deactivate Invite Code",
    deactivateConfirmMessage: "Are you sure you want to deactivate the invite code \"{code}\"? This action cannot be undone and the code will no longer be usable.",
    deactivating: "Deactivating...",
    inviteDeactivated: "Invite code deactivated successfully",
    failedToDeactivate: "Failed to deactivate invite code",

    // CSV Export
    exportCsv: "Export CSV",
    exportingCsv: "Exporting...",
    csvExported: "Invites exported to CSV",
    noInvitesToExport: "No invites to export",
  },

  // Table header strings
  tableHeaders: {
    code: "Code",
    status: "Status",
    email: "Email",
    used: "Used",
    created: "Created",
    expires: "Expires",
    actions: "Actions",
    user: "User",
    joined: "Joined",
    name: "Name",
    role: "Role",
  },

  // Pagination strings
  pagination: {
    first: "First",
    last: "Last",
    previous: "Previous",
    next: "Next",
    firstPage: "First page",
    lastPage: "Last page",
    previousPage: "Previous page",
    nextPage: "Next page",
    moreOptions: "More options",
    pageNavigation: "Pagination",
    pageOf: "Page {page} of {total}",
    showingResults: "Showing {count} of {total} results",
    pageWithItems: "Page {page} ({items} items)",
  },

  // Dashboard strings
  dashboardView: {
    unavailable: "Dashboard Unavailable",
    unableToLoad: "We were unable to load your dashboard data.",
    listView: "List view",
    calendarView: "Calendar view",
    viewMode: "View mode",
    filterPlans: "Filter plans",
  },

  // MyPlans component strings
  myPlans: {
    // Filter options
    filterAll: "All",
    filterMyPlans: "My Plans",
    filterSharedPlans: "Shared Plans",

    // Empty states
    noSharedPlans: "No shared plans yet",
    noSharedPlansDescription: "When someone shares a plan with you, it will appear here.",
    noPlansInCategory: "No plans in this category",
    noPlansInCategoryDescription: "Try changing the filter to see other plans.",

    // Progress
    percentComplete: "{percent}% complete",
    itemsProgress: "{completed}/{total} items",

    // Completion badge
    done: "Done",

    // Buttons
    viewFullExperience: "View Full Experience",
    loadMore: "Load More ({remaining} remaining)",
    loading: "Loading...",

    // Aria labels
    expandPlanAria: "Expand plan for {name}",
    collapsePlanAria: "Collapse plan for {name}",
    expandCostBreakdownAria: "Expand cost breakdown for {name}",
    collapseCostBreakdownAria: "Collapse cost breakdown for {name}",
  },

  // PlanCalendar component strings
  planCalendar: {
    // Toolbar buttons
    today: "Today",
    month: "Month",
    week: "Week",
    day: "Day",

    // Navigation aria labels
    previousAria: "Previous",
    nextAria: "Next",

    // Tooltip
    shared: "Shared",
  },

  // Experiences by tag view strings
  experiencesByTag: {
    pageTitle: "{tagName} Experiences",
    experiencesTagged: "Experiences tagged {tagName}",
    viewAllExperiences: "View All Experiences",
    loadingExperiences: "Loading {tagName} experiences...",
    noExperiencesFound: "No experiences found with tag \"{tagName}\"",
    tryBrowsingAll: "Try browsing all experiences or search for a different tag.",
    browseAll: "Browse All Experiences",
  },

  // Auth page strings
  authPage: {
    signUpTitle: "Sign Up for Biensperience",
    signUpDescription: "Create your Biensperience account to start planning amazing travel adventures. Share experiences with friends and discover new destinations.",
    loginDescription: "Login to your Biensperience account to access your travel plans, saved destinations, and continue planning your next adventure.",
  },

  // Confirm email page strings
  confirmEmailPage: {
    heading: "Email Confirmation",
    pageTitle: "Confirm Email - Biensperience",
    pageDescription: "Confirm your email address for your Biensperience account",
    pageKeywords: "confirm email, email verification, account activation",
    success: "Email Confirmed!",
    successMessage: "Your email address has been successfully verified.",
    redirectToDashboard: "Redirecting you to your dashboard...",
    redirectToLogin: "Redirecting you to the login page...",
    noToken: "No confirmation token provided. Please check your email link.",
    linkExpired: "The confirmation link may have expired or is invalid.",
    failedDefault: "Failed to confirm email. The link may be invalid or expired.",
    goToLogin: "Go to Login",
  },

  // Reset password page strings
  resetPasswordPage: {
    heading: "Reset Password",
    pageTitle: "Reset Password - Biensperience",
    pageDescription: "Create a new password for your Biensperience account",
    pageKeywords: "reset password, password recovery, account security",
    success: "Password Reset Successful!",
    successMessage: "Your password has been changed. Redirecting you to the login page...",
    instruction: "Please enter your new password below.",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    passwordsDoNotMatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 3 characters long",
    minimumCharacters: "Minimum 3 characters",
    failedDefault: "Failed to reset password. The link may be invalid or expired.",
  },

  // Destinations view strings
  destinationsView: {
    pageTitle: "Destinations",
    loading: "Loading destinations...",
    loadingMore: "Loading more destinations...",
    noDestinationsFound: "No Destinations Found",
    noDestinationsDescription: "No destinations match your current filters. Try adjusting your search criteria or browse all destinations.",
  },

  // SortFilter component strings
  sortFilter: {
    // Labels
    sortBy: "Sort by:",
    show: "Show:",
    destination: "Destination:",
    type: "Type:",

    // Sort options
    alphabetical: "Alphabetical (A-Z)",
    alphabeticalDesc: "Alphabetical (Z-A)",
    destinationAZ: "Destination (A-Z)",
    destinationZA: "Destination (Z-A)",
    createdNewest: "Created (Newest First)",
    createdOldest: "Created (Oldest First)",
    updatedNewest: "Updated (Newest First)",
    updatedOldest: "Updated (Oldest)",

    // Filter options
    allExperiences: "All Experiences",
    allDestinations: "All Destinations",
    plannedExperiencesOnly: "Planned Experiences Only",
    favoriteDestinationsOnly: "Favorite Destinations Only",
    notPlannedYet: "Not Planned Yet",
    notFavoritedYet: "Not Favorited Yet",
    myExperiences: "My Experiences (Created by Me)",

    // Placeholders
    searchDestinations: "Search destinations...",
    searchTypes: "Search types...",

    // Empty states
    noDestinations: "No destinations",
    noTypes: "No types",

    // Aria labels
    sortAriaLabel: "Sort",
    filterExperiences: "Filter experiences",
    filterDestinations: "Filter destinations",
    clearTypeFilter: "Clear type filter",
    sortAndFilterOptions: "Sort and filter options",
  },

  // Dropdown component strings
  dropdown: {
    searchPlaceholder: "Search",
    searchOptionsAria: "Search options",
    noResults: "No results",
  },

  // Autocomplete component strings
  autocomplete: {
    defaultPlaceholder: "Search...",
    defaultEmptyMessage: "No results found",
    searchingMessage: "Searching...",
    clearAriaLabel: "Clear",
    removeItemAriaLabel: "Remove {name}",
  },

  // SearchableSelect component strings
  searchableSelect: {
    defaultPlaceholder: "Select...",
    searchPlaceholder: "Search...",
    searchOptionsAria: "Search options",
    noResultsFound: "No results found",
  },

  // ViewNav component strings
  viewNav: {
    viewNavigation: "View navigation",
  },

  // BottomNavLayout component strings
  bottomNavLayout: {
    mainNavigation: "Main navigation",
  },

  // ExperienceDetailLayout component strings
  experienceDetailLayout: {
    goBack: "Go back",
    share: "Share",
    favorite: "Favorite",
  },

  // SwipeCardLayout component strings
  swipeCardLayout: {
    undo: "Undo",
    pass: "Pass",
    superLike: "Super like",
    like: "Like",
    emptyTitle: "You've seen them all!",
    emptyMessage: "Check back later for more experiences.",
  },

  // MapView component strings
  mapView: {
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    centerMap: "Center map",
    myLocation: "My location",
    hotels: "Hotels",
    restaurants: "Restaurants",
    attractions: "Attractions",
  },

  // GoogleMap component strings
  googleMap: {
    locationNotAvailable: "Location not available",
    getDirections: "Get Directions",
    directionsTo: "Directions to {location}",
    gettingLocation: "Getting your location...",
    openInGoogleMaps: "Open in Google Maps",
    geolocationNotSupported: "Geolocation is not supported by your browser",
    locationAccessDenied: "Location access denied. Please enable location services.",
    locationUnavailable: "Location information unavailable",
    locationTimeout: "Location request timed out",
    unableToGetLocation: "Unable to get your location",
    directionsHint: "You can still get directions by opening Google Maps directly.",
    mapOf: "Map of {location}",
  },

  // AddLocationModal component strings
  addLocationModal: {
    addLocation: "Add Location",
    confirmLocation: "Confirm Location",
    stepAddress: "Address",
    stepConfirm: "Confirm",
    enterAddressPlaceholder: "Enter address, city, or place name...",
    addressHint: "Enter a street address, city name, landmark, or postal code",
    confirmHint: "Is this the correct location? If not, go back and try a more specific address.",
    findLocation: "Find Location",
    searching: "Searching...",
    confirmLocationButton: "Confirm Location",
    saving: "Saving...",
    back: "Back",
    pleaseEnterAddress: "Please enter an address",
    couldNotFindLocation: "Could not find location for this address",
    failedToFindLocation: "Failed to find location. Please try a different address.",
    noLocationToSave: "No location to save",
    failedToSaveLocation: "Failed to save location",
    locationPreview: "Location preview",
  },

  // MapListLayout component strings
  mapListLayout: {
    list: "List",
    map: "Map",
  },

  // Countries view strings
  countriesView: {
    cards: "Cards",
    map: "Map",
    loadingLocations: "Loading locations...",
    noLocationDataTitle: "No destinations or experiences with location data",
    viewOnMapTitle: "View on map",
    showMoreDestinations: "Show More Destinations ({current} of {total})",
    showMoreExperiences: "Show More Experiences ({current} of {total})",
    pageDescription: "Explore destinations and experiences in {country}. Discover travel plans, activities, and adventures.",
    failedToLoadData: "Failed to load country data",
  },

  // PhotoCard component strings
  photoCard: {
    clickToViewFullSize: "Click to view full size photo",
    scrollThumbnailsLeft: "Scroll thumbnails left",
    scrollThumbnailsRight: "Scroll thumbnails right",
    photoBy: "Photo by",
  },

  // PhotoThumbnail component strings
  photoThumbnail: {
    viewPhoto: "View photo {index}",
    defaultPhoto: "Default photo",
  },

  // PhotoModal component strings
  photoModal: {
    counter: "{current} of {total}",
    thumbnailTitle: "Photo {index}",
    thumbnailAlt: "Thumbnail {index}",
    photoBy: "Photo by:",
  },

  // Toast component strings
  toast: {
    close: "Close",
  },

  // Banner component strings
  banner: {
    dismissBanner: "Dismiss banner",
  },

  // Tooltip component strings (merged with tooltip above - line ~827)

  // DragHandle component strings
  dragHandle: {
    dragToReorder: "Drag to reorder",
    dragInstructions: "Drag left to promote, right to nest, up/down to reorder",
  },

  // BiensperienceLogo component strings
  biensperienceLogo: {
    logoAlt: "Biensperience Logo",
  },

  // PhotoUploadModal strings
  photoUploadModal: {
    title: "Manage Photos",
    closeAria: "Close",
    cancel: "Cancel",
    save: "Save Photos",
    saving: "Saving...",
    failedToSave: "Failed to save photos",
    managePhotosAria: "Manage photos",
  },

  // PlanItemDetailsModal strings
  planItemDetailsModal: {
    // Assignee section
    unassigned: "Unassigned",
    unknownUser: "Unknown User",
    noCollaboratorsFound: "No collaborators found",
    searchCollaborators: "Search collaborators...",
    assignedTo: "Assigned To:",
    completed: "Completed",
    markComplete: "Mark Complete",

    // Tabs
    tabDetails: "📋 Details",
    tabNotes: "📝 Notes",
    tabLocation: "📍 Location",
    tabChat: "💬 Chat",
    tabPhotos: "📷 Photos",
    tabDocuments: "📄 Documents",

    // Empty states
    noDetailsAdded: "No Details Added Yet",
    noDetailsDescription: "Add details like booking info, confirmation numbers, or other specifics for this item.",
    noLocationSet: "No Location Set",
    noLocationDescription: "Add a location or address for this item.",
    noNotes: "No Notes Yet",
    noNotesDescription: "Add notes, reminders, or tips for this item.",
    noPhotos: "No Photos Yet",
    noPhotosDescription: "Add photos related to this item.",
    currentPhotos: "Current Photos",
    managePhotos: "Manage Photos",
    noPhotosReadOnly: "No photos have been added to this item.",
    noDocuments: "No Documents Yet",
    noDocumentsDescription: "Upload documents like tickets, receipts, or confirmations.",

    // Actions
    addDetails: "Add Details",
    addLocation: "Add Location",
    addNote: "Add Note",
    addPhoto: "Add Photo",
    addDocument: "Add Document",
    exportPdf: "Export PDF",
    share: "Share",
    change: "Change",

    // Chat
    chatPlaceholder: "Type a message...",
    send: "Send",

    // Details fields
    detailLabel: "Label",
    detailValue: "Value",
    detailLabelPlaceholder: "e.g., Confirmation #",
    detailValuePlaceholder: "e.g., ABC123",

    // Location
    locationPlaceholder: "Enter address or location",

    // Notes
    notePlaceholder: "Write your note here...",
    editNote: "Edit Note",
    deleteNote: "Delete Note",

    // Cost tracking
    actualCost: "Actual Cost",
    estimatedCost: "Estimated Cost",
    addCost: "Track Cost",

    // Schedule
    scheduledDate: "Scheduled Date",
    scheduleItem: "Schedule Item",

    // Aria labels
    closeModal: "Close modal",
    deleteItem: "Delete item",
    editItem: "Edit item",
    toggleComplete: "Toggle completion status",
  },

  // MultiStepPlanModal strings
  multiStepPlanModal: {
    // Step labels
    stepCreateExperience: "Create Experience",
    stepAddPlanItems: "Add Plan Items",
    stepSelectDate: "Select Date",

    // Step titles
    createNewExperience: "Create New Experience",
    addPlanItemsTitle: "Add Plan Items",
    planYourExperience: "Plan Your Experience",

    // Toast messages
    restoredInProgress: "Restored your in-progress experience",
    experienceUpdated: "Experience updated! Now add plan items.",
    experienceCreated: "Experience created! Now add plan items.",
    planCreated: "Your plan has been created!",

    // Form labels
    experienceName: "Experience Name",
    destination: "Destination",
    overview: "Overview",
    experienceTypes: "Experience Types",

    // Buttons
    back: "Back",
    next: "Next",
    updateContinue: "Update & Continue",
    createContinue: "Create & Continue",
    skipToDate: "Skip to Date",
    createPlan: "Create Plan",
    finish: "Finish",

    // Plan items
    addItem: "Add Item",
    noItemsYet: "No plan items yet",
    noItemsDescription: "Add items to help plan this experience step by step.",
    itemPlaceholder: "e.g., Book flight tickets",

    // Date selection
    selectDateTitle: "When do you want to have this experience?",
    dateRequired: "Please select a date",

    // Validation
    nameRequired: "Experience name is required",
    destinationRequired: "Please select a destination",
  },

  // ExperienceWizardModal strings
  experienceWizardModal: {
    // Step labels
    stepBasicInfo: "Basic Info",
    stepDetails: "Details",
    stepPlanItems: "Plan Items",
    stepCollaborators: "Collaborators",
    stepDone: "Done",

    // Step 1: Basic Info
    basicInfoTitle: "Create an Experience",
    experienceTitle: "Experience Title",
    experienceTitlePlaceholder: "e.g., Weekend in Paris",
    overview: "Overview",
    overviewPlaceholder: "Describe what makes this experience special...",
    destination: "Destination",
    destinationPlaceholder: "Search for a destination...",

    // Step 2: Details
    detailsTitle: "Add More Details",
    experienceTypes: "Experience Types",
    experienceTypesPlaceholder: "e.g., Adventure, Food, Culture",
    costEstimate: "Estimated Cost (per person)",
    costEstimatePlaceholder: "e.g., 500",
    planningDays: "Recommended Planning Days",
    planningDaysPlaceholder: "e.g., 14",
    photos: "Photos",

    // Step 3: Plan Items
    planItemsTitle: "Build Your Plan",
    addPlanItem: "Add Plan Item",
    planItemPlaceholder: "e.g., Book accommodation",
    noPlanItemsYet: "No plan items yet",
    noPlanItemsDescription: "Add steps to help others plan this experience.",

    // Step 4: Collaborators
    collaboratorsTitle: "Invite Collaborators",
    searchUsers: "Search Users",
    searchUsersPlaceholder: "Search by name or email...",
    inviteByEmail: "Invite by Email",
    inviteEmailPlaceholder: "Enter email address",
    noCollaboratorsYet: "No collaborators added",
    noCollaboratorsDescription: "Search for users or invite by email to collaborate.",

    // Step 5: Done
    doneTitle: "Experience Created!",
    doneMessage: "Your experience has been created successfully.",
    goToExperience: "Go to Experience",
    createAnother: "Create Another",
    close: "Close",

    // Navigation buttons
    back: "Back",
    next: "Next",
    skip: "Skip",
    finish: "Finish",
    create: "Create",

    // Validation
    titleRequired: "Please enter a title",
    destinationRequired: "Please select a destination",
  },

  // DestinationWizardModal strings
  destinationWizardModal: {
    // Step labels
    stepBasicInfo: "Location",
    stepDetails: "Details",
    stepPhotos: "Photos",
    stepTravelTips: "Tips",
    stepDone: "Done",

    // Modal title
    title: "Create a Destination",

    // Step 1: Basic Info (Location)
    cityTown: "City / Town",
    cityTownPlaceholder: "e.g., Paris, Tokyo, New York",
    stateProvince: "State / Province",
    stateProvincePlaceholder: "e.g., California, Ontario, Île-de-France",
    country: "Country",
    countryPlaceholder: "e.g., United States, Canada, France",

    // Step 2: Details
    overview: "Overview",
    overviewPlaceholder: "Describe what makes this destination special...",

    // Step 3: Photos
    photosDescription: "Add photos to showcase this destination.",

    // Step 4: Travel Tips
    travelTipsDescription: "Share insider tips to help travelers.",

    // Step 5: Done
    doneTitle: "Destination Created!",
    doneMessage: "Your destination has been created successfully.",
    goToDestination: "Go to Destination",
    createAnother: "Create Another",
    close: "Close",

    // Navigation buttons
    back: "Back",
    next: "Next",
    skip: "Skip",
    finish: "Finish",
    create: "Create",

    // Validation
    cityRequired: "Please enter a city or town name",
    countryRequired: "Please enter a country",
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
      successTitle: "✓ Success",
      successText: "Your password has been changed successfully.",
      body: "This email confirms that your {appName} account password was recently changed.",
      securityText: "If you did not make this change, please contact us immediately at support@biensperience.com.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
    emailConfirmation: {
      subject: "{appName} - Confirm Your Email Address",
      heading: "Welcome to {appName}",
      greeting: "Hello {userName},",
      body: "Thank you for signing up for {appName}. To complete your registration and start planning your adventures, please confirm your email address.",
      buttonText: "Confirm Email Address",
      infoTitle: "ℹ️ Important:",
      infoText: "This link will expire in 24 hours for security reasons.",
      altLinkText: "If the button doesn't work, you can copy and paste this link into your browser:",
      ignoreText: "If you didn't create an account with {appName}, you can safely ignore this email.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
    invite: {
      subject: "{inviterName} invited you to join {appName}",
      heading: "You're Invited",
      greeting: "Hello{userName},",
      inviterMessage: "{inviterName} has invited you to join {appName}.",
      customMessage: "Personal message from {inviterName}:",
      body: "Click the button below to create your account and start exploring:",
      buttonText: "Accept Invite & Sign Up",
      inviteCodeLabel: "Your invite code:",
      inviteCodeInstruction: "You'll need this code during signup",
      includesHeading: "This invite includes:",
      experiencesIncluded: "✈️ {count} pre-configured experience{plural} ready to plan",
      destinationsIncluded: "🗺️ {count} favorite destination{plural} to explore",
      altLinkText: "If the button doesn't work, copy this link into your browser:",
      aboutAppTitle: "About {appName}",
      aboutAppText: "{appName} helps you plan and organize your travel experiences around the world. Discover amazing destinations, create detailed travel plans, and share your adventures with others.",
      signature: "Best regards,<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
  },
};

// All available language resources keyed by code
const languages = { en: en };

// Friendly names for language codes (used in UI selects).
// Add additional languages here as they are added to `languages` above.
const languageNames = {
  en: 'English',
};

// Get current language from environment or default to 'en'
const getCurrentLanguage = () => {
  return process.env.REACT_APP_LANG || 'en';
};

// Get language object for current language
const getLang = () => {
  const currentLang = getCurrentLanguage();
  return languages[currentLang] || languages.en;
};

// Return array of available language codes
const getAvailableLanguageCodes = () => Object.keys(languages);

// Return friendly display name for a language code
const getLanguageName = (code) => {
  if (!code) return '';
  return languageNames[code] || (code === 'en' ? 'English' : code.toUpperCase());
};

// Return options suitable for populating select controls: [{ code, name }]
const getLanguageOptions = () => getAvailableLanguageCodes().map(c => ({ code: c, name: getLanguageName(c) }));

// Export both the full language object and the getter function
const lang = {
  get current() {
    return getLang();
  },
  // Export English directly for convenience
  en: languages.en,
  // Utilities
  getAvailableLanguageCodes,
  getLanguageName,
  getLanguageOptions,
};

export { lang, getCurrentLanguage, getLang, getAvailableLanguageCodes, getLanguageName, getLanguageOptions };
