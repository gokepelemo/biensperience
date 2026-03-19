import { FaFacebook, FaGoogle, FaCheckCircle, FaUnlink } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { lang } from "../../../lang.constants";
import styles from "../Profile.module.css";

const PROVIDER_CONFIG = {
  facebook: {
    icon: FaFacebook,
    nameKey: 'linkedFacebook',
  },
  google: {
    icon: FaGoogle,
    nameKey: 'linkedGoogle',
  },
  twitter: {
    icon: FaXTwitter,
    nameKey: 'linkedTwitter',
  },
};

export default function LinkedAccountRow({ provider, isLinked, linkedAt, onLink, onUnlink, unlinking }) {
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  return (
    <div className={styles.linkedAccountItem}>
      <div className={styles.linkedAccountInfo}>
        <div className={`${styles.linkedAccountIcon} ${isLinked ? styles[provider] : styles.disabled}`}>
          <Icon />
        </div>
        <div className={styles.linkedAccountDetails}>
          <span className={styles.linkedAccountName}>{lang.current.profile[config.nameKey]}</span>
          <span className={`${styles.linkedAccountStatus} ${isLinked ? styles.linked : styles.notLinked}`}>
            {isLinked ? (
              <><FaCheckCircle /> {lang.current.profile.linked}</>
            ) : (
              lang.current.profile.notLinked
            )}
          </span>
          {isLinked && linkedAt && (
            <span className={styles.linkedAccountDate}>
              {lang.current.profile.accountLinkedAt.replace('{date}', new Date(linkedAt).toLocaleDateString())}
            </span>
          )}
        </div>
      </div>
      <div className={styles.linkedAccountActions}>
        {isLinked ? (
          <button
            type="button"
            className={`${styles.linkedAccountBtn} ${styles.unlink}`}
            onClick={() => onUnlink(provider)}
            disabled={unlinking}
          >
            {unlinking ? (
              <span className={styles.linkedAccountSpinner} />
            ) : (
              <><FaUnlink /> {lang.current.profile.unlinkAccount}</>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.linkedAccountBtn} ${styles.link}`}
            onClick={() => onLink(provider)}
          >
            {lang.current.profile.linkAccount}
          </button>
        )}
      </div>
    </div>
  );
}
