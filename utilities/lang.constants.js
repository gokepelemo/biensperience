/**
 * Backend Language Constants
 *
 * Contains all language strings used for email templates and server messages.
 * Supports internationalization with English as the default language.
 *
 * @module lang.constants
 */

const en = {
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
    invite: {
      subject: "{inviterName} invited you to join {appName}",
      heading: "You're Invited!",
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
    collaboratorInvite: {
      subject: "{inviterName} invited you to collaborate on {appName}",
      heading: "Collaboration Invitation",
      greeting: "Hello{userName},",
      inviterMessage: "{inviterName} has invited you to {appName} to collaborate on creating a travel plan for an experience in {destinationName}.",
      experienceDetails: "Experience: <strong>{experienceName}</strong>",
      destinationDetails: "Location: {destinationName}",
      body: "As a collaborator, you'll be able to help plan this exciting travel experience, add ideas, manage itinerary items, and work together to create the perfect trip.",
      buttonText: "Accept Invite & Start Collaborating",
      inviteCodeLabel: "Your invite code:",
      inviteCodeInstruction: "You'll need this code when you sign up",
      whatYouCanDo: "What you can do as a collaborator:",
      collaboratorPerks: [
        "✅ View and edit the travel plan",
        "✅ Add and manage plan items",
        "✅ Suggest activities and experiences",
        "✅ Chat with other collaborators",
        "✅ Mark items as complete"
      ],
      existingUserNote: "If you already have an account, simply log in to access this collaboration.",
      newUserNote: "Don't have an account yet? No problem! Sign up using the button above and you'll automatically be added as a collaborator.",
      altLinkText: "If the button doesn't work, copy this link into your browser:",
      aboutAppTitle: "About {appName}",
      aboutAppText: "{appName} helps you plan and organize your travel experiences around the world. Collaborate with friends and family to create amazing travel memories together.",
      signature: "Happy Planning!<br>The {appName} Team",
      footer: "This is an automated email. Please do not reply to this message.",
    },
  },
  // AI prompts available to backend services. These can be overridden by
  // passing a `prompts` object into AI-calling functions.
  prompts: {
    autocomplete: `You are a helpful travel assistant that provides autocomplete suggestions for travel-related content.\nProvide concise, relevant completions that match the user's writing style.\nOnly output the completion text, no explanations.`,
    edit_language: `You are an expert editor for travel content.\nImprove the grammar, clarity, and flow of the text while maintaining the original meaning and tone.\nFix any spelling or punctuation errors.\nOnly output the edited text, no explanations or commentary.`,
    improve_description: `You are a skilled travel writer who creates engaging, vivid descriptions of destinations and experiences.\nEnhance the description to be more compelling, informative, and evocative while keeping it authentic and accurate.\nMaintain a friendly, conversational tone suitable for travel planning.\nOnly output the improved description, no explanations.`,
    summarize: `You are a travel content summarizer.\nCreate a concise, informative summary that captures the essential details.\nFocus on key highlights, practical information, and what makes the destination or experience unique.\nOnly output the summary, no explanations.`,
    generate_tips: `You are an experienced traveler sharing practical tips.\nGenerate helpful, actionable travel tips based on the destination or experience.\nInclude local insights, best practices, and things to be aware of.\nFormat tips as a JSON array of strings. Only output valid JSON.`,
    translate: `You are a professional translator specializing in travel content.\nTranslate the text while preserving the meaning, tone, and cultural nuances.\nAdapt any culturally-specific references appropriately.\nOnly output the translated text, no explanations.`
  },
};

/**
 * All available languages
 * @type {Object}
 */
const languages = { en };

/**
 * Get current language from environment or default to 'en'
 * @returns {string} Current language code
 */
const getCurrentLanguage = () => {
  return process.env.LANG || "en";
};

/**
 * Get language object for current language
 * @returns {Object} Language object for current language, defaults to English
 */
const getLang = () => {
  const currentLang = getCurrentLanguage();
  return languages[currentLang] || languages.en;
};

/**
 * Language utilities with backward compatibility
 * @type {Object}
 */
const lang = {
  get current() {
    return getLang();
  },
  // Keep backward compatibility
  en: languages.en,
};

module.exports = { lang, getCurrentLanguage, getLang };
