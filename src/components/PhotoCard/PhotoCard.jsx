import "./PhotoCard.css";
import { useMemo } from "react";
import { lang } from "../../lang.constants";

export default function PhotoCard({ photo, altText, title }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const imageAlt = altText || title || lang.en.image.alt.photo;

  return (
    <figure className="photoFrame" role="img" aria-label={imageAlt}>
      {photo ? (
        <>
          <div className="photoCard d-flex align-items-center justify-content-center">
              <img
                src={photo.url}
                className="rounded img-fluid"
                alt={imageAlt}
                title={photo.photo_credit || title}
                loading="lazy"
                decoding="async"
              />
          </div>
          {photo.photo_credit && photo.photo_credit !== "undefined" && (
            <figcaption className="photo-credit-block">
              <small>
                {lang.en.image.photoCredit}{" "}
                <a
                  href={photo.photo_credit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Photo credit: ${photo.photo_credit}, opens in new window`}
                >
                  {photo.photo_credit}
                </a>
              </small>
            </figcaption>
          )}
        </>
      ) : (
        <div className="photoCard">
          <img
            src={`https://picsum.photos/600?rand=${rand}`}
            className="rounded img-fluid"
            alt={`${imageAlt} placeholder`}
            loading="lazy"
            decoding="async"
            role="presentation"
          />
        </div>
      )}
    </figure>
  );
}
