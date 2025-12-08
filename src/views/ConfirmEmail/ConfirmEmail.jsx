import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { confirmEmail } from '../../utilities/users-api';
import { useUser } from '../../contexts/UserContext';
import { handleError } from '../../utilities/error-handler';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button } from '../../components/design-system';
import styles from './ConfirmEmail.module.scss';
import { lang } from '../../lang.constants';

export default function ConfirmEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get page strings
  const pageStrings = lang.current.confirmEmailPage;

  // Determine redirect destination based on auth state
  const redirectPath = user ? '/dashboard' : '/login';
  const redirectMessage = user
    ? pageStrings.redirectToDashboard
    : pageStrings.redirectToLogin;

  useEffect(() => {
    document.title = pageStrings.pageTitle;

    const confirmEmailAddress = async () => {
      // Validate token before making request
      if (!token) {
        setError(pageStrings.noToken);
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
          || pageStrings.failedDefault;
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    confirmEmailAddress();
  }, [token, navigate, redirectPath, user, updateUser, pageStrings.pageTitle, pageStrings.noToken, pageStrings.failedDefault]);

  return (
    <>
      <PageOpenGraph
        title={pageStrings.pageTitle}
        description={pageStrings.pageDescription}
        keywords={pageStrings.pageKeywords}
      />

      <div className={styles.confirmEmailWrapper}>
        <div className={`${styles.confirmEmailCard} card`}>
          <div className="card-body">
            <h1 className="text-center mb-4">{pageStrings.heading}</h1>

            {loading ? (
              <Loading variant="centered" size="lg" message={lang.current.alert.confirmingEmail} />
            ) : success ? (
              <Alert type="success">
                <h5 className="alert-heading">{pageStrings.success}</h5>
                <p className="mb-0">
                  {pageStrings.successMessage} {redirectMessage}
                </p>
              </Alert>
            ) : (
              <>
                <Alert type="danger" message={error} className="mb-4" />

                <div className="text-center mt-4">
                  <p style={{ color: 'var(--color-text-muted)' }} className="mb-3">
                    {pageStrings.linkExpired}
                  </p>
                  <Button as={Link} to="/login" variant="primary">
                    {pageStrings.goToLogin}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
