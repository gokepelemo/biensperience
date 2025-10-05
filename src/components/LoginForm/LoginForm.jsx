import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as usersService from "../../utilities/users-service";
import { lang } from "../../lang.constants";
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

    function handleChange(e) {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
        setError("");
    }

    function handleRememberMe(e) {
        setRememberMe(e.target.checked);
    }

    function toggleShowPassword() {
        setShowPassword((prev) => !prev);
    }

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
                        type={showPassword ? "text" : "password"}
                        name="password"
                        id="password"
                        value={credentials.password}
                        onChange={handleChange}
                        placeholder={lang.en.placeholder.password}
                        required
                    />
                    <button className="login-btn btn btn-light" type="submit" style={{textTransform: 'none', fontSize: '1rem'}}>
                        {lang.en.button.signInArrow}
                    </button>
                </form>
                <p className="error-message">&nbsp;{error ? error : ""}</p>
                <div className="login-signup center-login">
                    <span style={{fontSize: '1rem'}}>{lang.en.message.dontHaveAccount}</span> <button type="button" className="signup-link link-btn" onClick={() => navigate('/signup')} style={{textTransform: 'none', fontSize: '1rem'}}>{lang.en.button.signup}</button>
                </div>
            </div>
        </div>
    );
}