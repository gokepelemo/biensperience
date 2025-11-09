import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as usersService from "../../utilities/users-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import ForgotPasswordModal from "../ForgotPasswordModal/ForgotPasswordModal";
import { FormControl } from "../../components/design-system";
import "./LoginForm.css";

/**
 * Login form component for user authentication.
 * Handles email/password login with error display and navigation.
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
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForgotPasswordLink, setShowForgotPasswordLink] = useState(false);
    const navigate = useNavigate();
    const passwordTimerRef = useRef(null);

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
     *
     * @param {Event} e - Focus event
     */
    function handlePasswordFocus(e) {
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
     *
     * @param {Event} e - Blur event
     */
    function handlePasswordBlur(e) {
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
        try {
            const user = await usersService.login(credentials);
            setUser(user);
            navigate("/"); // Update address bar to home after login
        } catch {
            setError(lang.en.alert.loginFailed);
            setShowForgotPasswordLink(true); // Show link immediately on failed login
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
        <div className="login-bg center-login">
            <div className="login-form-wrapper center-login">
                <div className="login-logo"></div>
                <h2 className="login-title">{lang.en.heading.signInToAccount}</h2>
                <form className="login-form" onSubmit={handleSubmit}>
                    <FormControl
                        className="login-input"
                        autoComplete="email"
                        type="email"
                        name="email"
                        id="email"
                        value={credentials.email}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.email}
                        required
                    />
                    <FormControl
                        className="login-input"
                        autoComplete="current-password"
                        type="password"
                        name="password"
                        id="password"
                        value={credentials.password}
                        onChange={handleChange}
                        onFocus={handlePasswordFocus}
                        onBlur={handlePasswordBlur}
                        placeholder={lang.en.placeholder.password}
                        required
                    />
                    <button className="login-btn btn btn-light" type="submit">
                        {lang.en.button.signInArrow}
                    </button>
                </form>

                {/* Forgot Password link appears after failed login or 3 seconds of no typing */}
                {showForgotPasswordLink && (
                    <div className="text-center mb-3" style={{ marginTop: '-0.5rem' }}>
                        <button
                            type="button"
                            className="link-btn text-muted"
                            onClick={() => setShowForgotPassword(true)}
                            style={{ fontSize: '0.9rem', textDecoration: 'underline' }}
                        >
                            {lang.en.button.forgotPassword}
                        </button>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="mb-3">
                        <p className="error-message text-center mb-0">{error}</p>
                    </div>
                )}

                <SocialLoginButtons />

                <div className="login-signup center-login">
                    <span>{lang.en.message.dontHaveAccount}</span> <button type="button" className="signup-link link-btn" onClick={() => navigate('/signup')}>{lang.en.button.signup}</button>
                </div>
            </div>

            <ForgotPasswordModal
                show={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
            />
        </div>
    );
}