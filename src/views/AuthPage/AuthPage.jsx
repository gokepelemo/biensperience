import "./AuthPage.css"
import SignUpForm from "../../components/SignUpForm/SignUpForm"
import LoginForm from "../../components/LoginForm/LoginForm"
import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useUser } from "../../contexts/UserContext"

export default function AuthPage() {
    const [signup, setSignup] = useState(false)
    const location = useLocation();
    const { updateUser } = useUser();

    useEffect(() => {
        if (location.pathname === "/signup") {
            setSignup(true);
        } else {
            setSignup(false);
        }
    }, [location.pathname]);

    return (
        <main className="authPage">
            <h1>Biensperience</h1>
            {signup ?
                <SignUpForm setUser={updateUser} setSignup={setSignup} />
                :
                <LoginForm setUser={updateUser} />
            }
        </main>
    )
}