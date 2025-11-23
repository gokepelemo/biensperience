import styles from "./HeroBanner.module.scss";

export default function HeroBanner() {
  return (
    <>
      <div className={styles.heroBanner}>
        <h1 className={styles.heroBannerTitle}>Biensperience</h1>
        <h2 className={styles.tagline}>Plan your next adventure with others and share your travel experiences</h2>
      </div>
    </>
  );
}
