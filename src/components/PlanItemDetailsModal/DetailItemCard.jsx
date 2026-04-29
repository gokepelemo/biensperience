/**
 * DetailItemCard Component
 *
 * Renders a single plan item detail (cost, flight, hotel, parking, discount, etc.)
 * with type-appropriate fields in a card format.
 *
 * Used in the "Details" tab of PlanItemDetailsModal. The field mapping is
 * provided by getDetailDisplayFields so it stays in sync with the PDF export.
 *
 * @param {Object}  props
 * @param {Object}  props.item          - Detail item with type, typeConfig, and type-specific data
 * @param {Array}   props.collaborators - Collaborator list for resolving cost payer names
 * @param {Object}  props.styles        - CSS module styles from PlanItemDetailsModal
 */
import getDetailDisplayFields from './getDetailDisplayFields';

export default function DetailItemCard({ item, collaborators = [], styles }) {
  const fields = getDetailDisplayFields(item, { collaborators });
  const title = item.title
    || item._displayTitle
    || item.name
    || item.trackingNumber
    || item.confirmationNumber
    || 'Detail';

  return (
    <div className={styles.detailItem}>
      <div className={styles.detailItemHeader}>
        <span className={styles.detailItemIcon}>{item.typeConfig.icon}</span>
        <span className={styles.detailItemType}>{item.typeConfig.label}</span>
      </div>
      <div className={styles.detailItemContent}>
        <div className={styles.detailItemTitle}>{title}</div>
        <dl className={styles.detailItemMeta}>
          {fields.map((field, i) => (
            <div key={i} className={styles.detailMetaRow}>
              <dt>{field.label}:</dt>
              <dd className={field.className ? styles[field.className] : undefined}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
