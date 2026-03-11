import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, InputGroup, Form, Button } from "../design-system";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaUser, FaArrowRight, FaTicketAlt } from "react-icons/fa";
import { Fieldset, Box, Flex, Text } from "@chakra-ui/react";
import { signUp } from "../../utilities/users-service";
import { validateInviteCode } from "../../utilities/invite-codes-service";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import BiensperienceLogo from "../BiensperienceLogo/BiensperienceLogo";
import Checkbox from "../Checkbox/Checkbox";
import Divider from "../Divider/Divider";
import PrivacyPolicyModal from "../PrivacyPolicyModal/PrivacyPolicyModal";
import TermsOfServiceModal from "../TermsOfServiceModal/TermsOfServiceModal";

/**
 * Sign up form component for user registration.
 * Handles new user creation with password confirmation.
 * Supports invite code via URL parameter (?invite=XXX-XXX-XXX)
 * Data will be automatically fetched by DataProvider via UserContext after signup.
 *
 * @param {Object} props - Component props
 * @param {Function} props.setUser - Function to set the authenticated user
 * @param {Function} [props.setSignup] - Optional function to toggle signup state
 * @returns {JSX.Element} Sign up form component
 */
function SignUpForm(props) {
  const [searchParams] = useSearchParams();
  const [state, setState] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    inviteCode: "",
    error: "",
  });
  const [inviteValidation, setInviteValidation] = React.useState({
    isValidating: false,
    isValid: false,
    details: null,
    error: null,
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Disable submit if passwords don't match or terms not agreed
  const disable = state.password !== state.confirm || !agreedToTerms;
  const navigate = useNavigate();

  // Extract invite code from URL on mount
  React.useEffect(() => {
    const inviteFromUrl = searchParams.get('invite');
    if (inviteFromUrl) {
      const formattedCode = inviteFromUrl.toUpperCase();
      setState(prev => ({ ...prev, inviteCode: formattedCode }));
      // Validate invite code automatically
      validateInvite(formattedCode);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newState = {
      ...state,
      [name]: value,
      error: "",
    };
    setState(newState);

    // If invite code field changed, validate it (with current email)
    if (name === "inviteCode" && value.length === 11) {
      validateInvite(value, newState.email);
    } else if (name === "inviteCode" && value.length < 11) {
      // Reset validation if code is incomplete
      setInviteValidation({
        isValidating: false,
        isValid: false,
        details: null,
        error: null,
      });
    }

    // If email field changed and we have a valid invite code, re-validate
    // This allows showing inviter details once email is entered
    if (name === "email" && state.inviteCode.length === 11) {
      // Debounce email validation to avoid too many API calls
      clearTimeout(window.inviteEmailTimeout);
      window.inviteEmailTimeout = setTimeout(() => {
        validateInvite(state.inviteCode, value);
      }, 500);
    }
  };

  /**
   * Validate invite code with optional email.
   * Security: Inviter details are only returned when email is provided.
   * @param {string} code - Invite code to validate
   * @param {string} email - User's email (required for detailed info)
   */
  const validateInvite = async (code, email = '') => {
    if (!code || code.length !== 11) return;

    setInviteValidation({ isValidating: true, isValid: false, details: null, error: null });

    try {
      // Pass email to get detailed inviter information
      // Without email, API only returns basic validation status
      const result = await validateInviteCode(code, email.trim() || null);
      if (result.valid) {
        setInviteValidation({
          isValidating: false,
          isValid: true,
          details: result,
          error: null,
        });
      } else {
        setInviteValidation({
          isValidating: false,
          isValid: false,
          details: null,
          error: lang.current.invite.invalidCode,
        });
      }
    } catch (error) {
      setInviteValidation({
        isValidating: false,
        isValid: false,
        details: null,
        error: lang.current.invite.invalidCode,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = { ...state };
      delete formData.error;
      delete formData.confirm;
      const user = await signUp(formData);
      props.setUser(user);
    } catch {
      setState({ ...state, error: lang.current.alert.signupFailed });
    }
  };

  const handleLoginClick = () => {
    navigate("/");
    if (props.setSignup) props.setSignup(false);
  };

  // Handle clicking Terms & Conditions link
  const handleTermsClick = (e) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  // Handle clicking Privacy Policy link
  const handlePrivacyClick = (e) => {
    e.preventDefault();
    setShowPrivacyModal(true);
  };

  // Handle back from modal (just closes modal)
  const handleModalBack = () => {
    setShowTermsModal(false);
    setShowPrivacyModal(false);
  };

  /* ── Shared CSS objects for InputGroup children ── */
  const inputGroupCss = {
    border: "2px solid var(--colors-border)",
    borderRadius: "var(--radii-xl)",
    overflow: "hidden",
    minHeight: "44px",
    transition: "border-color 0.15s, box-shadow 0.15s",
    "&:focus-within": {
      borderColor: "var(--colors-brand-solid)",
      boxShadow: "0 0 0 3px var(--colors-brand-muted)",
    },
    "@media (min-width: 576px)": { minHeight: "56px" },
  };

  const inputIconCss = {
    backgroundColor: "var(--colors-bg-secondary)",
    border: "none",
    color: "var(--colors-fg-muted)",
    padding: "var(--spacing-2) var(--spacing-3)",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    "@media (min-width: 576px)": { minHeight: "56px", padding: "var(--spacing-3) var(--spacing-4)" },
  };

  const formInputCss = {
    backgroundColor: "var(--colors-bg)",
    border: "none",
    color: "var(--colors-fg)",
    fontSize: "var(--font-sizes-sm)",
    padding: "var(--spacing-2) var(--spacing-3)",
    minHeight: "44px",
    transition: "background-color 0.15s",
    flex: 1,
    minWidth: 0,
    "&:focus": { outline: "none", boxShadow: "none" },
    "&::placeholder": { color: "var(--colors-fg-muted)" },
    "&:disabled": { backgroundColor: "var(--colors-bg-secondary)", cursor: "not-allowed", opacity: 0.7 },
    "@media (min-width: 576px)": { minHeight: "56px", fontSize: "var(--font-sizes-md)", padding: "var(--spacing-3) var(--spacing-4)" },
  };

  const passwordToggleCss = {
    backgroundColor: "var(--colors-bg-secondary)",
    border: "none",
    color: "var(--colors-fg-muted)",
    padding: "var(--spacing-2) var(--spacing-3)",
    minHeight: "44px",
    textDecoration: "none",
    transition: "color 0.15s",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    width: "auto",
    minWidth: "auto",
    "&:hover:not(:disabled)": { color: "var(--colors-fg)" },
    "&:disabled": { cursor: "not-allowed", opacity: 0.7 },
    "&:focus-visible": { outline: "2px solid var(--colors-brand-solid)", outlineOffset: "-2px" },
    "@media (min-width: 576px)": { minHeight: "56px", padding: "var(--spacing-3) var(--spacing-4)" },
  };

  const fieldsetCss = { marginBottom: "var(--spacing-4)" };

  const legendCss = {
    fontSize: "var(--font-sizes-sm)",
    fontWeight: "var(--font-weights-semibold)",
    color: "var(--colors-fg)",
    marginBottom: "var(--spacing-2)",
    display: "block",
  };

  return (
    <Flex
      bg="bg"
      minH="100vh"
      w="100%"
      align={{ base: "flex-start", sm: "center" }}
      justify="center"
      px={3}
      pt={{ base: 2, sm: 3 }}
      pb={3}
      boxSizing="border-box"
      overflowX="hidden"
      overflowY="auto"
    >
      <Box
        w="100%"
        maxW={{ base: "100%", sm: "480px", md: "520px", xl: "560px" }}
        boxSizing="border-box"
      >
        {/* Logo and App Description */}
        <Flex
          align="center"
          justify="space-between"
          gap={{ base: 2, sm: 4 }}
          mb={{ base: 3, sm: 4 }}
          mt={{ base: 1, sm: 0 }}
          direction={{ base: "column", md: "row" }}
          textAlign={{ base: "center", md: "left" }}
        >
          <BiensperienceLogo type="white" size="2xl" />
          <Box
            flex={1}
            maxW={{ base: "100%", md: "300px" }}
            display={{ base: "none", sm: "block" }}
          >
            <Text
              color="fg.muted"
              fontSize="sm"
              lineHeight="tall"
              m={0}
              textAlign={{ base: "center", md: "right" }}
            >
              Plan amazing travel experiences with friends and share your adventures with fellow travelers worldwide.
            </Text>
          </Box>
        </Flex>

        {/* Main Card */}
        <Card
          bg="bg"
          border="1px solid"
          borderColor="border.light"
          borderRadius={{ base: "xl", sm: "2xl" }}
          p={{ base: "4", sm: "6" }}
          boxShadow="2xl"
          w="100%"
          boxSizing="border-box"
        >
          {/* Header */}
          <Box textAlign="center" mb={{ base: 3, sm: 4 }}>
            <Text
              as="h1"
              fontSize={{ base: "2xl", sm: "3xl" }}
              fontWeight="bold"
              color="fg"
              mb={{ base: 1, sm: 2 }}
            >
              {lang.current.heading.createAccount}
            </Text>
            <Text
              fontSize={{ base: "sm", sm: "md" }}
              color="fg.muted"
              m={0}
              display={{ base: "none", sm: "block" }}
            >
              {lang.current.message.joinCommunity}
            </Text>
          </Box>

          {/* Form */}
          <Form onSubmit={handleSubmit} autoComplete="off">
            {/* Name Field */}
            <Fieldset.Root css={fieldsetCss}>
              <Fieldset.Legend css={legendCss}>{lang.current.label.name}</Fieldset.Legend>
              <Fieldset.Content>
                <InputGroup css={inputGroupCss}>
                  <InputGroup.Text css={inputIconCss}>
                    <FaUser />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    name="name"
                    value={state.name}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.name}
                    required
                    autoComplete="name"
                    css={formInputCss}
                  />
                </InputGroup>
              </Fieldset.Content>
            </Fieldset.Root>

            {/* Email Field */}
            <Fieldset.Root css={fieldsetCss}>
              <Fieldset.Legend css={legendCss}>{lang.current.label.email}</Fieldset.Legend>
              <Fieldset.Content>
                <InputGroup css={inputGroupCss}>
                  <InputGroup.Text css={inputIconCss}>
                    <FaEnvelope />
                  </InputGroup.Text>
                  <Form.Control
                    type="email"
                    name="email"
                    value={state.email}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.email}
                    required
                    autoComplete="email"
                    css={formInputCss}
                  />
                </InputGroup>
              </Fieldset.Content>
            </Fieldset.Root>

            {/* Password Field */}
            <Fieldset.Root css={fieldsetCss}>
              <Fieldset.Legend css={legendCss}>{lang.current.label.password}</Fieldset.Legend>
              <Fieldset.Content>
                <InputGroup css={inputGroupCss}>
                  <InputGroup.Text css={inputIconCss}>
                    <FaLock />
                  </InputGroup.Text>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={state.password}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.password}
                    required
                    autoComplete="new-password"
                    css={formInputCss}
                  />
                  <Button
                    variant="link"
                    onClick={() => setShowPassword(!showPassword)}
                    css={passwordToggleCss}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                </InputGroup>
              </Fieldset.Content>
            </Fieldset.Root>

            {/* Confirm Password Field */}
            <Fieldset.Root css={fieldsetCss}>
              <Fieldset.Legend css={legendCss}>{lang.current.label.confirmPassword}</Fieldset.Legend>
              <Fieldset.Content>
                <InputGroup css={inputGroupCss}>
                  <InputGroup.Text css={inputIconCss}>
                    <FaLock />
                  </InputGroup.Text>
                  <Form.Control
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm"
                    value={state.confirm}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.confirmPassword}
                    required
                    autoComplete="new-password"
                    css={formInputCss}
                  />
                  <Button
                    variant="link"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    css={passwordToggleCss}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                </InputGroup>
              </Fieldset.Content>
            </Fieldset.Root>

            {/* Invite Code Field */}
            <Fieldset.Root css={fieldsetCss}>
              <Fieldset.Legend css={legendCss}>{lang.current.invite.inviteCodeOptional}</Fieldset.Legend>
              <Fieldset.Content>
                <InputGroup css={inputGroupCss}>
                  <InputGroup.Text css={inputIconCss}>
                    <FaTicketAlt />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    name="inviteCode"
                    value={state.inviteCode}
                    onChange={handleChange}
                    placeholder="XXX-XXX-XXX"
                    autoComplete="off"
                    maxLength={11}
                    css={{
                      ...formInputCss,
                      textTransform: "uppercase",
                      letterSpacing: "2px",
                      fontFamily: "var(--fonts-mono)",
                    }}
                  />
                </InputGroup>
                {inviteValidation.isValidating && (
                  <Text as="small" display="block" mt={2} color="fg.muted">
                    {lang.current.invite.validatingCode}
                  </Text>
                )}
                {inviteValidation.isValid && inviteValidation.details && (
                  <Box
                    mt={2}
                    p={3}
                    bg="bg.secondary"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="border.light"
                  >
                    <Text as="small" display="block" color="success.fg">
                      ✓ {lang.current.invite.validCode}
                    </Text>
                    {inviteValidation.details.requiresEmail && (
                      <Text as="small" display="block" mt={1} color="fg.muted">
                        {inviteValidation.details.message || lang.current.invite.enterEmailForDetails}
                      </Text>
                    )}
                    {!inviteValidation.details.requiresEmail && inviteValidation.details.inviterName && (
                      <Text as="small" display="block" mt={1} color="fg" fontWeight="medium">
                        {lang.current.invite.invitedBy.replace('{name}', inviteValidation.details.inviterName)}
                      </Text>
                    )}
                    {!inviteValidation.details.requiresEmail && inviteValidation.details.customMessage && (
                      <Text as="small" display="block" mt={1} color="fg.muted" fontStyle="italic">
                        "{inviteValidation.details.customMessage}"
                      </Text>
                    )}
                    {!inviteValidation.details.requiresEmail && inviteValidation.details.experienceNames?.length > 0 && (
                      <Box mt={2} pl={2}>
                        <Text as="small" color="fg.muted">{lang.current.invite.experiencesIncluded}:</Text>
                        <Box as="ul" m="1 0 0 3" p={0} listStyleType="disc">
                          {inviteValidation.details.experienceNames.map((name, idx) => (
                            <Box as="li" key={idx} color="fg.muted" lineHeight="1.4"><Text as="small">{name}</Text></Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {!inviteValidation.details.requiresEmail && inviteValidation.details.destinationNames?.length > 0 && (
                      <Box mt={2} pl={2}>
                        <Text as="small" color="fg.muted">{lang.current.invite.destinationsIncluded}:</Text>
                        <Box as="ul" m="1 0 0 3" p={0} listStyleType="disc">
                          {inviteValidation.details.destinationNames.map((name, idx) => (
                            <Box as="li" key={idx} color="fg.muted" lineHeight="1.4"><Text as="small">{name}</Text></Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
                {inviteValidation.error && (
                  <Text as="small" display="block" mt={2} color="danger.fg">
                    {inviteValidation.error}
                  </Text>
                )}
                {state.inviteCode && !inviteValidation.isValidating && !inviteValidation.isValid && !inviteValidation.error && (
                  <Text as="small" display="block" mt={2} color="fg.muted">
                    {lang.current.invite.inviteCodeHelp}
                  </Text>
                )}
              </Fieldset.Content>
            </Fieldset.Root>

            {/* Terms & Privacy checkbox */}
            <Flex justify="center" mt={{ base: 3, sm: 4 }} mb={{ base: 4, sm: 5 }}>
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                label={
                  <Text as="span" fontSize="sm" color="fg">
                    {lang.current.message.agreeToTermsPrefix}{' '}
                    <Box
                      as="a"
                      href="#"
                      onClick={handleTermsClick}
                      color="brand.fg"
                      textDecoration="none"
                      fontWeight="medium"
                      transition="color 0.15s"
                      _hover={{ color: "brand.emphasized", textDecoration: "underline" }}
                      _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px" }}
                    >
                      {lang.current.label.termsOfService}
                    </Box>
                    {' '}{lang.current.message.and}{' '}
                    <Box
                      as="a"
                      href="#"
                      onClick={handlePrivacyClick}
                      color="brand.fg"
                      textDecoration="none"
                      fontWeight="medium"
                      transition="color 0.15s"
                      _hover={{ color: "brand.emphasized", textDecoration: "underline" }}
                      _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px" }}
                    >
                      {lang.current.label.privacyPolicy}
                    </Box>
                  </Text>
                }
              />
            </Flex>

            {/* Error message */}
            {state.error && (
              <Box
                bg="danger.muted"
                color="danger.fg"
                p={3}
                borderRadius="md"
                mb={4}
                textAlign="center"
                fontSize="sm"
                border="1px solid"
                borderColor="danger.fg"
              >
                {state.error}
              </Box>
            )}

            {/* Sign Up Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={disable}
              css={{
                width: "100%",
                background: "var(--colors-gradients-primary)",
                border: "none",
                borderRadius: "var(--radii-full)",
                padding: "var(--spacing-3)",
                minHeight: "44px",
                fontSize: "var(--font-sizes-sm)",
                fontWeight: "var(--font-weights-semibold)",
                marginBottom: "var(--spacing-4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--spacing-2)",
                boxShadow: "0 8px 24px rgba(60, 64, 67, 0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
                "&:hover:not(:disabled)": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 12px 28px rgba(60, 64, 67, 0.4)",
                },
                "&:focus-visible": {
                  outline: "2px solid var(--colors-brand-emphasized)",
                  outlineOffset: "2px",
                },
                "&:disabled": {
                  opacity: 0.6,
                  cursor: "not-allowed",
                  transform: "none",
                },
                "@media (min-width: 576px)": {
                  minHeight: "56px",
                  padding: "var(--spacing-4)",
                  fontSize: "var(--font-sizes-md)",
                  marginBottom: "var(--spacing-5)",
                },
              }}
            >
              {lang.current.button.signup} <FaArrowRight />
            </Button>

            <Divider label={lang.current.label.orSignUpWith} shadow="md" />

            {/* Social Login Buttons */}
            <SocialLoginButtons actionType="signup" showDivider={false} />
          </Form>
        </Card>

        {/* Sign In Link and Legal Links */}
        <Flex
          direction="column"
          align="center"
          textAlign="center"
          mt={{ base: 4, sm: 5 }}
          color="fg.muted"
          fontSize={{ base: "sm", sm: "md" }}
          gap={{ base: 2, sm: 3 }}
        >
          <Flex align="center" justify="center" gap={2} flexWrap="wrap">
            <Text as="span">{lang.current.message.alreadyHaveAccount}</Text>{' '}
            <Box
              as="button"
              type="button"
              bg="none"
              border="none"
              color="brand.fg"
              fontWeight="semibold"
              cursor="pointer"
              p={2}
              m={-2}
              textDecoration="none"
              borderRadius="sm"
              transition="color 0.15s"
              _hover={{ textDecoration: "underline", color: "brand.emphasized" }}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px" }}
              onClick={handleLoginClick}
            >
              {lang.current.button.signIn}
            </Box>
          </Flex>
          <Flex align="baseline" justify="center" gap={2} fontSize="sm">
            <Box
              as="a"
              href="#privacy"
              color="fg.muted"
              textDecoration="none"
              transition="color 0.15s"
              _hover={{ color: "brand.fg", textDecoration: "underline" }}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px", borderRadius: "sm" }}
            >
              Privacy Policy
            </Box>
            <Text as="span" color="fg.muted" fontSize="sm" lineHeight={1}>•</Text>
            <Box
              as="a"
              href="#terms"
              color="fg.muted"
              textDecoration="none"
              transition="color 0.15s"
              _hover={{ color: "brand.fg", textDecoration: "underline" }}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px", borderRadius: "sm" }}
            >
              Terms of Service
            </Box>
          </Flex>
        </Flex>
      </Box>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <PrivacyPolicyModal
          show={true}
          onClose={() => setShowPrivacyModal(false)}
          onBack={handleModalBack}
          showBackButton={true}
        />
      )}

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <TermsOfServiceModal
          show={true}
          onClose={() => setShowTermsModal(false)}
          onBack={handleModalBack}
          showBackButton={true}
        />
      )}
    </Flex>
  );
}

export default SignUpForm;
