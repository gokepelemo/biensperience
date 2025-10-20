import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { confirmEmail } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import Alert from '../../components/Alert/Alert';
import PageMeta from '../../components/PageMeta/PageMeta';
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
      <PageMeta
        title="Confirm Email - Biensperience"
        description="Confirm your email address for your Biensperience account"
        keywords="confirm email, email verification, account activation"
      />

      <div className="container">
        <div className="row justify-content-center mt-5">
          <div className="col-md-6 col-lg-5">
            <div className="confirm-email-card card">
              <div className="card-body p-4 p-md-5">
                <h1 className="text-center mb-4">Email Confirmation</h1>

                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary mb-3" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted">Confirming your email address...</p>
                  </div>
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
                      <p className="text-muted mb-3">
                        The confirmation link may have expired or is invalid.
                      </p>
                      <Link to="/login" className="btn btn-primary">
                        Go to Login
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
