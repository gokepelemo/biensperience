/**
 * ActionButtonsRow Component for SingleDestination
 * Displays action buttons for destinations: Favorite, Edit, Delete
 * All buttons have consistent width based on the longest text
 */

import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { calculateGroupButtonWidth } from '../../../utilities/button-utils';

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

  // Calculate consistent button width based on all possible text states
  const buttonWidth = useMemo(() => {
    const allTexts = [
      lang.en.button.addFavoriteDest,   // "+ Favorite"
      lang.en.button.removeFavoriteDest, // "- Remove"
      lang.en.button.favorited,          // "❤️ Favorited"
      "Edit",                             // Edit button text
      "Delete"                            // Delete button text
    ];
    return calculateGroupButtonWidth(allTexts, { size: 'sm', hasIcon: false });
  }, [lang]);

  // Common button style for consistent sizing
  const buttonStyle = {
    width: `${buttonWidth}px`,
    minWidth: `${buttonWidth}px`,
    height: '44px',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row destination-actions">
      {/* Favorite Button */}
      <FadeIn>
        <button
          className={`btn btn-sm btn-icon my-1 my-sm-2 ${
            isUserFavorite ? "btn-favorite-remove" : "btn-favorite-add"
          } ${loading ? "loading" : ""}`}
          style={buttonStyle}
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
              style={buttonStyle}
              onClick={() => navigate(`/destinations/${destinationId}/update`)}
              aria-label={lang.en.aria.editDestination}
              title={lang.en.aria.editDestination}
            >
              Edit
            </button>
          </FadeIn>
          <FadeIn>
            <button
              className="btn btn-sm btn-icon my-1 my-sm-2 ms-2"
              style={buttonStyle}
              onClick={() => setShowDeleteModal(true)}
              aria-label={lang.en.aria.deleteDestination}
              title={lang.en.aria.deleteDestination}
            >
              Delete
            </button>
          </FadeIn>
        </>
      )}
    </div>
  );
}