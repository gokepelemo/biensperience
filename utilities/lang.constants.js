// Backend language constants for email templates and server messages
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
  },
};

// All available languages
const languages = { en };

// Get current language from environment or default to 'en'
const getCurrentLanguage = () => {
  return process.env.LANG || "en";
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
