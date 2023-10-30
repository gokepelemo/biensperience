import { Component } from "react";
import { signUp } from "../../utilities/users-service"

export default class SignUpForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: "",
      email: "",
      password: "",
      confirm: "",
      error: "",
    };
    this.handleChange = (evt) => {
      evt.preventDefault();
      this.setState({
        [evt.target.name]: evt.target.value,
        error: "",
      });
    };
    this.handleSubmit = async (evt) => {
      evt.preventDefault();
      try {
        const formData = {...this.state}
        delete formData.error;
        delete formData.confirm;
        const user = await signUp(formData);
        this.props.setUser(user);
      } catch {
        this.setState({error: 'Sign Up Failed - Try Again'})
      }
    };
  }
  render() {
    const disable = this.state.password !== this.state.confirm;
    return (
      <div>
        <div className="form-container">
          <form autoComplete="off" onSubmit={this.handleSubmit}>
            <input
              className="form-control"
              type="text"
              name="name"
              value={this.state.name}
              onChange={this.handleChange}
              placeholder="Name (ex. John Doe)"
              required
            />
            <input
              className="form-control"
              type="email"
              name="email"
              value={this.state.email}
              onChange={this.handleChange}
              placeholder="Email (ex. john@doe.com)"
              required
            />
            <input
              className="form-control"
              type="password"
              name="password"
              value={this.state.password}
              onChange={this.handleChange}
              placeholder="Password"
              required
            />
            <input
              className="form-control"
              type="password"
              name="confirm"
              value={this.state.confirm}
              onChange={this.handleChange}
              placeholder="Confirm Password"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={disable}>
              Sign up
            </button>
          </form>
        </div>
        <p className="error-message">&nbsp;{this.state.error}</p>
      </div>
    );
  }
}
