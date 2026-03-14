import styles from "./HeroBanner.module.css";

export default function HeroBanner() {
  return (
    <>
      <div className={styles.heroBanner}>
        <h1 className={styles.heroBannerTitle}>Biensperience</h1>
        <h2 className={styles.tagline}>Plan amazing travel experiences with friends and share your adventures with fellow travelers worldwide.</h2>
      </div>
    </>
  );
}
