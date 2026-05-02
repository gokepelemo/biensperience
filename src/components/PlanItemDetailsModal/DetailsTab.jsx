import { FaFilePdf } from 'react-icons/fa';
import { Alert, Button, Tooltip } from '../design-system';
import EmptyState from '../EmptyState/EmptyState';
import DetailItemCard from './DetailItemCard';
import CollaboratorDetailsSection from './CollaboratorDetailsSection';
import { lang } from '../../lang.constants';
import styles from './PlanItemDetailsModal.module.css';

export default function DetailsTab({
  pdfExportBlocked,
  onDismissPdfExportBlocked,
  totalDetailsCount,
  groupedDetails,
  onExportPDF,
  collaborators,
  canEdit,
  onAddCostForItem,
  onAddDetail,
  onAddDetailRequest,
  plan,
  currentUser,
}) {
  const canAddDetails = canEdit && (onAddCostForItem || onAddDetail);

  return (
    <div className={styles.detailsTabContent}>
      {pdfExportBlocked && (
        <Alert
          type="warning"
          message="Your browser blocked the PDF export popup. Please allow popups for this site and try again."
          dismissible
          onClose={onDismissPdfExportBlocked}
        />
      )}

      {totalDetailsCount > 0 && (
        <div className={styles.detailsExportBar}>
          <Tooltip content="Export all details to PDF" placement="left">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              leftIcon={<FaFilePdf />}
            >
              {lang.current.planItemDetailsModal.exportPdf}
            </Button>
          </Tooltip>
        </div>
      )}

      {totalDetailsCount > 0 ? (
        <div className={styles.detailsGroupedList}>
          {Object.entries(groupedDetails).map(([categoryKey, category]) => (
            <div key={categoryKey} className={styles.detailsCategory}>
              <h3 className={styles.detailsCategoryTitle}>
                <span className={styles.detailsCategoryIcon}>{category.icon}</span>
                <span>{category.label}</span>
                <span className={styles.detailsCategoryCount}>
                  ({category.items.length})
                </span>
              </h3>
              <div className={styles.detailsCategoryItems}>
                {category.items.map((item, index) => (
                  <DetailItemCard
                    key={item._key || `${categoryKey}-${index}`}
                    item={item}
                    collaborators={collaborators}
                    styles={styles}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          variant="generic"
          icon="📋"
          title={lang.current.planItemDetailsModal.noDetailsAdded}
          description={lang.current.planItemDetailsModal.noDetailsDescription}
          primaryAction={
            canAddDetails
              ? lang.current.planItemDetailsModal.addDetails || 'Add Details'
              : null
          }
          onPrimaryAction={canAddDetails ? onAddDetailRequest : null}
          size="md"
          fillContainer={collaborators.length === 0}
        />
      )}

      <CollaboratorDetailsSection
        collaborators={collaborators}
        plan={plan}
        currentUser={currentUser}
        styles={styles}
      />
    </div>
  );
}
