import { useState } from "react";
import * as usersService from "../../utilities/users-service"

export default function LoginForm({ setUser }) {
    const [credentials, setCredentials] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    function handleChange(evt) {
        evt.preventDefault();
        setCredentials(Object.assign({ ...credentials }, {[evt.target.name]: evt.target.value }));
        setError("");
    }
    async function handleSubmit(evt) {
        evt.preventDefault();
        try {
            const user = await usersService.login(credentials);
            setUser(user);
        } catch {
            setError("Log In Failed - Try Again");
        }
    }
    return (
        <div>
            <div className="form-container">
                <form onSubmit={handleSubmit}>
                    <input className="form-control" autoComplete="off" type="text" name="email" value={credentials.email} onChange={handleChange} placeholder="Email (ex. john@doe.com)" required />
                    <input className="form-control" autoComplete="current-password" type="password" name="password" value={credentials.password} onChange={handleChange} placeholder="Password" required />
                    <button className="form-control btn btn-primary" type="submit">Log in</button>
                </form>
            </div>
            <p className="error-message">&nbsp;{error}</p>
        </div>
    )
}