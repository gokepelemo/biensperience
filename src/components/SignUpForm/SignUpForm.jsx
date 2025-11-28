import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Form, InputGroup, Button, Card } from "react-bootstrap";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaUser, FaArrowRight, FaTicketAlt } from "react-icons/fa";
import { signUp } from "../../utilities/users-service";
import { validateInviteCode } from "../../utilities/invite-codes-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import BiensperienceLogo from "../BiensperienceLogo/BiensperienceLogo";
import Checkbox from "../Checkbox/Checkbox";
import Divider from "../Divider/Divider";
import PrivacyPolicyModal from "../PrivacyPolicyModal/PrivacyPolicyModal";
import TermsOfServiceModal from "../TermsOfServiceModal/TermsOfServiceModal";
import styles from "./SignUpForm.module.scss";

/**
 * Sign up form component for user registration.
 * Handles new user creation with password confirmation.
 * Supports invite code via URL parameter (?invite=XXX-XXX-XXX)
 * Data will be automatically fetched by DataProvider via UserContext after signup.
 *
 * @param {Object} props - Component props
 * @param {Function} props.setUser - Function to set the authenticated user
 * @param {Function} [props.setSignup] - Optional function to toggle signup state
 * @returns {JSX.Element} Sign up form component
 */
function SignUpForm(props) {
  const [searchParams] = useSearchParams();
  const [state, setState] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    inviteCode: "",
    error: "",
  });
  const [inviteValidation, setInviteValidation] = React.useState({
    isValidating: false,
    isValid: false,
    details: null,
    error: null,
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Disable submit if passwords don't match or terms not agreed
  const disable = state.password !== state.confirm || !agreedToTerms;
  const navigate = useNavigate();

  // Extract invite code from URL on mount
  React.useEffect(() => {
    const inviteFromUrl = searchParams.get('invite');
    if (inviteFromUrl) {
      const formattedCode = inviteFromUrl.toUpperCase();
      setState(prev => ({ ...prev, inviteCode: formattedCode }));
      // Validate invite code automatically
      validateInvite(formattedCode);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newState = {
      ...state,
      [name]: value,
      error: "",
    };
    setState(newState);

    // If invite code field changed, validate it (with current email)
    if (name === "inviteCode" && value.length === 11) {
      validateInvite(value, newState.email);
    } else if (name === "inviteCode" && value.length < 11) {
      // Reset validation if code is incomplete
      setInviteValidation({
        isValidating: false,
        isValid: false,
        details: null,
        error: null,
      });
    }

    // If email field changed and we have a valid invite code, re-validate
    // This allows showing inviter details once email is entered
    if (name === "email" && state.inviteCode.length === 11) {
      // Debounce email validation to avoid too many API calls
      clearTimeout(window.inviteEmailTimeout);
      window.inviteEmailTimeout = setTimeout(() => {
        validateInvite(state.inviteCode, value);
      }, 500);
    }
  };

  /**
   * Validate invite code with optional email.
   * Security: Inviter details are only returned when email is provided.
   * @param {string} code - Invite code to validate
   * @param {string} email - User's email (required for detailed info)
   */
  const validateInvite = async (code, email = '') => {
    if (!code || code.length !== 11) return;

    setInviteValidation({ isValidating: true, isValid: false, details: null, error: null });

    try {
      // Pass email to get detailed inviter information
      // Without email, API only returns basic validation status
      const result = await validateInviteCode(code, email.trim() || null);
      if (result.valid) {
        setInviteValidation({
          isValidating: false,
          isValid: true,
          details: result,
          error: null,
        });
      } else {
        setInviteValidation({
          isValidating: false,
          isValid: false,
          details: null,
          error: lang.en.invite.invalidCode,
        });
      }
    } catch (error) {
      setInviteValidation({
        isValidating: false,
        isValid: false,
        details: null,
        error: lang.en.invite.invalidCode,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = { ...state };
      delete formData.error;
      delete formData.confirm;
      const user = await signUp(formData);
      props.setUser(user);
    } catch {
      setState({ ...state, error: lang.en.alert.signupFailed });
    }
  };

  const handleLoginClick = () => {
    navigate("/");
    if (props.setSignup) props.setSignup(false);
  };

  // Handle clicking Terms & Conditions link
  const handleTermsClick = (e) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  // Handle clicking Privacy Policy link
  const handlePrivacyClick = (e) => {
    e.preventDefault();
    setShowPrivacyModal(true);
  };

  // Handle back from modal (just closes modal)
  const handleModalBack = () => {
    setShowTermsModal(false);
    setShowPrivacyModal(false);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authWrapper}>
        {/* Logo */}
        <div className={styles.logoContainer}>
          <BiensperienceLogo type="white" size="xl" />
        </div>

        {/* Main Card */}
        <Card className={styles.authCard}>
          {/* Header */}
          <div className={styles.authHeader}>
            <h1 className={styles.authTitle}>{lang.en.heading.createAccount}</h1>
            <p className={styles.authSubtitle}>{lang.en.message.joinCommunity}</p>
          </div>

          {/* Form */}
          <Form onSubmit={handleSubmit} autoComplete="off">
            {/* Name Field */}
            <Form.Group className="mb-4">
              <Form.Label className={styles.formLabel}>{lang.en.label.name}</Form.Label>
              <InputGroup className={styles.inputGroup}>
                <InputGroup.Text className={styles.inputIcon}>
                  <FaUser />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  name="name"
                  value={state.name}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.name}
                  required
                  autoComplete="name"
                  className={styles.formInput}
                />
              </InputGroup>
            </Form.Group>

            {/* Email Field */}
            <Form.Group className="mb-4">
              <Form.Label className={styles.formLabel}>{lang.en.label.email}</Form.Label>
              <InputGroup className={styles.inputGroup}>
                <InputGroup.Text className={styles.inputIcon}>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  name="email"
                  value={state.email}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.email}
                  required
                  autoComplete="email"
                  className={styles.formInput}
                />
              </InputGroup>
            </Form.Group>

            {/* Password Field */}
            <Form.Group className="mb-4">
              <Form.Label className={styles.formLabel}>{lang.en.label.password}</Form.Label>
              <InputGroup className={styles.inputGroup}>
                <InputGroup.Text className={styles.inputIcon}>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={state.password}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.password}
                  required
                  autoComplete="new-password"
                  className={styles.formInput}
                />
                <Button
                  variant="link"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Confirm Password Field */}
            <Form.Group className="mb-4">
              <Form.Label className={styles.formLabel}>{lang.en.label.confirmPassword}</Form.Label>
              <InputGroup className={styles.inputGroup}>
                <InputGroup.Text className={styles.inputIcon}>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm"
                  value={state.confirm}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.confirmPassword}
                  required
                  autoComplete="new-password"
                  className={styles.formInput}
                />
                <Button
                  variant="link"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={styles.passwordToggle}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Invite Code Field */}
            <Form.Group className="mb-4">
              <Form.Label className={styles.formLabel}>{lang.en.invite.inviteCodeOptional}</Form.Label>
              <InputGroup className={styles.inputGroup}>
                <InputGroup.Text className={styles.inputIcon}>
                  <FaTicketAlt />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  name="inviteCode"
                  value={state.inviteCode}
                  onChange={handleChange}
                  placeholder="XXX-XXX-XXX"
                  autoComplete="off"
                  maxLength={11}
                  className={`${styles.formInput} ${styles.inviteCodeInput}`}
                />
              </InputGroup>
              {inviteValidation.isValidating && (
                <small className="text-muted" style={{ display: 'block', marginTop: '0.5rem' }}>
                  {lang.en.invite.validatingCode}
                </small>
              )}
              {inviteValidation.isValid && inviteValidation.details && (
                <div className={styles.inviteDetails}>
                  <small className="text-success" style={{ display: 'block' }}>
                    ✓ {lang.en.invite.validCode}
                  </small>
                  {inviteValidation.details.requiresEmail && (
                    <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                      {inviteValidation.details.message || lang.en.invite.enterEmailForDetails}
                    </small>
                  )}
                  {!inviteValidation.details.requiresEmail && inviteValidation.details.inviterName && (
                    <small className={styles.inviterInfo} style={{ display: 'block', marginTop: '0.25rem' }}>
                      {lang.en.invite.invitedBy.replace('{name}', inviteValidation.details.inviterName)}
                    </small>
                  )}
                  {!inviteValidation.details.requiresEmail && inviteValidation.details.customMessage && (
                    <small className={styles.inviteMessage} style={{ display: 'block', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      "{inviteValidation.details.customMessage}"
                    </small>
                  )}
                  {!inviteValidation.details.requiresEmail && inviteValidation.details.experienceNames?.length > 0 && (
                    <div className={styles.inviteResources} style={{ marginTop: '0.5rem' }}>
                      <small className="text-muted">{lang.en.invite.experiencesIncluded}:</small>
                      <ul className={styles.resourceList}>
                        {inviteValidation.details.experienceNames.map((name, idx) => (
                          <li key={idx}><small>{name}</small></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!inviteValidation.details.requiresEmail && inviteValidation.details.destinationNames?.length > 0 && (
                    <div className={styles.inviteResources} style={{ marginTop: '0.5rem' }}>
                      <small className="text-muted">{lang.en.invite.destinationsIncluded}:</small>
                      <ul className={styles.resourceList}>
                        {inviteValidation.details.destinationNames.map((name, idx) => (
                          <li key={idx}><small>{name}</small></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {inviteValidation.error && (
                <small className="text-danger" style={{ display: 'block', marginTop: '0.5rem' }}>
                  {inviteValidation.error}
                </small>
              )}
              {state.inviteCode && !inviteValidation.isValidating && !inviteValidation.isValid && !inviteValidation.error && (
                <small className="text-muted" style={{ display: 'block', marginTop: '0.5rem' }}>
                  {lang.en.invite.inviteCodeHelp}
                </small>
              )}
            </Form.Group>

            {/* Terms & Privacy checkbox */}
            <div className={styles.termsContainer}>
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                label={
                  <span className={styles.termsLabel}>
                    {lang.en.message.agreeToTermsPrefix}{' '}
                    <a href="#" onClick={handleTermsClick} className={styles.termsLink}>
                      {lang.en.label.termsOfService}
                    </a>
                    {' '}{lang.en.message.and}{' '}
                    <a href="#" onClick={handlePrivacyClick} className={styles.termsLink}>
                      {lang.en.label.privacyPolicy}
                    </a>
                  </span>
                }
              />
            </div>

            {/* Error message */}
            {state.error && (
              <div className={styles.errorMessage}>
                {state.error}
              </div>
            )}

            {/* Sign Up Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={disable}
              className={styles.submitBtn}
            >
              {lang.en.button.signup} <FaArrowRight />
            </Button>

            <Divider label={lang.en.label.orSignUpWith} shadow="md" />

            {/* Social Login Buttons */}
            <SocialLoginButtons actionType="signup" showDivider={false} />
          </Form>
        </Card>

        {/* Sign In Link */}
        <div className={styles.authFooter}>
          <span>{lang.en.message.alreadyHaveAccount}</span>{' '}
          <button type="button" className={styles.switchLink} onClick={handleLoginClick}>
            {lang.en.button.signIn}
          </button>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        show={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onBack={handleModalBack}
        showBackButton={true}
      />

      {/* Terms of Service Modal */}
      <TermsOfServiceModal
        show={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onBack={handleModalBack}
        showBackButton={true}
      />
    </div>
  );
}

export default SignUpForm;
