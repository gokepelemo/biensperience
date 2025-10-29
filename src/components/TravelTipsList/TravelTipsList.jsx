import "./TravelTipsList.css";
import TravelTip from '../TravelTip/TravelTip';

export default function TravelTipsList({ tips, editable = false, onDeleteTip }) {
  if (!tips || tips.length === 0) {
    return null;
  }

  return (
    <div className="travel-tips-list">
      <h3 className="travel-tips-heading">
        <span className="travel-tips-icon" aria-hidden="true">💡</span>
        Travel Tips & Information
      </h3>
      <div className="travel-tips-grid">
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
