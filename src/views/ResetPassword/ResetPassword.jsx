import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';
import FormField from '../../components/FormField/FormField';
import Alert from '../../components/Alert/Alert';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button, Container } from '../../components/design-system';
import styles from './ResetPassword.module.scss';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Reset Password - Biensperience';
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 3) {
      setError('Password must be at least 3 characters long');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, formData.password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Reset password' });
      setError(errorMsg || 'Failed to reset password. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageOpenGraph
        title="Reset Password - Biensperience"
        description="Create a new password for your Biensperience account"
        keywords="reset password, password recovery, account security"
      />

      <div className={`${styles.resetPasswordWrapper} container`}>
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className={`${styles.resetPasswordCard} card`}>
              <div className="card-body p-4 p-md-5">
                <h1 className="mb-4" style={{ textAlign: 'center' }}>Reset Password</h1>

                {success ? (
                  <Alert type="success">
                    <h5 className="alert-heading">Password Reset Successful!</h5>
                    <p className="mb-0">
                      Your password has been changed. Redirecting you to the login page...
                    </p>
                  </Alert>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {error && (
                      <Alert type="danger" message={error} className="mb-4" />
                    )}

                    <p className="text-muted mb-4">
                      Please enter your new password below.
                    </p>

                    <FormField
                      name="password"
                      label="New Password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={lang.current.placeholder.enterNewPassword}
                      required
                      autoComplete="new-password"
                      autoFocus
                      minLength={3}
                      helpText="Minimum 3 characters"
                    />

                    <FormField
                      name="confirmPassword"
                      label="Confirm Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder={lang.current.placeholder.reEnterNewPassword}
                      required
                      autoComplete="new-password"
                      minLength={3}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-100 mt-4"
                      disabled={loading || !formData.password || !formData.confirmPassword}
                    >
                      {loading ? lang.current.alert.resettingPassword : lang.current.button.resetPassword || 'Reset Password'}
                    </Button>

                    <div className="mt-4" style={{ textAlign: 'center' }}>
                      <Link to="/login" className="text-muted">
                        {lang.current.button.backToLogin}
                      </Link>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
