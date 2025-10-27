import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signUp } from "../../utilities/users-service";
import { validateInviteCode } from "../../utilities/invite-codes-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import "./SignUpForm.css";

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
  const disable = state.password !== state.confirm;
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
    setState({
      ...state,
      [name]: value,
      error: "",
    });

    // If invite code field changed, validate it
    if (name === "inviteCode" && value.length === 11) {
      validateInvite(value);
    } else if (name === "inviteCode" && value.length < 11) {
      // Reset validation if code is incomplete
      setInviteValidation({
        isValidating: false,
        isValid: false,
        details: null,
        error: null,
      });
    }
  };

  const validateInvite = async (code) => {
    if (!code || code.length !== 11) return;

    setInviteValidation({ isValidating: true, isValid: false, details: null, error: null });

    try {
      const result = await validateInviteCode(code);
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
  return (
    <div className="login-bg center-login">
      <div className="login-form-wrapper center-login">
        <div className="login-logo"></div>
        <h1 className="login-title">{lang.en.heading.createAccount}</h1>
        <form className="login-form" autoComplete="off" onSubmit={handleSubmit}>
          <input
            className="form-control login-input"
            type="text"
            name="name"
            value={state.name}
            onChange={handleChange}
            placeholder={lang.en.placeholder.name}
            required
            autoComplete="name"
          />
          <input
            className="form-control login-input"
            type="email"
            name="email"
            value={state.email}
            onChange={handleChange}
            placeholder={lang.en.placeholder.emailExample}
            required
            autoComplete="email"
          />
          <input
            className="form-control login-input"
            type="password"
            name="password"
            value={state.password}
            onChange={handleChange}
            placeholder={lang.en.placeholder.password}
            required
            autoComplete="new-password"
          />
          <input
            className="form-control login-input"
            type="password"
            name="confirm"
            value={state.confirm}
            onChange={handleChange}
            placeholder={lang.en.placeholder.confirmPassword}
            required
            autoComplete="new-password"
          />
          <div style={{ marginTop: '1rem' }}>
            <input
              className="form-control login-input"
              type="text"
              name="inviteCode"
              value={state.inviteCode}
              onChange={handleChange}
              placeholder={lang.en.invite.inviteCodeOptional}
              autoComplete="off"
              maxLength={11}
              style={{
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontFamily: "'Courier New', monospace"
              }}
            />
            {inviteValidation.isValidating && (
              <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                {lang.en.invite.validatingCode}
              </small>
            )}
            {inviteValidation.isValid && inviteValidation.details && (
              <small className="text-success" style={{ display: 'block', marginTop: '0.25rem' }}>
                ✓ {lang.en.invite.validCode}
                {inviteValidation.details.inviteeName && ` - ${lang.en.invite.invitedBy.replace('{name}', inviteValidation.details.inviteeName)}`}
                {(inviteValidation.details.experienceCount > 0 || inviteValidation.details.destinationCount > 0) && (
                  <span style={{ display: 'block', marginTop: '0.25rem' }}>
                    {inviteValidation.details.experienceCount > 0 && `${inviteValidation.details.experienceCount} experience${inviteValidation.details.experienceCount > 1 ? 's' : ''}`}
                    {inviteValidation.details.experienceCount > 0 && inviteValidation.details.destinationCount > 0 && ', '}
                    {inviteValidation.details.destinationCount > 0 && `${inviteValidation.details.destinationCount} destination${inviteValidation.details.destinationCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </small>
            )}
            {inviteValidation.error && (
              <small className="text-danger" style={{ display: 'block', marginTop: '0.25rem' }}>
                {inviteValidation.error}
              </small>
            )}
            {state.inviteCode && !inviteValidation.isValidating && !inviteValidation.isValid && !inviteValidation.error && (
              <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                {lang.en.invite.inviteCodeHelp}
              </small>
            )}
          </div>
          <button type="submit" className="login-btn btn btn-light" disabled={disable}>
            {lang.en.button.signup}
          </button>
        </form>
        <p className="error-message">{state.error ? state.error : ""}</p>
        
        <SocialLoginButtons buttonText="Sign up with" />
        
        <div className="login-signup center-login">
          <span>{lang.en.message.alreadyHaveAccount}</span> <button type="button" className="signup-link link-btn" onClick={handleLoginClick}>{lang.en.button.signIn}</button>
        </div>
      </div>
    </div>
  );
}

export default SignUpForm;
