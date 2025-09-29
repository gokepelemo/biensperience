import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as usersService from "../../utilities/users-service";
import "./LoginForm.css";

export default function LoginForm({ setUser, updateData }) {
    const [credentials, setCredentials] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();

    function handleChange(evt) {
        setCredentials({ ...credentials, [evt.target.name]: evt.target.value });
        setError("");
    }

    function handleRememberMe(evt) {
        setRememberMe(evt.target.checked);
    }

    function toggleShowPassword() {
        setShowPassword((prev) => !prev);
    }

    async function handleSubmit(evt) {
        evt.preventDefault();
        try {
            const user = await usersService.login(credentials);
            setUser(user);
            updateData();
            navigate("/"); // Update address bar to home after login
        } catch {
            setError("Log In Failed - Try Again");
        }
    }

    return (
        <div className="login-bg center-login">
            <div className="login-form-wrapper center-login">
                <div className="login-logo"></div>
                <h2 className="login-title">Sign In To Your Account</h2>
                <form className="login-form" onSubmit={handleSubmit}>
                    <input
                        className="form-control login-input"
                        autoComplete="off"
                        type="email"
                        name="email"
                        id="email"
                        value={credentials.email}
                        onChange={handleChange}
                        placeholder="Email Address"
                        required
                    />
                    <input
                        className="form-control login-input"
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        id="password"
                        value={credentials.password}
                        onChange={handleChange}
                        placeholder="Password"
                        required
                    />
                    <button className="login-btn btn btn-light" type="submit" style={{textTransform: 'none', fontSize: '1rem'}}>
                        Sign In <span className="login-btn-arrow">↪</span>
                    </button>
                </form>
                <p className="error-message">&nbsp;{error ? error : ""}</p>
                <div className="login-signup center-login">
                    <span style={{fontSize: '1rem'}}>Don’t have an account?</span> <button type="button" className="signup-link link-btn" onClick={() => navigate('/signup')} style={{textTransform: 'none', fontSize: '1rem'}}>Sign Up</button>
                </div>
            </div>
        </div>
    );
}