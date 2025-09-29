import "./AuthPage.css"
import SignUpForm from "../../components/SignUpForm/SignUpForm"
import LoginForm from "../../components/LoginForm/LoginForm"
import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
export default function AuthPage ({ setUser, updateData }) {
    const [signup, setSignup] = useState(false)
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (location.pathname === "/signup") {
            setSignup(true);
        } else {
            setSignup(false);
        }
    }, [location.pathname]);
    function handleClick(evt) {
        evt.preventDefault();
        if (signup) {
            navigate("/");
        } else {
            navigate("/signup");
        }
    }
    return (
    <main className="authPage">
    <h1>Biensperience</h1>
        { signup ? 
            <SignUpForm setUser={setUser} setSignup={setSignup} updateData={updateData} />
            :
            <LoginForm setUser={setUser} updateData={updateData} />
        }
    </main>
    )
}