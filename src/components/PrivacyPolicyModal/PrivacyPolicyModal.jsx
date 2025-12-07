import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import styles from './PrivacyPolicyModal.module.scss';

// Get legal email from env var with fallback
const LEGAL_EMAIL = process.env.LEGAL_EMAIL_CONTACT || 'privacy@biensperience.com';

/**
 * Privacy Policy Modal Component
 *
 * Displays the application's privacy policy in a scrollable modal.
 * Includes a back button for navigation (e.g., returning to signup modal).
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} [props.onBack] - Optional function to navigate back (e.g., to signup)
 * @param {boolean} [props.showBackButton=false] - Whether to show the back button
 */
export default function PrivacyPolicyModal({
  show,
  onClose,
  onBack,
  showBackButton = false
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const customFooter = showBackButton ? (
    <div className={styles.footerContent}>
      <Button
        variant="outline-secondary"
        onClick={handleBack}
        className={styles.backButton}
      >
        <FaArrowLeft className="me-2" /> Back to Sign Up
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
      title="Privacy Policy"
      size="lg"
      scrollable
      icon={<FaShieldAlt />}
      footer={customFooter}
    >
      <div className={styles.policyContent}>
        <p className={styles.lastUpdated}>Last Updated: November 27, 2025</p>

        <section className={styles.section}>
          <h3>1. Introduction</h3>
          <p>
            Welcome to Biensperience. We respect your privacy and are committed to protecting
            your personal data. This privacy policy explains how we collect, use, and safeguard
            your information when you use our travel planning platform.
          </p>
        </section>

        <section className={styles.section}>
          <h3>2. Information We Collect</h3>
          <h4>2.1 Information You Provide</h4>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
            <li><strong>Profile Information:</strong> Profile photos, bio, and preferences you choose to share</li>
            <li><strong>Travel Plans:</strong> Destinations, experiences, itineraries, and notes you create</li>
            <li><strong>Communications:</strong> Messages, comments, and feedback you send us</li>
          </ul>

          <h4>2.2 Information Collected Automatically</h4>
          <ul>
            <li><strong>Usage Data:</strong> How you interact with our platform, features you use, and time spent</li>
            <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
            <li><strong>Location Data:</strong> General location based on IP address (we do not track precise GPS location)</li>
            <li><strong>Cookies:</strong> We use cookies to maintain sessions and remember your preferences</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>3. How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Personalize your experience and recommendations</li>
            <li>Enable collaboration features with other users</li>
            <li>Send important updates about your account or our services</li>
            <li>Respond to your requests and provide customer support</li>
            <li>Detect and prevent fraud, abuse, and security threats</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>4. Information Sharing</h3>
          <p>We do not sell your personal information. We may share your information:</p>
          <ul>
            <li><strong>With Your Consent:</strong> When you choose to share plans or collaborate with others</li>
            <li><strong>With Service Providers:</strong> Third parties who help us operate our platform (hosting, analytics)</li>
            <li><strong>For Legal Reasons:</strong> When required by law or to protect our rights and users</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>5. Data Security</h3>
          <p>
            We implement industry-standard security measures to protect your data, including:
          </p>
          <ul>
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Secure password hashing</li>
            <li>Regular security audits and updates</li>
            <li>Access controls limiting who can view your information</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>6. Your Rights and Choices</h3>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and data</li>
            <li><strong>Portability:</strong> Export your travel plans and data</li>
            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>7. Cookies and Tracking</h3>
          <p>
            We use cookies and similar technologies for authentication, preferences, and analytics.
            You can manage cookie preferences in your browser settings. Disabling cookies may
            affect some features of our platform.
          </p>
        </section>

        <section className={styles.section}>
          <h3>8. Third-Party Services</h3>
          <p>
            Our platform may integrate with third-party services (social login providers, map services).
            These services have their own privacy policies, and we encourage you to review them.
          </p>
        </section>

        <section className={styles.section}>
          <h3>9. Children's Privacy</h3>
          <p>
            Our services are not intended for users under 13 years of age. We do not knowingly
            collect information from children under 13.
          </p>
        </section>

        <section className={styles.section}>
          <h3>10. Changes to This Policy</h3>
          <p>
            We may update this privacy policy from time to time. We will notify you of significant
            changes via email or through the platform. Continued use of our services after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className={styles.section}>
          <h3>11. Contact Us</h3>
          <p>
            If you have questions about this privacy policy or your data, please contact us at:
          </p>
          <p className={styles.contactInfo}>
            <strong>Email:</strong> <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
        </section>
      </div>
    </Modal>
  );
}

PrivacyPolicyModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  showBackButton: PropTypes.bool
};
