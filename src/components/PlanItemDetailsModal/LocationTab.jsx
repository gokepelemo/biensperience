import { FaCheck, FaCopy, FaMapMarkerAlt } from 'react-icons/fa';
import { Button, Tooltip } from '../design-system';
import EmptyState from '../EmptyState/EmptyState';
import GoogleMap from '../GoogleMap/GoogleMap';
import { lang } from '../../lang.constants';
import styles from './PlanItemDetailsModal.module.css';

export default function LocationTab({
  planItem,
  locationForMap,
  fullCopyableAddress,
  addressCopied,
  onCopyAddress,
  canEdit,
  onEditLocation,
  onAddLocation,
}) {
  if (!locationForMap) {
    return (
      <EmptyState
        variant="generic"
        icon="📍"
        title={lang.current.planItemDetailsModal.noLocationSet}
        description={lang.current.planItemDetailsModal.noLocationDescription}
        primaryAction={canEdit ? lang.current.planItemDetailsModal.addLocation : null}
        onPrimaryAction={canEdit ? onAddLocation : null}
        size="md"
        fillContainer
      />
    );
  }

  return (
    <>
      <div className={styles.locationHeader}>
        <div className={styles.locationIcon}>
          <FaMapMarkerAlt />
        </div>
        <div className={styles.locationInfo}>
          <div className={styles.locationAddress}>{planItem.location.address}</div>
          {(planItem.location.city ||
            planItem.location.state ||
            planItem.location.country) && (
            <div className={styles.locationMeta}>
              {[planItem.location.city, planItem.location.state, planItem.location.country]
                .filter(Boolean)
                .join(', ')}
            </div>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onEditLocation}>
            {lang.current.planItemDetailsModal.change}
          </Button>
        )}
      </div>

      <Tooltip
        content={
          addressCopied ? 'Copied!' : 'Click to copy address for use in other apps'
        }
        placement="top"
      >
        <button
          type="button"
          className={`${styles.copyableAddressBar} ${addressCopied ? styles.copied : ''}`}
          onClick={onCopyAddress}
          aria-label={lang.current.aria.copyAddressToClipboard}
        >
          <span className={styles.copyableAddressText}>{fullCopyableAddress}</span>
          <span className={styles.copyAddressIcon}>
            {addressCopied ? <FaCheck /> : <FaCopy />}
          </span>
        </button>
      </Tooltip>

      <div className={styles.locationMapWrapper}>
        <GoogleMap
          location={locationForMap}
          height={400}
          showDirections={true}
          title={`Map of ${planItem.location.address}`}
        />
      </div>
    </>
  );
}
