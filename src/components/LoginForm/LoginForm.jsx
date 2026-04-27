import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, InputGroup, Form, Button } from "../design-system";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight, FaInfoCircle, FaCopy, FaCheck } from "react-icons/fa";
import { Fieldset, Box, Flex, Text } from "@chakra-ui/react";
import * as usersService from "../../utilities/users-service";
import { getObfuscatedJson, removeStorageKey } from "../../utilities/secure-storage-lite";
import { lang } from "../../lang.constants";
import SocialLoginButtons from "../SocialLoginButtons/SocialLoginButtons";
import ForgotPasswordModal from "../ForgotPasswordModal/ForgotPasswordModal";
import BiensperienceLogo from "../BiensperienceLogo/BiensperienceLogo";
import Checkbox from "../Checkbox/Checkbox";
import Divider from "../Divider/Divider";

// Check if we're in demo mode
const isDemoMode = process.env.REACT_APP_DEMO_MODE === 'true';

// Demo user credentials
const DEMO_USER = {
    email: 'demo@biensperience.com',
    password: 'demo123'
};

/**
 * Login form component for user authentication.
 * Handles email/password login with error display and navigation.
 *
 * Accessibility features:
 * - Auto-focus on email field for immediate typing
 * - ARIA labels and live regions for screen readers
 * - Keyboard navigation support
 * - High contrast focus indicators
 * - Loading state announcements
 *
 * @param {Object} props - Component props
 * @param {Function} props.setUser - Function to set the authenticated user
 * @returns {JSX.Element} Login form component
 */
export default function LoginForm({ setUser }) {
    const [credentials, setCredentials] = useState({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showForgotPasswordLink, setShowForgotPasswordLink] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    const navigate = useNavigate();
    const passwordTimerRef = useRef(null);
    const emailInputRef = useRef(null);
    const copyTimerRef = useRef(null);

    /**
     * Fill demo credentials into the form
     */
    function fillDemoCredentials() {
        setCredentials({
            email: DEMO_USER.email,
            password: DEMO_USER.password
        });
        setError("");
    }

    /**
     * Copy text to clipboard and show feedback
     */
    async function copyToClipboard(text, field) {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopiedField(field);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
        }
    }

    /**
     * Auto-focus email field on mount for reduced friction
     */
    useEffect(() => {
        // Slight delay to ensure DOM is ready
        const focusTimeout = setTimeout(() => {
            emailInputRef.current?.focus();
        }, 100);
        return () => clearTimeout(focusTimeout);
    }, []);

    /**
     * Handles input field changes and clears any existing errors.
     *
     * @param {Event} e - Input change event
     */
    function handleChange(e) {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
        setError("");

        // Reset timer when user types in password field
        if (e.target.name === 'password') {
            if (passwordTimerRef.current) {
                clearTimeout(passwordTimerRef.current);
            }
            // Start new 3-second timer
            passwordTimerRef.current = setTimeout(() => {
                setShowForgotPasswordLink(true);
            }, 3000);
        }
    }

    /**
     * Handles password field focus - starts timer to show forgot password link
     */
    function handlePasswordFocus() {
        // Clear any existing timer
        if (passwordTimerRef.current) {
            clearTimeout(passwordTimerRef.current);
        }

        // Start 3-second timer to show forgot password link
        passwordTimerRef.current = setTimeout(() => {
            setShowForgotPasswordLink(true);
        }, 3000);
    }

    /**
     * Handles password field blur - clears timer
     */
    function handlePasswordBlur() {
        // Clear timer if user leaves field
        if (passwordTimerRef.current) {
            clearTimeout(passwordTimerRef.current);
        }
    }

    /**
     * Handles form submission for user login.
     * Authenticates user and navigates to home page on success.
     * Data will be automatically fetched by DataProvider via UserContext.
     *
     * @async
     * @param {Event} e - Form submit event
     */
    async function handleSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const user = await usersService.login(credentials);
            setUser(user);

            // Retrieve intended route for post-login redirect (deep linking support)
            const intendedRoute = getObfuscatedJson(sessionStorage, 'bien:intendedRoute', null);
            removeStorageKey(sessionStorage, 'bien:intendedRoute');

            // Navigate to intended route if exists, otherwise go home
            navigate(intendedRoute || "/");
        } catch {
            setError(lang.current.alert.loginFailed);
            setShowForgotPasswordLink(true); // Show link immediately on failed login
            setIsLoading(false);
        }
    }

    // Cleanup timers on component unmount
    useEffect(() => {
        return () => {
            if (passwordTimerRef.current) {
                clearTimeout(passwordTimerRef.current);
            }
            if (copyTimerRef.current) {
                clearTimeout(copyTimerRef.current);
            }
        };
    }, []);

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
                            id="login-title"
                            fontSize={{ base: "2xl", sm: "3xl" }}
                            fontWeight="bold"
                            color="fg"
                            mb={{ base: 1, sm: 2 }}
                        >
                            {lang.current.heading.signInToAccount}
                        </Text>
                    </Box>

                    {/* Demo Mode Info Box */}
                    {isDemoMode && (
                        <Box
                            bg="brand.subtle"
                            border="1px solid"
                            borderColor="brand.solid"
                            borderRadius="lg"
                            p={{ base: 3, sm: 4 }}
                            mb={{ base: 4, sm: 5 }}
                        >
                            <Flex align="center" gap={2} fontWeight="semibold" color="brand.fg" mb={2}>
                                <FaInfoCircle />
                                <Text as="span">Demo Mode</Text>
                            </Flex>
                            <Text fontSize="sm" color="fg.muted" mb={3}>
                                This is a demo environment. Use these credentials to explore:
                            </Text>
                            <Box bg="bg.secondary" borderRadius="md" p={{ base: 2, sm: 3 }} mb={{ base: 2, sm: 3 }}>
                                <Flex align="center" gap={2} py={1}>
                                    <Text as="span" fontSize="sm" fontWeight="medium" color="fg.muted" flexShrink={0} minW={{ base: "55px", sm: "60px" }}>Email:</Text>
                                    <Box
                                        as="code"
                                        flex={1}
                                        minW={0}
                                        fontFamily="mono"
                                        fontSize={{ base: "xs", sm: "sm" }}
                                        color="fg"
                                        bg="bg"
                                        px={{ base: 1, sm: 2 }}
                                        py={1}
                                        borderRadius="sm"
                                        border="1px solid"
                                        borderColor="border.light"
                                        overflow="hidden"
                                        textOverflow="ellipsis"
                                        whiteSpace="nowrap"
                                    >
                                        {DEMO_USER.email}
                                    </Box>
                                    <Box
                                        as="button"
                                        type="button"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        flexShrink={0}
                                        w={{ base: "24px", sm: "28px" }}
                                        h={{ base: "24px", sm: "28px" }}
                                        p={0}
                                        bg="transparent"
                                        border="1px solid"
                                        borderColor="border"
                                        borderRadius="sm"
                                        color="fg.muted"
                                        cursor="pointer"
                                        transition="all 0.15s"
                                        _hover={{ bg: "bg.hover", color: "brand.fg", borderColor: "brand.solid" }}
                                        onClick={() => copyToClipboard(DEMO_USER.email, 'email')}
                                        aria-label="Copy email"
                                    >
                                        {copiedField === 'email' ? <FaCheck style={{ fontSize: '10px' }} /> : <FaCopy style={{ fontSize: '10px' }} />}
                                    </Box>
                                </Flex>
                                <Flex align="center" gap={2} py={1}>
                                    <Text as="span" fontSize="sm" fontWeight="medium" color="fg.muted" flexShrink={0} minW={{ base: "55px", sm: "60px" }}>Password:</Text>
                                    <Box
                                        as="code"
                                        flex={1}
                                        minW={0}
                                        fontFamily="mono"
                                        fontSize={{ base: "xs", sm: "sm" }}
                                        color="fg"
                                        bg="bg"
                                        px={{ base: 1, sm: 2 }}
                                        py={1}
                                        borderRadius="sm"
                                        border="1px solid"
                                        borderColor="border.light"
                                        overflow="hidden"
                                        textOverflow="ellipsis"
                                        whiteSpace="nowrap"
                                    >
                                        {DEMO_USER.password}
                                    </Box>
                                    <Box
                                        as="button"
                                        type="button"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        flexShrink={0}
                                        w={{ base: "24px", sm: "28px" }}
                                        h={{ base: "24px", sm: "28px" }}
                                        p={0}
                                        bg="transparent"
                                        border="1px solid"
                                        borderColor="border"
                                        borderRadius="sm"
                                        color="fg.muted"
                                        cursor="pointer"
                                        transition="all 0.15s"
                                        _hover={{ bg: "bg.hover", color: "brand.fg", borderColor: "brand.solid" }}
                                        onClick={() => copyToClipboard(DEMO_USER.password, 'password')}
                                        aria-label="Copy password"
                                    >
                                        {copiedField === 'password' ? <FaCheck style={{ fontSize: '10px' }} /> : <FaCopy style={{ fontSize: '10px' }} />}
                                    </Box>
                                </Flex>
                            </Box>
                            <Box
                                as="button"
                                type="button"
                                w="100%"
                                py={2}
                                px={4}
                                bg="brand.solid"
                                color="white"
                                border="none"
                                borderRadius="md"
                                fontSize="sm"
                                fontWeight="semibold"
                                cursor="pointer"
                                transition="all 0.15s"
                                _hover={{ transform: "translateY(-1px)", boxShadow: "md" }}
                                _active={{ transform: "translateY(0)" }}
                                onClick={fillDemoCredentials}
                            >
                                Fill Demo Credentials
                            </Box>
                        </Box>
                    )}

                    {/* Form with ARIA labelling */}
                    <Form
                        onSubmit={handleSubmit}
                        autoComplete="on"
                        aria-labelledby="login-title"
                        aria-describedby={error ? "login-error" : undefined}
                    >
                        {/* Email Field */}
                        <Fieldset.Root css={{ marginBottom: "var(--spacing-3)" }}>
                            <Fieldset.Legend
                                css={{
                                    fontSize: "var(--font-sizes-sm)",
                                    fontWeight: "var(--font-weights-semibold)",
                                    color: "var(--colors-fg)",
                                    marginBottom: "var(--spacing-2)",
                                    display: "block",
                                }}
                            >
                                {lang.current.label.email}
                            </Fieldset.Legend>
                            <Fieldset.Content
                                css={{ width: "100%", minWidth: 0 }}
                            >
                                <InputGroup
                                    css={{
                                        border: "2px solid var(--colors-border)",
                                        borderRadius: "var(--radii-xl)",
                                        overflow: "hidden",
                                        minHeight: "48px",
                                        transition: "border-color 0.15s, box-shadow 0.15s",
                                        width: "100%",
                                        minWidth: 0,
                                        display: "flex",
                                        "&:focus-within": {
                                            borderColor: "var(--colors-brand-solid)",
                                            boxShadow: "0 0 0 3px var(--colors-brand-muted)",
                                        },
                                    }}
                                >
                                    <InputGroup.Text
                                        css={{
                                            backgroundColor: "var(--colors-bg-secondary)",
                                            border: "none",
                                            color: "var(--colors-fg-muted)",
                                            padding: "var(--spacing-2) var(--spacing-3)",
                                            minHeight: "48px",
                                            display: "flex",
                                            alignItems: "center",
                                            flexShrink: 0,
                                        }}
                                        aria-hidden="true"
                                    >
                                        <FaEnvelope />
                                    </InputGroup.Text>
                                    <Form.Control
                                        ref={emailInputRef}
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        value={credentials.email}
                                        onChange={handleChange}
                                        placeholder={lang.current.placeholder.email}
                                        required
                                        autoComplete="email"
                                        css={{
                                            backgroundColor: "var(--colors-bg)",
                                            border: "none",
                                            color: "var(--colors-fg)",
                                            fontSize: "var(--font-sizes-sm)",
                                            padding: "var(--spacing-2) var(--spacing-3)",
                                            minHeight: "48px",
                                            transition: "background-color 0.15s",
                                            flex: 1,
                                            minWidth: 0,
                                            "&:focus": { outline: "none", boxShadow: "none" },
                                            "&::placeholder": { color: "var(--colors-fg-muted)" },
                                            "&:disabled": { backgroundColor: "var(--colors-bg-secondary)", cursor: "not-allowed", opacity: 0.7 },
                                        }}
                                        aria-required="true"
                                        aria-invalid={error ? "true" : "false"}
                                        disabled={isLoading}
                                    />
                                </InputGroup>
                            </Fieldset.Content>
                        </Fieldset.Root>

                        {/* Password Field */}
                        <Fieldset.Root css={{ marginBottom: "var(--spacing-3)" }}>
                            <Fieldset.Legend
                                css={{
                                    fontSize: "var(--font-sizes-sm)",
                                    fontWeight: "var(--font-weights-semibold)",
                                    color: "var(--colors-fg)",
                                    marginBottom: "var(--spacing-2)",
                                    display: "block",
                                }}
                            >
                                {lang.current.label.password}
                            </Fieldset.Legend>
                            <Fieldset.Content
                                css={{ width: "100%", minWidth: 0 }}
                            >
                                <InputGroup
                                    css={{
                                        border: "2px solid var(--colors-border)",
                                        borderRadius: "var(--radii-xl)",
                                        overflow: "hidden",
                                        minHeight: "48px",
                                        transition: "border-color 0.15s, box-shadow 0.15s",
                                        width: "100%",
                                        minWidth: 0,
                                        display: "flex",
                                        "&:focus-within": {
                                            borderColor: "var(--colors-brand-solid)",
                                            boxShadow: "0 0 0 3px var(--colors-brand-muted)",
                                        },
                                    }}
                                >
                                    <InputGroup.Text
                                        css={{
                                            backgroundColor: "var(--colors-bg-secondary)",
                                            border: "none",
                                            color: "var(--colors-fg-muted)",
                                            padding: "var(--spacing-2) var(--spacing-3)",
                                            minHeight: "48px",
                                            display: "flex",
                                            alignItems: "center",
                                            flexShrink: 0,
                                        }}
                                        aria-hidden="true"
                                    >
                                        <FaLock />
                                    </InputGroup.Text>
                                    <Form.Control
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={credentials.password}
                                        onChange={handleChange}
                                        onFocus={handlePasswordFocus}
                                        onBlur={handlePasswordBlur}
                                        placeholder={lang.current.placeholder.password}
                                        required
                                        autoComplete="current-password"
                                        css={{
                                            backgroundColor: "var(--colors-bg)",
                                            border: "none",
                                            color: "var(--colors-fg)",
                                            fontSize: "var(--font-sizes-sm)",
                                            padding: "var(--spacing-2) var(--spacing-3)",
                                            minHeight: "48px",
                                            transition: "background-color 0.15s",
                                            flex: 1,
                                            minWidth: 0,
                                            "&:focus": { outline: "none", boxShadow: "none" },
                                            "&::placeholder": { color: "var(--colors-fg-muted)" },
                                            "&:disabled": { backgroundColor: "var(--colors-bg-secondary)", cursor: "not-allowed", opacity: 0.7 },
                                        }}
                                        aria-required="true"
                                        aria-invalid={error ? "true" : "false"}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        variant="link"
                                        onClick={() => setShowPassword(!showPassword)}
                                        css={{
                                            backgroundColor: "var(--colors-bg-secondary)",
                                            border: "none",
                                            color: "var(--colors-fg-muted)",
                                            padding: "var(--spacing-2) var(--spacing-3)",
                                            minHeight: "48px",
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
                                        }}
                                        type="button"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showPassword}
                                        disabled={isLoading}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </Button>
                                </InputGroup>
                            </Fieldset.Content>
                        </Fieldset.Root>

                        {/* Remember Me & Forgot Password */}
                        <Flex
                            direction="column"
                            align="center"
                            gap={{ base: 2, sm: 3 }}
                            mt={{ base: 3, sm: 4 }}
                            mb={{ base: 4, sm: 5 }}
                            w="100%"
                        >
                            <Checkbox
                                id="remember-me"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                label={<Text as="span" fontSize="sm" color="fg">{lang.current.button.rememberMe}</Text>}
                                disabled={isLoading}
                            />
                            {showForgotPasswordLink && (
                                <Box
                                    as="button"
                                    type="button"
                                    color="brand.fg"
                                    fontSize="sm"
                                    fontWeight="medium"
                                    textDecoration="none"
                                    bg="none"
                                    border="none"
                                    p={2}
                                    m={-2}
                                    cursor="pointer"
                                    transition="color 0.15s"
                                    borderRadius="sm"
                                    _hover={{ color: "brand.emphasized", textDecoration: "underline" }}
                                    _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid", outlineOffset: "2px" }}
                                    onClick={() => setShowForgotPassword(true)}
                                    disabled={isLoading}
                                >
                                    {lang.current.button.forgotPassword}
                                </Box>
                            )}
                        </Flex>

                        {/* Error message with ARIA live region */}
                        {error && (
                            <Box
                                id="login-error"
                                bg="danger.muted"
                                color="danger.fg"
                                p={3}
                                borderRadius="md"
                                mb={4}
                                textAlign="center"
                                fontSize="sm"
                                border="1px solid"
                                borderColor="danger.fg"
                                role="alert"
                                aria-live="polite"
                            >
                                {error}
                            </Box>
                        )}

                        {/* Sign In Button with loading state */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            rounded
                            shadow
                            fullWidth
                            disabled={isLoading || !credentials.email || !credentials.password}
                            aria-busy={isLoading}
                            css={{
                                marginBottom: "var(--spacing-4)",
                                "@media (min-width: 576px)": {
                                    marginBottom: "var(--spacing-5)",
                                },
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Box
                                        as="span"
                                        display="inline-block"
                                        w="20px"
                                        h="20px"
                                        border="2px solid rgba(255, 255, 255, 0.3)"
                                        borderRadius="50%"
                                        borderTopColor="white"
                                        animation="spin 0.8s ease-in-out infinite"
                                        aria-hidden="true"
                                    />
                                    <Text as="span">Signing in...</Text>
                                </>
                            ) : (
                                <>
                                    {lang.current.button.signIn} <FaArrowRight aria-hidden="true" />
                                </>
                            )}
                        </Button>

                        <Divider label={lang.current.label.orSignInWith} shadow="md" />

                        {/* Social Login Buttons */}
                        <SocialLoginButtons disabled={isLoading} showDivider={false} />
                    </Form>
                </Card>

                {/* Sign Up Link and Legal Links */}
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
                        <Text as="span">{lang.current.message.dontHaveAccount}</Text>{' '}
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
                            onClick={() => navigate('/signup')}
                            disabled={isLoading}
                        >
                            {lang.current.button.signup}
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

            {/* Screen reader only status announcements */}
            <Box srOnly aria-live="polite" aria-atomic="true">
                {isLoading && "Signing you in, please wait..."}
            </Box>

            <ForgotPasswordModal
                show={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
            />
        </Flex>
    );
}
