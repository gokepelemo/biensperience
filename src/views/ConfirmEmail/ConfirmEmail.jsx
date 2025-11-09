import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { confirmEmail } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button, Container } from '../../components/design-system';
import './ConfirmEmail.css';

export default function ConfirmEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Confirm Email - Biensperience';

    const confirmEmailAddress = async () => {
      try {
        await confirmEmail(token);
        setSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err) {
        const errorMsg = handleError(err, { context: 'Confirm email' });
        setError(errorMsg || 'Failed to confirm email. The link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    confirmEmailAddress();
  }, [token, navigate]);

  return (
    <>
      <PageOpenGraph
        title="Confirm Email - Biensperience"
        description="Confirm your email address for your Biensperience account"
        keywords="confirm email, email verification, account activation"
      />

      <div className="container">
        <Container className="justify-content-center mt-5">
          <div className="col-md-6 col-lg-5">
            <div className="confirm-email-card card">
              <div className="card-body p-4 p-md-5">
                <h1 className="text-center mb-4">Email Confirmation</h1>

                {loading ? (
                  <Loading variant="centered" size="lg" message="Confirming your email address..." />
                ) : success ? (
                  <Alert type="success">
                    <h5 className="alert-heading">Email Confirmed!</h5>
                    <p className="mb-0">
                      Your email address has been successfully verified. Redirecting you to the login page...
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
