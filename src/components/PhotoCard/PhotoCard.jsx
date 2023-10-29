export default function PhotoCard({ photo, altText }) {
  return (
    <>
      {photo ? (
        <>
          <div className="photoCard d-flex align-items-center justify-content-center">
            <img src={photo.url} alt={altText} className="rounded img-fluid" />
          </div>
          {photo.photo_credit && (
            <small>
              Photo Credit:{" "}
              <a href={photo.photo_credit_url}>{photo.photo_credit}</a>
            </small>
          )}
        </>
      ) : (
        <div className="photoCard"><img src="https://picsum.photos/600" className="rounded img-fluid" alt="Photo Placeholder" /></div>
      )}
    </>
  );
}
