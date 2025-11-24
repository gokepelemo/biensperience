import styles from "./TravelTipsList.module.scss";
import TravelTip from '../TravelTip/TravelTip';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export default function TravelTipsList({ tips, editable = false, onDeleteTip }) {
  if (!tips || tips.length === 0) {
    return null;
  }

  // Slick carousel settings for single-line horizontal scroll
  const sliderSettings = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    swipeToSlide: true,
    arrows: true,
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 2.5,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1.5,
          slidesToScroll: 1,
          arrows: false,
        }
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: false,
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
