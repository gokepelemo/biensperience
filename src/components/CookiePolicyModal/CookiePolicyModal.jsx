import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { FaArrowLeft, FaCookieBite } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import styles from './CookiePolicyModal.module.scss';
import { lang } from '../../lang.constants';

// Get legal email from env var with fallback
const LEGAL_EMAIL = process.env.LEGAL_EMAIL_CONTACT || 'privacy@biensperience.com';

/**
 * Cookie Policy Modal Component
 *
 * Displays the application's cookie policy in a scrollable modal.
 * Explains what cookies are used, their purposes, and user rights.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} [props.onBack] - Optional function to navigate back
 * @param {boolean} [props.showBackButton=false] - Whether to show the back button
 * @param {boolean} [props.showConsentButtons=false] - Whether to show Accept/Decline buttons
 * @param {Function} [props.onAccept] - Function called when Accept is clicked
 * @param {Function} [props.onDecline] - Function called when Decline is clicked
 */
export default function CookiePolicyModal({
  show,
  onClose,
  onBack,
  showBackButton = false,
  showConsentButtons = false,
  onAccept,
  onDecline
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    onClose();
  };

  const handleDecline = () => {
    if (onDecline) {
      onDecline();
    }
    onClose();
  };

  // Show consent buttons when in consent flow
  const customFooter = showConsentButtons ? (
    <div className={styles.footerContent}>
      <Button
        variant="outline-secondary"
        onClick={handleDecline}
      >
        {lang.current.cookieConsent.decline}
      </Button>
      <Button variant="primary" onClick={handleAccept}>
        {lang.current.cookieConsent.accept}
      </Button>
    </div>
  ) : showBackButton ? (
    <div className={styles.footerContent}>
      <Button
        variant="outline-secondary"
        onClick={handleBack}
        className={styles.backButton}
      >
        <FaArrowLeft className="me-2" /> Back
      </Button>
      <Button variant="primary" onClick={onClose}>
        I Understand
      </Button>
    </div>
  ) : (
    <Button variant="primary" onClick={onClose}>
      I Understand
    </Button>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Cookie Policy"
      size="lg"
      scrollable
      icon={<FaCookieBite />}
      footer={customFooter}
    >
      <div className={styles.policyContent}>
        <p className={styles.lastUpdated}>Last Updated: December 7, 2025</p>

        <section className={styles.section}>
          <h3>1. Introduction</h3>
          <p>
            This Cookie Policy explains how Biensperience ("we," "us," or "our") uses
            cookies and similar technologies when you visit our travel planning platform.
            By using our website, you consent to the use of cookies as described in this policy.
          </p>
        </section>

        <section className={styles.section}>
          <h3>2. What Are Cookies?</h3>
          <p>
            Cookies are small text files stored on your device (computer, tablet, or mobile)
            when you visit a website. They help the website remember your preferences and
            actions over time, so you don't have to re-enter them whenever you come back
            or browse from one page to another.
          </p>
        </section>

        <section className={styles.section}>
          <h3>3. Types of Cookies We Use</h3>

          <h4>3.1 Essential Cookies</h4>
          <p>
            These cookies are necessary for the website to function properly. They enable
            core functionality such as security, network management, and account access.
            You cannot opt out of these cookies as the website cannot function without them.
          </p>
          <ul>
            <li><strong>Session Cookies:</strong> Maintain your logged-in state</li>
            <li><strong>Security Cookies:</strong> Help protect against unauthorized access (CSRF protection)</li>
            <li><strong>Consent Cookies:</strong> Remember your cookie preferences</li>
          </ul>

          <h4>3.2 Functional Cookies</h4>
          <p>
            These cookies enable enhanced functionality and personalization. They may be
            set by us or by third-party providers whose services we use.
          </p>
          <ul>
            <li><strong>Preference Cookies:</strong> Remember your settings (theme, language, currency)</li>
            <li><strong>Feature Cookies:</strong> Enable optional features you've chosen to use</li>
          </ul>

          <h4>3.3 Analytics Cookies</h4>
          <p>
            With your consent, we may use analytics cookies to understand how visitors
            interact with our website. This helps us improve our services.
          </p>
          <ul>
            <li><strong>Usage Analytics:</strong> Track pages visited and time spent</li>
            <li><strong>Performance Metrics:</strong> Identify technical issues and areas for improvement</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>4. Third-Party Cookies</h3>
          <p>
            Some cookies may be placed by third-party services that appear on our pages:
          </p>
          <ul>
            <li><strong>Social Login Providers:</strong> Google, Facebook, and Twitter authentication</li>
            <li><strong>Map Services:</strong> Google Maps for displaying destination locations</li>
            <li><strong>Analytics Services:</strong> Used only with your consent</li>
          </ul>
          <p>
            These third parties have their own privacy policies governing the use of cookies.
          </p>
        </section>

        <section className={styles.section}>
          <h3>5. Cookie Retention</h3>
          <p>Cookie retention periods vary based on their purpose:</p>
          <ul>
            <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
            <li><strong>Authentication Cookies:</strong> Up to 24 hours or when you log out</li>
            <li><strong>Preference Cookies:</strong> Up to 1 year</li>
            <li><strong>Consent Cookies:</strong> Up to 1 year</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>6. Managing Cookies</h3>
          <p>You have several options for managing cookies:</p>

          <h4>6.1 Cookie Consent</h4>
          <p>
            When you first visit our site, you'll see a cookie consent notice. You can
            accept or decline non-essential cookies. Essential cookies cannot be disabled
            as they are required for the site to function.
          </p>

          <h4>6.2 Browser Settings</h4>
          <p>
            Most web browsers allow you to control cookies through their settings. You can:
          </p>
          <ul>
            <li>View what cookies are stored on your device</li>
            <li>Delete some or all cookies</li>
            <li>Block cookies from being set</li>
            <li>Set preferences for specific websites</li>
          </ul>
          <p>
            Note: Blocking all cookies may affect your experience and prevent some features
            from working properly.
          </p>

          <h4>6.3 Opt-Out Links</h4>
          <p>
            For third-party analytics, you can often opt out directly:
          </p>
          <ul>
            <li>Google Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out</a></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>7. Local Storage</h3>
          <p>
            In addition to cookies, we use browser local storage to store encrypted
            preferences and form data locally on your device. This data never leaves
            your browser and is encrypted using your user ID.
          </p>
        </section>

        <section className={styles.section}>
          <h3>8. Updates to This Policy</h3>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in
            our practices or for other operational, legal, or regulatory reasons.
            We will update the "Last Updated" date at the top of this policy.
          </p>
        </section>

        <section className={styles.section}>
          <h3>9. Contact Us</h3>
          <p>
            If you have questions about our use of cookies, please contact us at:
          </p>
          <p className={styles.contactInfo}>
            <strong>Email:</strong> <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
        </section>
      </div>
    </Modal>
  );
}

CookiePolicyModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  showBackButton: PropTypes.bool,
  showConsentButtons: PropTypes.bool,
  onAccept: PropTypes.func,
  onDecline: PropTypes.func
};
