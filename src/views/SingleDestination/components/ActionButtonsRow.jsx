/**
 * ActionButtonsRow Component for SingleDestination
 * Displays action buttons for destinations: Favorite, Edit, Delete
 */

import { useNavigate } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';

export default function ActionButtonsRow({
  // User & Destination data
  user,
  destination,
  destinationId,

  // Favorite state
  isUserFavorite,
  loading,
  favHover,
  setFavHover,

  // Handlers
  handleFavorite,
  setShowDeleteModal,

  // Language strings
  lang
}) {
  const navigate = useNavigate();

  // Ref-based dimension locking to prevent layout shift during loading
  const favButtonRef = useRef(null);
  const [favBtnWidth, setFavBtnWidth] = useState(null);

  // Measure button width when not loading to lock dimensions
  useEffect(() => {
    if (favButtonRef.current && !loading) {
      const width = favButtonRef.current.offsetWidth;
      if (width > 0) {
        setFavBtnWidth(width);
      }
    }
  }, [loading, isUserFavorite, favHover]);

  return (
    <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row destination-actions">
      {/* Favorite Button */}
      <FadeIn>
        <button
          className={`btn btn-sm btn-icon my-1 my-sm-2 ${
            isUserFavorite ? "btn-favorite-remove" : "btn-favorite-add"
          } ${loading ? "loading" : ""}`}
          ref={favButtonRef}
          style={favBtnWidth ? {
            width: `${favBtnWidth}px`,
            minWidth: `${favBtnWidth}px`,
            height: '44px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          } : undefined}
          onClick={handleFavorite}
          aria-label={
            isUserFavorite
              ? lang.en.button.removeFavoriteDest
              : lang.en.button.addFavoriteDest
          }
          aria-pressed={isUserFavorite}
          onMouseEnter={() => setFavHover(true)}
          onMouseLeave={() => setFavHover(false)}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <Loading size="sm" variant="inline" showMessage={false} />
          ) : isUserFavorite ? (
            favHover
              ? lang.en.button.removeFavoriteDest
              : lang.en.button.favorited
          ) : (
            lang.en.button.addFavoriteDest
          )}
        </button>
      </FadeIn>

      {/* Edit & Delete Buttons - Only shown if user is owner */}
      {isOwner(user, destination) && (
        <>
          <FadeIn>
            <button
              className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
              onClick={() => navigate(`/destinations/${destinationId}/update`)}
              aria-label={lang.en.aria.editDestination}
              title={lang.en.aria.editDestination}
            >
              ✏️
            </button>
          </FadeIn>
          <FadeIn>
            <button
              className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
              onClick={() => setShowDeleteModal(true)}
              aria-label={lang.en.aria.deleteDestination}
              title={lang.en.aria.deleteDestination}
            >
              ❌
            </button>
          </FadeIn>
        </>
      )}
    </div>
  );
}