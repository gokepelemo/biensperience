/**
 * ActionButtonsRow Component for SingleDestination
 * Displays action buttons for destinations: Favorite, Edit, Delete
 * All buttons have consistent width based on the longest text
 */

import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { FaPencilAlt, FaTrash, FaRobot } from 'react-icons/fa';
import { FadeIn } from '../../../components/design-system';
import SplitButton from '../../../components/SplitButton/SplitButton';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { calculateGroupButtonWidth } from '../../../utilities/button-utils';
import { useBienBotEntityAction } from '../../../hooks/useBienBotEntityAction';
import styles from './ActionButtonsRow.module.css';

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

  // BienBot analyze action (ai_features flag guard)
  const { label: bienbotLabel, hasAccess: hasBienBot, handleOpen: handleBienBot } =
    useBienBotEntityAction('destination', destinationId, destination?.name || 'Destination');

  // Calculate consistent button width based on all possible text states
  const buttonWidth = useMemo(() => {
    const allTexts = [
      lang.current.button.addFavoriteDest,   // "+ Favorite"
      lang.current.button.removeFavoriteDest, // "- Remove"
      lang.current.button.favorited,          // "❤️ Favorited"
      "Edit",                             // Edit button text
      "Delete"                            // Delete button text
    ];
    return calculateGroupButtonWidth(allTexts, { size: 'sm', hasIcon: false });
  }, [lang]);

  // Common button style for consistent sizing
  const buttonStyle = {
    width: `${buttonWidth}px`,
    minWidth: `${buttonWidth}px`,
    height: 'var(--btn-height-md)',
    minHeight: 'var(--btn-height-md)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div className={`${styles.actionsContainer} destination-actions`}>
      {/* Favorite Button */}
      <FadeIn>
        <button
          className={`btn btn-sm btn-icon ${styles.buttonSpacing} ${
            isUserFavorite ? "btn-favorite-remove" : "btn-favorite-add"
          } ${loading ? "loading" : ""}`}
          style={buttonStyle}
          onClick={handleFavorite}
          aria-label={
            isUserFavorite
              ? lang.current.button.removeFavoriteDest
              : lang.current.button.addFavoriteDest
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
              ? lang.current.button.removeFavoriteDest
              : lang.current.button.favorited
          ) : (
            lang.current.button.addFavoriteDest
          )}
        </button>
      </FadeIn>

      {/* Owner actions - Edit (primary) with Delete and BienBot in dropdown */}
      {isOwner(user, destination) && (
        <FadeIn>
          <SplitButton
            label="Edit"
            icon={<FaPencilAlt />}
            onClick={() => navigate(`/destinations/${destinationId}/update`)}
            variant="outline"
            size="sm"
            menuAriaLabel="Destination actions"
            placement="bottom-end"
          >
            <SplitButton.Item
              value="delete"
              onClick={() => setShowDeleteModal(true)}
              color="fg.error"
              _hover={{ bg: "bg.error", color: "fg.error" }}
            >
              <FaTrash /> Delete
            </SplitButton.Item>
            {hasBienBot && (
              <SplitButton.Item
                value="bienbot"
                onClick={handleBienBot}
              >
                <FaRobot /> {bienbotLabel}
              </SplitButton.Item>
            )}
          </SplitButton>
        </FadeIn>
      )}

      {/* BienBot Analyze button — for non-owners with ai_features flag */}
      {!isOwner(user, destination) && user && hasBienBot && (
        <FadeIn>
          <button
            className={`btn btn-sm btn-icon ${styles.buttonSpacing}`}
            style={{ ...buttonStyle, gap: 'var(--space-2)' }}
            onClick={handleBienBot}
            title={`${bienbotLabel} with BienBot`}
            aria-label={`${bienbotLabel} with BienBot`}
          >
            <FaRobot /> {bienbotLabel}
          </button>
        </FadeIn>
      )}
    </div>
  );
}