import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Box, Flex, Text } from '@chakra-ui/react';
import { resetPassword } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';
import FormField from '../../components/FormField/FormField';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import { Button, Alert } from '../../components/design-system';

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

      <Flex
        bg="bg"
        minH="100vh"
        w="100%"
        align={{ base: "flex-start", sm: "center" }}
        justify="center"
        px={3}
        pt={{ base: 2, sm: 4 }}
        pb={4}
        boxSizing="border-box"
        overflowX="hidden"
        overflowY="auto"
      >
        <Box
          bg="bg"
          border="1px solid"
          borderColor="border.light"
          borderRadius={{ base: "xl", sm: "2xl" }}
          boxShadow="2xl"
          w="100%"
          maxW={{ base: "100%", sm: "480px", md: "520px" }}
          mt={{ base: 4, sm: 0 }}
          boxSizing="border-box"
        >
          <Box p={{ base: 4, sm: 8 }}>
                <Text
                  as="h1"
                  fontSize={{ base: "2xl", sm: "3xl" }}
                  fontWeight="semibold"
                  color="brand.solid"
                  textAlign="center"
                  mb={4}
                >
                  {pageStrings.heading}
                </Text>

                {success ? (
                  <Alert type="success">
                    <Text as="h5" fontWeight="semibold">{pageStrings.success}</Text>
                    <Text as="p" mb={0}>
                      {pageStrings.successMessage}
                    </Text>
                  </Alert>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {error && (
                      <Box mb={4}>
                        <Alert type="danger" message={error} />
                      </Box>
                    )}

                    <Text color="fg.muted" mb={4}>
                      {pageStrings.instruction}
                    </Text>

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
                      disabled={loading || !formData.password || !formData.confirmPassword}
                      css={{
                        width: "100%",
                        marginTop: "var(--spacing-4)",
                        background: "var(--colors-gradients-primary)",
                        border: "none",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        "&:hover:not(:disabled)": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 6px 12px rgba(102, 126, 234, 0.4)",
                        },
                        "&:disabled": { opacity: 0.6, cursor: "not-allowed" },
                      }}
                    >
                      {loading ? lang.current.alert.resettingPassword : lang.current.button.resetPassword}
                    </Button>

                    <Box mt={4} textAlign="center">
                      <Box
                        as={Link}
                        to="/login"
                        color="fg.muted"
                        textDecoration="none"
                        _hover={{ color: "brand.fg", textDecoration: "underline" }}
                      >
                        {lang.current.button.backToLogin}
                      </Box>
                    </Box>
                  </form>
                )}
          </Box>
        </Box>
      </Flex>
    </>
  );
}
