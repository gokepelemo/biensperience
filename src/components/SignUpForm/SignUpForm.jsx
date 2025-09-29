import React from "react";
import { useNavigate } from "react-router-dom";
import { signUp } from "../../utilities/users-service"

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
  const handleChange = (evt) => {
    setState({
      ...state,
      [evt.target.name]: evt.target.value,
      error: "",
    });
  };
  const handleSubmit = async (evt) => {
    evt.preventDefault();
    try {
      const formData = { ...state };
      delete formData.error;
      delete formData.confirm;
      const user = await signUp(formData);
      props.setUser(user);
    } catch {
      setState({ ...state, error: "Sign Up Failed - Try Again" });
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
        <h1 className="login-title">Create Your Account</h1>
        <form className="login-form" autoComplete="off" onSubmit={handleSubmit}>
          <input
            className="form-control login-input"
            type="text"
            name="name"
            value={state.name}
            onChange={handleChange}
            placeholder="Name (ex. John Doe)"
            required
          />
          <input
            className="form-control login-input"
            type="email"
            name="email"
            value={state.email}
            onChange={handleChange}
            placeholder="Email (ex. john@doe.com)"
            required
          />
          <input
            className="form-control login-input"
            type="password"
            name="password"
            value={state.password}
            onChange={handleChange}
            placeholder="Password"
            required
            autoComplete="new-password"
          />
          <input
            className="form-control login-input"
            type="password"
            name="confirm"
            value={state.confirm}
            onChange={handleChange}
            placeholder="Confirm Password"
            required
            autoComplete="new-password"
          />
          <button type="submit" className="login-btn btn btn-light" disabled={disable} style={{textTransform: 'none', fontSize: '1rem'}}>
            Sign Up
          </button>
        </form>
        <p className="error-message">{state.error ? state.error : ""}</p>
        <div className="login-signup center-login">
          <span style={{fontSize: '1rem'}}>Already have an account?</span> <button type="button" className="signup-link link-btn" style={{textTransform: 'none', fontSize: '1rem'}} onClick={handleLoginClick}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

export default SignUpForm;
