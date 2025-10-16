import React from "react";
import { useNavigate } from "react-router-dom";
import { signUp } from "../../utilities/users-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import "./SignUpForm.css";

function SignUpForm(props) {
  const [state, setState] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    error: "",
  });
  const disable = state.password !== state.confirm;
  const navigate = useNavigate();
  const handleChange = (e) => {
    setState({
      ...state,
      [e.target.name]: e.target.value,
      error: "",
    });
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
          />
          <input
            className="form-control login-input"
            type="email"
            name="email"
            value={state.email}
            onChange={handleChange}
            placeholder={lang.en.placeholder.emailExample}
            required
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
