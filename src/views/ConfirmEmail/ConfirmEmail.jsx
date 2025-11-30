import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { confirmEmail } from '../../utilities/users-api';
import { useUser } from '../../contexts/UserContext';
import { handleError } from '../../utilities/error-handler';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button, Container } from '../../components/design-system';
import styles from './ConfirmEmail.module.scss';
import { lang } from '../../lang.constants';

export default function ConfirmEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Determine redirect destination based on auth state
  const redirectPath = user ? '/dashboard' : '/login';
  const redirectMessage = user
    ? 'Redirecting you to your dashboard...'
    : 'Redirecting you to the login page...';

  useEffect(() => {
    document.title = 'Confirm Email - Biensperience';

    const confirmEmailAddress = async () => {
      // Validate token before making request
      if (!token) {
        setError('No confirmation token provided. Please check your email link.');
        setLoading(false);
        return;
      }

      try {
        await confirmEmail(token);
        setSuccess(true);

        // Update user context if logged in to reflect confirmed email
        if (user && updateUser) {
          updateUser({ ...user, emailConfirmed: true });
        }

        // Redirect after 3 seconds - to dashboard if logged in, login otherwise
        setTimeout(() => {
          navigate(redirectPath);
        }, 3000);
      } catch (err) {
        // Extract error message from response
        const errorMsg = err?.response?.data?.error
          || handleError(err, { context: 'Confirm email', silent: true })
          || 'Failed to confirm email. The link may be invalid or expired.';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    confirmEmailAddress();
  }, [token, navigate, redirectPath, user, updateUser]);

  return (
    <>
      <PageOpenGraph
        title="Confirm Email - Biensperience"
        description="Confirm your email address for your Biensperience account"
        keywords="confirm email, email verification, account activation"
      />

      <div className={`${styles.confirmEmailWrapper} container`}>
        <Container className="justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className={`${styles.confirmEmailCard} card`}>
              <div className="card-body p-4 p-md-5">
                <h1 className="text-center mb-4">Email Confirmation</h1>

                {loading ? (
                  <Loading variant="centered" size="lg" message={lang.current.alert.confirmingEmail} />
                ) : success ? (
                  <Alert type="success">
                    <h5 className="alert-heading">Email Confirmed!</h5>
                    <p className="mb-0">
                      Your email address has been successfully verified. {redirectMessage}
                    </p>
                  </Alert>
                ) : (
                  <>
                    <Alert type="danger" message={error} className="mb-4" />

                    <div className="text-center mt-4">
                      <p style={{ color: 'var(--bs-gray-600)' }} className="mb-3">
                        The confirmation link may have expired or is invalid.
                      </p>
                      <Button as={Link} to="/login" variant="primary">
                        Go to Login
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
