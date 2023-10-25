import "./AuthPage.css"
import SignUpForm from "../../components/SignUpForm/SignUpForm"
import LoginForm from "../../components/LoginForm/LoginForm"
import { useState } from "react"
export default function AuthPage ({ setUser }) {
    const [signup, setSignup] = useState(false)
    function handleClick(evt) {
        evt.preventDefault();
        setSignup(!signup)
    }
    return (
    <main className="authPage">
    <h1>Quick Notes</h1>
    { signup ? 
    <>
    <SignUpForm setUser={setUser} setSignup={setSignup} />
    <p className="lead">Already have an account? <a href="#" onClick={handleClick}>Login</a>.</p>
    </>
    :
    <>
    <LoginForm setUser={setUser} />
    <p className="lead">Don't have an account? <a href="#" onClick={handleClick}>Signup</a>.</p>
    </>
    }
    </main>
    )
}