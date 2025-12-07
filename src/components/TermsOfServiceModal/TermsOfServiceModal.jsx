import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { FaArrowLeft, FaFileContract } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import styles from './TermsOfServiceModal.module.scss';

// Get legal email from env var with fallback
const LEGAL_EMAIL = process.env.LEGAL_EMAIL_CONTACT || 'legal@biensperience.com';

/**
 * Terms of Service Modal Component
 *
 * Displays the application's terms of service in a scrollable modal.
 * Includes a back button for navigation (e.g., returning to signup modal).
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} [props.onBack] - Optional function to navigate back (e.g., to signup)
 * @param {boolean} [props.showBackButton=false] - Whether to show the back button
 */
export default function TermsOfServiceModal({
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
        I Accept
      </Button>
    </div>
  ) : (
    <Button variant="primary" onClick={onClose}>
      I Accept
    </Button>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Terms of Service"
      size="lg"
      scrollable
      icon={<FaFileContract />}
      footer={customFooter}
    >
      <div className={styles.termsContent}>
        <p className={styles.lastUpdated}>Last Updated: November 27, 2025</p>

        <section className={styles.section}>
          <h3>1. Acceptance of Terms</h3>
          <p>
            By accessing or using Biensperience ("the Service"), you agree to be bound by these
            Terms of Service ("Terms"). If you do not agree to these Terms, please do not use
            the Service.
          </p>
        </section>

        <section className={styles.section}>
          <h3>2. Description of Service</h3>
          <p>
            Biensperience is a travel planning platform that allows users to discover destinations,
            create itineraries, plan experiences, and collaborate with other travelers. The Service
            may include features for organizing travel plans, sharing photos, and connecting with
            other users.
          </p>
        </section>

        <section className={styles.section}>
          <h3>3. User Accounts</h3>
          <h4>3.1 Account Creation</h4>
          <p>
            To use certain features of the Service, you must create an account. You agree to
            provide accurate, current, and complete information during registration and to
            keep your account information updated.
          </p>

          <h4>3.2 Account Security</h4>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activities that occur under your account. You agree to notify us
            immediately of any unauthorized use of your account.
          </p>

          <h4>3.3 Account Termination</h4>
          <p>
            You may delete your account at any time. We reserve the right to suspend or
            terminate accounts that violate these Terms or engage in prohibited activities.
          </p>
        </section>

        <section className={styles.section}>
          <h3>4. User Content</h3>
          <h4>4.1 Your Content</h4>
          <p>
            You retain ownership of content you create and share on the Service, including
            travel plans, photos, and comments ("User Content"). By posting User Content,
            you grant us a non-exclusive, worldwide, royalty-free license to use, display,
            and distribute your content in connection with the Service.
          </p>

          <h4>4.2 Content Guidelines</h4>
          <p>You agree not to post content that:</p>
          <ul>
            <li>Is illegal, harmful, threatening, abusive, or harassing</li>
            <li>Infringes on intellectual property rights of others</li>
            <li>Contains viruses, malware, or other harmful code</li>
            <li>Is spam, advertising, or unauthorized commercial messages</li>
            <li>Impersonates another person or entity</li>
            <li>Contains personal information of others without consent</li>
          </ul>

          <h4>4.3 Content Removal</h4>
          <p>
            We reserve the right to remove any content that violates these Terms or is
            otherwise objectionable, at our sole discretion.
          </p>
        </section>

        <section className={styles.section}>
          <h3>5. Acceptable Use</h3>
          <p>You agree to use the Service only for lawful purposes. You agree not to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
            <li>Use the Service to collect user information without consent</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Use automated systems to access the Service without permission</li>
            <li>Engage in any activity that could damage, disable, or impair the Service</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>6. Intellectual Property</h3>
          <p>
            The Service and its original content (excluding User Content), features, and
            functionality are owned by Biensperience and are protected by international
            copyright, trademark, patent, and other intellectual property laws.
          </p>
        </section>

        <section className={styles.section}>
          <h3>7. Third-Party Services</h3>
          <p>
            The Service may contain links to third-party websites or services. We are not
            responsible for the content, privacy policies, or practices of third-party
            services. Your use of third-party services is at your own risk.
          </p>
        </section>

        <section className={styles.section}>
          <h3>8. Disclaimer of Warranties</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
            ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>
          <p>
            Travel information and recommendations on the Service are for informational purposes
            only. We are not responsible for the accuracy of travel information or any consequences
            of relying on such information.
          </p>
        </section>

        <section className={styles.section}>
          <h3>9. Limitation of Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BIENSPERIENCE SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
            PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA,
            USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
          </p>
        </section>

        <section className={styles.section}>
          <h3>10. Indemnification</h3>
          <p>
            You agree to indemnify and hold harmless Biensperience and its officers, directors,
            employees, and agents from any claims, damages, losses, or expenses arising from
            your use of the Service or violation of these Terms.
          </p>
        </section>

        <section className={styles.section}>
          <h3>11. Changes to Terms</h3>
          <p>
            We may modify these Terms at any time. We will notify you of material changes by
            posting the updated Terms on the Service and updating the "Last Updated" date.
            Your continued use of the Service after changes constitutes acceptance of the
            modified Terms.
          </p>
        </section>

        <section className={styles.section}>
          <h3>12. Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            the jurisdiction in which Biensperience operates, without regard to conflict
            of law principles.
          </p>
        </section>

        <section className={styles.section}>
          <h3>13. Contact Information</h3>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className={styles.contactInfo}>
            <strong>Email:</strong> <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </p>
        </section>
      </div>
    </Modal>
  );
}

TermsOfServiceModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  showBackButton: PropTypes.bool
};
