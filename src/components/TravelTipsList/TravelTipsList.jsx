import styles from "./TravelTipsList.module.scss";
import TravelTip from '../TravelTip/TravelTip';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export default function TravelTipsList({ tips, editable = false, onDeleteTip }) {
  if (!tips || tips.length === 0) {
    return null;
  }

  // Slick carousel settings - one card per view, scroll one at a time
  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    swipeToSlide: true,
    arrows: true,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          arrows: false, // Hide arrows on mobile, use swipe/dots
        }
      }
    ]
  };

  return (
    <div className={styles.travelTipsList}>
      <h3 className={styles.travelTipsHeading}>
        <span className={styles.travelTipsIcon} aria-hidden="true">💡</span>
        Travel Tips & Information
      </h3>
      <div className={styles.travelTipsSlider}>
        <Slider {...sliderSettings}>
          {tips.map((tip, index) => (
            <div key={index} className={styles.travelTipSlide}>
              <TravelTip
                tip={tip}
                index={index}
                editable={editable}
                onDelete={onDeleteTip}
              />
            </div>
          ))}
        </Slider>
      </div>
    </div>
  );
}
