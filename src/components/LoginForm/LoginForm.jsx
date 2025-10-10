import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as usersService from "../../utilities/users-service";
import { lang } from "../../lang.constants";
import "./LoginForm.css";

/**
 * Login form component for user authentication.
 * Handles email/password login with error display and navigation.
 *
 * @param {Object} props - Component props
 * @param {Function} props.setUser - Function to set the authenticated user
 * @param {Function} props.updateData - Function to refresh application data after login
 * @returns {JSX.Element} Login form component
 */
export default function LoginForm({ setUser, updateData }) {
    const [credentials, setCredentials] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const navigate = useNavigate();

    /**
     * Handles input field changes and clears any existing errors.
     *
     * @param {Event} e - Input change event
     */
    function handleChange(e) {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
        setError("");
    }

    /**
     * Handles form submission for user login.
     * Authenticates user and navigates to home page on success.
     *
     * @async
     * @param {Event} e - Form submit event
     */
    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const user = await usersService.login(credentials);
            setUser(user);
            updateData();
            navigate("/"); // Update address bar to home after login
        } catch {
            setError(lang.en.alert.loginFailed);
        }
    }

    return (
        <div className="login-bg center-login">
            <div className="login-form-wrapper center-login">
                <div className="login-logo"></div>
                <h2 className="login-title">{lang.en.heading.signInToAccount}</h2>
                <form className="login-form" onSubmit={handleSubmit}>
                    <input
                        className="form-control login-input"
                        autoComplete="off"
                        type="email"
                        name="email"
                        id="email"
                        value={credentials.email}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.email}
                        required
                    />
                    <input
                        className="form-control login-input"
                        autoComplete="current-password"
                        type="password"
                        name="password"
                        id="password"
                        value={credentials.password}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.password}
                        required
                    />
                    <button className="login-btn btn btn-light" type="submit">
                        {lang.en.button.signInArrow}
                    </button>
                </form>
                <p className="error-message">&nbsp;{error ? error : ""}</p>
                <div className="login-signup center-login">
                    <span>{lang.en.message.dontHaveAccount}</span> <button type="button" className="signup-link link-btn" onClick={() => navigate('/signup')}>{lang.en.button.signup}</button>
                </div>
            </div>
        </div>
    );
}