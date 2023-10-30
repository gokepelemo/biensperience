import "./PhotoCard.css"

export default function PhotoCard({ photo, altText }) {
  const rand = Math.floor(Math.random() * 50)
  return (
    <div className="photoFrame">
      {photo ? (
        <>
          <div className="photoCard d-flex align-items-center justify-content-center">
            <img src={photo.url} className="rounded img-fluid" alt={photo.photo_credit} title={photo.photo_credit} />
          </div>
          {photo.photo_credit && (
            <small>
              Photo Credit:{" "}
              <a href={photo.photo_credit_url}>{photo.photo_credit}</a>
            </small>
          )}
        </>
      ) : (
        <div className="photoCard"><img src={`https://picsum.photos/600?rand=${rand}`} className="rounded img-fluid" /></div>
      )}
    </div>
  );
}
