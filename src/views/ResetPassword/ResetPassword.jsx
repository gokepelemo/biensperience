import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';
import FormField from '../../components/FormField/FormField';
import Alert from '../../components/Alert/Alert';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button } from '../../components/design-system';
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

  // Get page strings
  const pageStrings = lang.current.resetPasswordPage;

  useEffect(() => {
    document.title = pageStrings.pageTitle;
  }, [pageStrings.pageTitle]);

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
      setError(pageStrings.passwordsDoNotMatch);
      return;
    }

    // Validate password strength
    if (formData.password.length < 3) {
      setError(pageStrings.passwordTooShort);
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
      setError(errorMsg || pageStrings.failedDefault);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageOpenGraph
        title={pageStrings.pageTitle}
        description={pageStrings.pageDescription}
        keywords={pageStrings.pageKeywords}
      />

      <div className={styles.resetPasswordWrapper}>
        <div className={`${styles.resetPasswordCard} card`}>
          <div className="card-body">
                <h1 className="mb-4" style={{ textAlign: 'center' }}>{pageStrings.heading}</h1>

                {success ? (
                  <Alert type="success">
                    <h5 className="alert-heading">{pageStrings.success}</h5>
                    <p className="mb-0">
                      {pageStrings.successMessage}
                    </p>
                  </Alert>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {error && (
                      <Alert type="danger" message={error} className="mb-4" />
                    )}

                    <p className="text-muted mb-4">
                      {pageStrings.instruction}
                    </p>

                    <FormField
                      name="password"
                      label={pageStrings.newPassword}
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={lang.current.placeholder.enterNewPassword}
                      required
                      autoComplete="new-password"
                      autoFocus
                      minLength={3}
                      helpText={pageStrings.minimumCharacters}
                    />

                    <FormField
                      name="confirmPassword"
                      label={pageStrings.confirmPassword}
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
                      {loading ? lang.current.alert.resettingPassword : lang.current.button.resetPassword}
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
    </>
  );
}
