import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup } from 'react-bootstrap';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaGoogle, FaFacebook, FaTwitter, FaUser, FaArrowRight, FaCheckCircle } from 'react-icons/fa';
import BiensperienceLogo from '../components/BiensperienceLogo/BiensperienceLogo';
import Checkbox from '../components/Checkbox/Checkbox';
import Divider from '../components/Divider/Divider';
import DesignNotes from './helpers/DesignNotes';

export default {
  title: 'Design System/Authentication Patterns',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Authentication UI patterns including login, signup, password reset, and OAuth flows. All patterns use design tokens for consistent light/dark mode support.',
      },
    },
  },
};

// Login Page (Based on Screenshot)
export const LoginPage = {
  parameters: {
    docs: {
      description: {
        story: 'Tokens: maxWidth 520px · control height 56px · input radius var(--radius-xl) · primary button radius var(--radius-full) with var(--gradient-primary) · spacing: card padding var(--space-8), gaps var(--space-6).',
      },
    },
  },
  render: () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-secondary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}>
          <BiensperienceLogo type="white" size="xl" />
        </div>

        {/* Main Card */}
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-2xl)',
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Welcome Back.
            </h1>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}>
              Let's sign in to your account and get started.
            </p>
          </div>

          {/* Form */}
          <Form>
            {/* Email Field */}
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
                display: 'block',
              }}>
                Email Address
              </Form.Label>
              <InputGroup style={{
                border: '2px solid var(--color-border-medium)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                minHeight: '56px',
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  padding: 'var(--space-3) var(--space-4)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  placeholder="elementary221b@gmail.com"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3) var(--space-4)',
                    minHeight: '56px',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                />
              </InputGroup>
            </Form.Group>

            {/* Password Field */}
            <Form.Group className="mb-3">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
                display: 'block',
              }}>
                Password
              </Form.Label>
              <InputGroup style={{
                border: '2px solid var(--color-border-medium)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                minHeight: '56px',
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  padding: 'var(--space-3) var(--space-4)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3) var(--space-4)',
                    minHeight: '56px',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                />
                <Button
                  variant="link"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    padding: 'var(--space-3) var(--space-4)',
                    minHeight: '56px',
                    textDecoration: 'none',
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Remember Me & Forgot Password */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-6)',
            }}>
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                label={<span style={{ fontSize: 'var(--font-size-sm)' }}>Remember For 30 Days</span>}
              />
              <a
                href="#"
                style={{
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  textDecoration: 'none',
                }}
              >
                Forgot Password
              </a>
            </div>

            {/* Sign In Button */}
            <Button
              variant="primary"
              size="lg"
              style={{
                width: '100%',
                background: 'var(--gradient-primary)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4)',
                minHeight: '56px',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                boxShadow: '0 8px 24px rgba(60, 64, 67, 0.35)'
              }}
            >
              Sign In <FaArrowRight />
            </Button>

            <Divider label="Or continue with" shadow="md" />

            {/* Social Login Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}>
              <Button
                variant="outline-secondary"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-3)',
                  minHeight: '52px',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.12)'
                }}
              >
                <FaFacebook style={{ color: '#1877F2', fontSize: 'var(--font-size-lg)' }} />
                Sign In With Facebook
              </Button>

              <Button
                variant="outline-secondary"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-3)',
                  minHeight: '52px',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <FaGoogle style={{ color: '#DB4437', fontSize: 'var(--font-size-lg)' }} />
                Sign In With Google
              </Button>

              <Button
                variant="outline-secondary"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  padding: 'var(--space-3)',
                  minHeight: '52px',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <FaTwitter style={{ color: '#1DA1F2', fontSize: 'var(--font-size-lg)' }} />
                Sign In With X
              </Button>
            </div>
          </Form>
        </Card>

        <DesignNotes
          title="Login: token overview"
          items={[
            { label: 'Container', value: 'maxWidth 520px' },
            { label: 'Control height', value: '56px (inputs & button)' },
            { label: 'Radius', value: 'Inputs var(--radius-xl), Button var(--radius-full)' },
            { label: 'Primary', value: 'var(--gradient-primary)' },
            { label: 'Card padding', value: 'var(--space-8)' },
            { label: 'Checkbox sizes', value: 'sm 20px · md 24px · lg 28px' },
          ]}
        />

        {/* Sign Up Link */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
        }}>
          <span style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
          }}>
            Don't have an account?{' '}
          </span>
          <a
            href="#"
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              textDecoration: 'none',
            }}
          >
            Sign Up
          </a>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-4)',
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}>
            © Biensperience
          </p>
        </div>
      </div>
    </div>
    );
  },
};

// Sign Up Page
export const SignUpPage = {
  parameters: {
    docs: {
      description: {
        story: 'Tokens: maxWidth 520px · control height 56px · radius-xl inputs with icon segments · full button radius · social circles 60px.',
      },
    },
  },
  render: () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-secondary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}>
          <BiensperienceLogo type="white" size="xl" />
        </div>

        {/* Main Card */}
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-2xl)',
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Create Account
            </h1>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}>
              Join thousands of travelers sharing amazing experiences
            </p>
          </div>

          {/* Form */}
          <Form>
            {/* Name Field */}
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Full Name
              </Form.Label>
              <InputGroup style={{
                borderRadius: 'var(--radius-xl)'
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRight: 'none',
                  color: 'var(--color-text-muted)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaUser />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="John Doe"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3)',
                    minHeight: '56px',
                  }}
                />
              </InputGroup>
            </Form.Group>

            {/* Email Field */}
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Email Address
              </Form.Label>
              <InputGroup style={{
                borderRadius: 'var(--radius-xl)'
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRight: 'none',
                  color: 'var(--color-text-muted)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  placeholder="john.doe@example.com"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3)',
                    minHeight: '56px',
                  }}
                />
              </InputGroup>
            </Form.Group>

            {/* Password Field */}
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Password
              </Form.Label>
              <InputGroup style={{
                borderRadius: 'var(--radius-xl)'
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRight: 'none',
                  color: 'var(--color-text-muted)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3)',
                    minHeight: '56px',
                  }}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    color: 'var(--color-text-muted)',
                    minHeight: '56px',
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Confirm Password Field */}
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Confirm Password
              </Form.Label>
              <InputGroup style={{
                borderRadius: 'var(--radius-xl)'
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRight: 'none',
                  color: 'var(--color-text-muted)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaLock />
                </InputGroup.Text>
                <Form.Control
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3)',
                    minHeight: '56px',
                  }}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    color: 'var(--color-text-muted)',
                    minHeight: '56px',
                  }}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </Button>
              </InputGroup>
            </Form.Group>

            {/* Terms & Conditions */}
            <Form.Group className="mb-6">
              <Checkbox
                id="terms"
                label={
                  <span style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                    I agree to the{' '}
                    <a href="#" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                      Terms & Conditions
                    </a>
                    {' '}and{' '}
                    <a href="#" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                      Privacy Policy
                    </a>
                  </span>
                }
              />
            </Form.Group>

            {/* Sign Up Button */}
            <Button
              variant="primary"
              size="lg"
              style={{
                width: '100%',
                background: 'var(--gradient-primary)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4)',
                minHeight: '56px',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              Create Account <FaArrowRight />
            </Button>

            <Divider label="Or sign up with" shadow="md" />

            {/* Social Login Buttons */}
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
            }}>
              <Button
                variant="outline-secondary"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FaGoogle style={{ color: '#DB4437', fontSize: 'var(--font-size-xl)' }} />
              </Button>

              <Button
                variant="outline-secondary"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FaFacebook style={{ color: '#1877F2', fontSize: 'var(--font-size-xl)' }} />
              </Button>

              <Button
                variant="outline-secondary"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FaTwitter style={{ color: '#1DA1F2', fontSize: 'var(--font-size-xl)' }} />
              </Button>
            </div>
          </Form>
        </Card>

        <DesignNotes
          title="Sign Up: token overview"
          items={[
            { label: 'Container', value: 'maxWidth 520px' },
            { label: 'Control height', value: '56px (inputs & button)' },
            { label: 'Radius', value: 'Inputs var(--radius-xl), Button var(--radius-full)' },
            { label: 'Social icon buttons', value: '60x60px radius-full' },
            { label: 'Checkbox sizes', value: 'sm 20px · md 24px · lg 28px' },
          ]}
        />

        {/* Sign In Link */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
        }}>
          <span style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
          }}>
            Already have an account?{' '}
          </span>
          <a
            href="#"
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              textDecoration: 'none',
            }}
          >
            Sign In
          </a>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-4)',
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}>
            © Biensperience
          </p>
        </div>
      </div>
    </div>
    );
  },
};

// Forgot Password Page
export const ForgotPasswordPage = {
  parameters: {
    docs: {
      description: {
        story: 'Tokens: maxWidth 520px · 56px controls · radius-xl inputs · primary gradient button.',
      },
    },
  },
  render: () => {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-secondary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}>
          <BiensperienceLogo type="white" size="xl" />
        </div>

        {/* Main Card */}
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-2xl)',
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Forgot Password?
            </h1>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
            }}>
              No worries! Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Form */}
          <Form>
            {/* Email Field */}
            <Form.Group className="mb-6">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Email Address
              </Form.Label>
              <InputGroup style={{
                borderRadius: 'var(--radius-xl)'
              }}>
                <InputGroup.Text style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-medium)',
                  borderRight: 'none',
                  color: 'var(--color-text-muted)',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <FaEnvelope />
                </InputGroup.Text>
                <Form.Control
                  type="email"
                  placeholder="elementary221b@gmail.com"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-medium)',
                    borderLeft: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    padding: 'var(--space-3)',
                    minHeight: '56px',
                  }}
                />
              </InputGroup>
            </Form.Group>

            {/* Send Reset Link Button */}
            <Button
              variant="primary"
              size="lg"
              style={{
                width: '100%',
                background: 'var(--gradient-primary)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-4)',
                minHeight: '56px',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Send Reset Link
            </Button>

            {/* Back to Sign In */}
            <div style={{ textAlign: 'center' }}>
              <a
                href="#"
                style={{
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                ← Back to Sign In
              </a>
            </div>
          </Form>
        </Card>

        <DesignNotes
          title="Forgot Password: token overview"
          items={[
            { label: 'Container', value: 'maxWidth 520px' },
            { label: 'Control height', value: '56px' },
            { label: 'Radius', value: 'var(--radius-xl) inputs' },
            { label: 'Checkbox sizes', value: 'sm 20px · md 24px · lg 28px' },
          ]}
        />

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}>
            © Biensperience
          </p>
        </div>
      </div>
    </div>
    );
  },
};

// Email Verification Sent
export const EmailVerificationSent = {
  render: () => {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-secondary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Main Card */}
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-12)',
          boxShadow: 'var(--shadow-2xl)',
          textAlign: 'center',
        }}>
          {/* Success Icon */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-success-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-6)',
          }}>
            <FaCheckCircle style={{
              fontSize: 'var(--font-size-4xl)',
              color: 'var(--color-success)',
            }} />
          </div>

          {/* Header */}
          <h1 style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            Check Your Email
          </h1>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height-relaxed)',
            marginBottom: 'var(--space-8)',
          }}>
            We've sent a verification link to<br />
            <strong style={{ color: 'var(--color-text-primary)' }}>elementary221b@gmail.com</strong>
          </p>

          {/* Open Email Button */}
          <Button
            variant="primary"
            size="lg"
            style={{
              width: '100%',
              background: 'var(--gradient-primary)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: 'var(--space-4)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--space-4)',
            }}
          >
            Open Email App
          </Button>

          {/* Resend Link */}
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-2)',
          }}>
            Didn't receive the email?{' '}
            <a
              href="#"
              style={{
                color: 'var(--color-primary)',
                fontWeight: 'var(--font-weight-semibold)',
                textDecoration: 'none',
              }}
            >
              Resend
            </a>
          </p>

          {/* Back to Sign In */}
          <a
            href="#"
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            ← Back to Sign In
          </a>
        </Card>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}>
            © Biensperience
          </p>
        </div>
      </div>
    </div>
    );
  },
};

// Two-Factor Authentication
export const TwoFactorAuth = {
  render: () => {
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const handleCodeChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-secondary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}>
          <BiensperienceLogo type="white" size="xl" />
        </div>

        {/* Main Card */}
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-2xl)',
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            <h1 style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Two-Factor Authentication
            </h1>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
            }}>
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {/* Code Input */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            {code.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                style={{
                  width: '60px',
                  height: '60px',
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  transition: 'var(--transition-normal)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-medium)';
                }}
              />
            ))}
          </div>

          {/* Verify Button */}
          <Button
            variant="primary"
            size="lg"
            style={{
              width: '100%',
              background: 'var(--gradient-primary)',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: 'var(--space-4)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--space-4)',
            }}
          >
            Verify Code
          </Button>

          {/* Resend Code */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}>
              Didn't receive a code?{' '}
              <a
                href="#"
                style={{
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--font-weight-semibold)',
                  textDecoration: 'none',
                }}
              >
                Resend
              </a>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}>
            © Biensperience
          </p>
        </div>
      </div>
    </div>
    );
  },
};

// Login Split Layout (Travel-themed)
export const LoginSplitLayout = {
  parameters: {
    docs: {
      description: {
        story: 'Split layout variant with a travel-themed sidebar. The form column reuses the same tokenized inputs/buttons to ensure consistency.',
      },
    },
  },
  render: () => {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--color-bg-secondary)',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
      }}>
        {/* Travel themed panel */}
        <div style={{
          padding: 'clamp(2rem, 5vw, 4rem)',
          background: 'linear-gradient(135deg, #6f42c1 0%, #4f46e5 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)' }}>Plan your next adventure</h1>
            <p style={{ opacity: 0.9, marginBottom: 'var(--space-6)' }}>
              From Kyoto temples to Barcelona sunsets—organize itineraries, collaborate with friends, and track your plans.
            </p>
            <ul style={{ lineHeight: 1.9, margin: 0, padding: 0, listStyle: 'none' }}>
              <li>• Smart checklists for every day</li>
              <li>• Photo-rich inspiration and destinations</li>
              <li>• Real-time collaboration with your crew</li>
            </ul>
          </div>
        </div>
        {/* Form column */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <Card style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-8)',
              boxShadow: 'var(--shadow-2xl)'
            }}>
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Welcome Back.</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>Sign in to keep exploring.</p>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Email Address</Form.Label>
                  <InputGroup style={{ border: '2px solid var(--color-border-medium)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', minHeight: 56 }}>
                    <InputGroup.Text style={{ background: 'var(--color-bg-secondary)', border: 'none', minHeight: 56, display: 'flex', alignItems: 'center' }}><FaEnvelope /></InputGroup.Text>
                    <Form.Control type="email" placeholder="traveler@example.com" style={{ background: 'var(--color-bg-primary)', border: 'none', minHeight: 56 }} />
                  </InputGroup>
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Password</Form.Label>
                  <InputGroup style={{ border: '2px solid var(--color-border-medium)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', minHeight: 56 }}>
                    <InputGroup.Text style={{ background: 'var(--color-bg-secondary)', border: 'none', minHeight: 56, display: 'flex', alignItems: 'center' }}><FaLock /></InputGroup.Text>
                    <Form.Control type={showPassword ? 'text' : 'password'} placeholder="••••••••••" style={{ background: 'var(--color-bg-primary)', border: 'none', minHeight: 56 }} />
                    <Button variant="link" style={{ background: 'var(--color-bg-secondary)', border: 'none', minHeight: 56 }} onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                  </InputGroup>
                </Form.Group>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <Checkbox id="remember-split" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} label={<span style={{ fontSize: 'var(--font-size-sm)' }}>Remember For 30 Days</span>} />
                  <a href="#" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>Forgot Password</a>
                </div>
                <Button style={{ width: '100%', background: 'var(--gradient-primary)', border: 'none', borderRadius: 'var(--radius-full)', minHeight: 56 }}>Sign In <FaArrowRight className="ms-2" /></Button>
                <Divider label="Or continue with" shadow="md" />
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column' }}>
                  <Button variant="outline-secondary" style={{ minHeight: 52, borderRadius: 'var(--radius-full)' }}><FaFacebook style={{ color: '#1877F2' }} className="me-2"/> Sign In With Facebook</Button>
                  <Button variant="outline-secondary" style={{ minHeight: 52, borderRadius: 'var(--radius-full)' }}><FaGoogle style={{ color: '#DB4437' }} className="me-2"/> Sign In With Google</Button>
                </div>
              </Form>
            </Card>
          </div>
        </div>
      </div>
    );
  },
};