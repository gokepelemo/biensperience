import "./AuthPage.css"
import SignUpForm from "../../components/SignUpForm/SignUpForm"
import LoginForm from "../../components/LoginForm/LoginForm"
import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useUser } from "../../contexts/UserContext"
import PageMeta from "../../components/PageMeta/PageMeta"

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
        <>
            <PageMeta
                title={signup ? "Sign Up for Biensperience" : "Login to Biensperience"}
                description={signup 
                    ? "Create your Biensperience account to start planning amazing travel adventures and sharing experiences with fellow travelers."
                    : "Login to your Biensperience account to access your travel plans, experiences, and connect with other adventurers."
                }
                keywords="travel, login, signup, account, authentication, travel planning"
                noIndex={true}
            />
            <main className="authPage">
                <h1>Biensperience</h1>
                {signup ?
                    <SignUpForm setUser={updateUser} setSignup={setSignup} />
                    :
                    <LoginForm setUser={updateUser} />
                }
            </main>
        </>
    )
}