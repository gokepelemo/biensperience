import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Form, InputGroup, Button, Card } from "react-bootstrap";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight } from "react-icons/fa";
import * as usersService from "../../utilities/users-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import ForgotPasswordModal from "../ForgotPasswordModal/ForgotPasswordModal";
import BiensperienceLogo from "../BiensperienceLogo/BiensperienceLogo";
import Checkbox from "../Checkbox/Checkbox";
import Divider from "../Divider/Divider";
import styles from "./LoginForm.module.scss";

/**
 * Login form component for user authentication.
 * Handles email/password login with error display and navigation.
 *
 * Accessibility features:
 * - Auto-focus on email field for immediate typing
 * - ARIA labels and live regions for screen readers
 * - Keyboard navigation support
 * - High contrast focus indicators
 * - Loading state announcements
 *
 * @param {Object} props - Component props
 * @param {Function} props.setUser - Function to set the authenticated user
 * @returns {JSX.Element} Login form component
 */
export default function LoginForm({ setUser }) {
    const [credentials, setCredentials] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForgotPasswordLink, setShowForgotPasswordLink] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const navigate = useNavigate();
    const passwordTimerRef = useRef(null);
    const emailInputRef = useRef(null);

    /**
     * Auto-focus email field on mount for reduced friction
     */
    useEffect(() => {
        // Slight delay to ensure DOM is ready
        const focusTimeout = setTimeout(() => {
            emailInputRef.current?.focus();
        }, 100);
        return () => clearTimeout(focusTimeout);
    }, []);

    /**
     * Handles input field changes and clears any existing errors.
     *
     * @param {Event} e - Input change event
     */
    function handleChange(e) {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
        setError("");

        // Reset timer when user types in password field
        if (e.target.name === 'password') {
            if (passwordTimerRef.current) {
                clearTimeout(passwordTimerRef.current);
            }
            // Start new 3-second timer
            passwordTimerRef.current = setTimeout(() => {
                setShowForgotPasswordLink(true);
            }, 3000);
        }
    }

    /**
     * Handles password field focus - starts timer to show forgot password link
     */
    function handlePasswordFocus() {
        // Clear any existing timer
        if (passwordTimerRef.current) {
            clearTimeout(passwordTimerRef.current);
        }

        // Start 3-second timer to show forgot password link
        passwordTimerRef.current = setTimeout(() => {
            setShowForgotPasswordLink(true);
        }, 3000);
    }

    /**
     * Handles password field blur - clears timer
     */
    function handlePasswordBlur() {
        // Clear timer if user leaves field
        if (passwordTimerRef.current) {
            clearTimeout(passwordTimerRef.current);
        }
    }

    /**
     * Handles form submission for user login.
     * Authenticates user and navigates to home page on success.
     * Data will be automatically fetched by DataProvider via UserContext.
     *
     * @async
     * @param {Event} e - Form submit event
     */
    async function handleSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const user = await usersService.login(credentials);
            setUser(user);
            navigate("/"); // Update address bar to home after login
        } catch {
            setError(lang.en.alert.loginFailed);
            setShowForgotPasswordLink(true); // Show link immediately on failed login
            setIsLoading(false);
        }
    }

    // Cleanup timer on component unmount
    useEffect(() => {
        return () => {
            if (passwordTimerRef.current) {
                clearTimeout(passwordTimerRef.current);
            }
        };
    }, []);

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
                        <h1 className={styles.authTitle} id="login-title">
                            {lang.en.heading.signInToAccount}
                        </h1>
                    </div>

                    {/* Form with ARIA labelling */}
                    <Form
                        onSubmit={handleSubmit}
                        autoComplete="on"
                        aria-labelledby="login-title"
                        aria-describedby={error ? "login-error" : undefined}
                    >
                        {/* Email Field */}
                        <Form.Group className="mb-4">
                            <Form.Label
                                htmlFor="login-email"
                                className={styles.formLabel}
                            >
                                {lang.en.label.email}
                            </Form.Label>
                            <InputGroup className={styles.inputGroup}>
                                <InputGroup.Text
                                    className={styles.inputIcon}
                                    aria-hidden="true"
                                >
                                    <FaEnvelope />
                                </InputGroup.Text>
                                <Form.Control
                                    ref={emailInputRef}
                                    id="login-email"
                                    type="email"
                                    name="email"
                                    value={credentials.email}
                                    onChange={handleChange}
                                    placeholder={lang.en.placeholder.email}
                                    required
                                    autoComplete="email"
                                    className={styles.formInput}
                                    aria-required="true"
                                    aria-invalid={error ? "true" : "false"}
                                    disabled={isLoading}
                                />
                            </InputGroup>
                        </Form.Group>

                        {/* Password Field */}
                        <Form.Group className="mb-4">
                            <Form.Label
                                htmlFor="login-password"
                                className={styles.formLabel}
                            >
                                {lang.en.label.password}
                            </Form.Label>
                            <InputGroup className={styles.inputGroup}>
                                <InputGroup.Text
                                    className={styles.inputIcon}
                                    aria-hidden="true"
                                >
                                    <FaLock />
                                </InputGroup.Text>
                                <Form.Control
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={credentials.password}
                                    onChange={handleChange}
                                    onFocus={handlePasswordFocus}
                                    onBlur={handlePasswordBlur}
                                    placeholder={lang.en.placeholder.password}
                                    required
                                    autoComplete="current-password"
                                    className={styles.formInput}
                                    aria-required="true"
                                    aria-invalid={error ? "true" : "false"}
                                    disabled={isLoading}
                                />
                                <Button
                                    variant="link"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={styles.passwordToggle}
                                    type="button"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    disabled={isLoading}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </Button>
                            </InputGroup>
                        </Form.Group>

                        {/* Remember Me & Forgot Password */}
                        <div className={styles.rememberForgotContainer}>
                            <Checkbox
                                id="remember-me"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                label={<span className={styles.rememberMeLabel}>{lang.en.button.rememberMe}</span>}
                                disabled={isLoading}
                            />
                            {showForgotPasswordLink && (
                                <button
                                    type="button"
                                    className={styles.forgotPasswordLink}
                                    onClick={() => setShowForgotPassword(true)}
                                    disabled={isLoading}
                                >
                                    {lang.en.button.forgotPassword}
                                </button>
                            )}
                        </div>

                        {/* Error message with ARIA live region */}
                        {error && (
                            <div
                                id="login-error"
                                className={styles.errorMessage}
                                role="alert"
                                aria-live="polite"
                            >
                                {error}
                            </div>
                        )}

                        {/* Sign In Button with loading state */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className={styles.submitBtn}
                            disabled={isLoading || !credentials.email || !credentials.password}
                            aria-busy={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className={styles.spinner} aria-hidden="true" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    {lang.en.button.signIn} <FaArrowRight aria-hidden="true" />
                                </>
                            )}
                        </Button>

                        <Divider label={lang.en.label.orSignInWith} shadow="md" />

                        {/* Social Login Buttons */}
                        <SocialLoginButtons disabled={isLoading} showDivider={false} />
                    </Form>
                </Card>

                {/* Sign Up Link */}
                <div className={styles.authFooter}>
                    <span>{lang.en.message.dontHaveAccount}</span>{' '}
                    <button
                        type="button"
                        className={styles.switchLink}
                        onClick={() => navigate('/signup')}
                        disabled={isLoading}
                    >
                        {lang.en.button.signup}
                    </button>
                </div>
            </div>

            {/* Screen reader only status announcements */}
            <div className="visually-hidden" aria-live="polite" aria-atomic="true">
                {isLoading && "Signing you in, please wait..."}
            </div>

            <ForgotPasswordModal
                show={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
            />
        </div>
    );
}
