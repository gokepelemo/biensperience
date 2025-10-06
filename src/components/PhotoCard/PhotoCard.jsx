import "./PhotoCard.css"
import { useMemo } from "react";

export default function PhotoCard({ photo, altText, title }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const imageAlt = altText || title || "Photo";

  return (
    <div className="photoFrame">
      {photo ? (
        <>
          <div className="photoCard d-flex align-items-center justify-content-center">
              <img
                src={photo.url}
                className="rounded img-fluid"
                alt={imageAlt}
                title={photo.photo_credit || title}
              />
          </div>
          {photo.photo_credit && photo.photo_credit !== "undefined" && (
            <div className="photo-credit-block">
              <small>
                Photo Credit:{" "}
                <a href={photo.photo_credit_url} target="_blank" rel="noopener noreferrer">
                  {photo.photo_credit}
                </a>
              </small>
            </div>
          )}
        </>
      ) : (
        <div className="photoCard">
          <img
            src={`https://picsum.photos/600?rand=${rand}`}
            className="rounded img-fluid"
            alt={imageAlt}
          />
        </div>
      )}
    </div>
  );
}
