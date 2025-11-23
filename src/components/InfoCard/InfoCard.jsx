import styles from "./InfoCard.module.scss";
import { Link } from "react-router-dom";

/**
 * InfoCard - A reusable information card component
 *
 * @param {Object} props
 * @param {string} props.title - Main title for the card
 * @param {string} props.titleLink - Optional link URL for the title (makes title clickable)
 * @param {React.ReactNode} props.headerContent - Content for the header section
 * @param {Array} props.sections - Array of section objects with title and content
 * @param {React.ReactNode} props.map - Optional map component to display
 * @param {string} props.className - Additional CSS classes
 */
export default function InfoCard({
  title,
  titleLink,
  headerContent,
  sections = [],
  map,
  className = ""
}) {
  return (
    <div className={`${styles.infoCard} ${className}`}>
      {title && (
        <div className={styles.infoCardHeader}>
          {titleLink ? (
            <Link to={titleLink} className={styles.infoCardTitleLink}>
              <h4 className={styles.infoCardTitle}>{title}</h4>
            </Link>
          ) : (
            <h4 className={styles.infoCardTitle}>{title}</h4>
          )}
          {headerContent && (
            <div className={styles.infoCardHeaderContent}>
              {headerContent}
            </div>
          )}
        </div>
      )}

      {sections.map((section, index) => (
        <div key={index} className={styles.infoCardSection}>
          {section.title && (
            <h5 className={styles.infoCardSectionTitle}>{section.title}</h5>
          )}
          <div className={styles.infoCardContent}>
            {section.content}
          </div>
        </div>
      ))}

      {map && (
        <div className={styles.infoCardMap}>
          {map}
        </div>
      )}
    </div>
  );
}