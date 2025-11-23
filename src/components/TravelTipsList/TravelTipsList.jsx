import styles from "./TravelTipsList.module.scss";
import TravelTip from '../TravelTip/TravelTip';

export default function TravelTipsList({ tips, editable = false, onDeleteTip }) {
  if (!tips || tips.length === 0) {
    return null;
  }

  return (
    <div className={styles.travelTipsList}>
      <h3 className={styles.travelTipsHeading}>
        <span className={styles.travelTipsIcon} aria-hidden="true">💡</span>
        Travel Tips & Information
      </h3>
      <div className={styles.travelTipsGrid}>
        {tips.map((tip, index) => (
          <TravelTip
            key={index}
            tip={tip}
            index={index}
            editable={editable}
            onDelete={onDeleteTip}
          />
        ))}
      </div>
    </div>
  );
}
