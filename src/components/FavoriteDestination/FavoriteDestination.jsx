import "./FavoriteDestination.css";
import { useState } from "react";
import { lang } from "../../lang.constants";
import {
  toggleUserFavoriteDestination,
} from "../../utilities/destinations-api";
import AlertModal from "../AlertModal/AlertModal";

export default function FavoriteDestination({ destination, user, getData }) {
  const [favHover, setFavHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Compute favorite status directly from props - single source of truth
  const isUserFavorite = destination?.users_favorite?.includes(user?._id) || false;

  async function handleAddToFavorites() {
    if (loading) return;
    setLoading(true);

    try {
      // Make the API call - backend saves to database
      await toggleUserFavoriteDestination(destination._id, user._id);

      // Refresh data from server - this will update the parent's state
      // which will flow down as a new prop, updating isUserFavorite
      if (getData) {
        await getData();
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      setShowAlertModal(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="favorite-destination-wrapper">
        <button
          className={`btn btn-icon my-4 ${isUserFavorite ? 'btn-favorite-remove' : 'btn-favorite-add'} ${loading ? 'loading' : ''}`}
          onClick={handleAddToFavorites}
          onMouseEnter={() => setFavHover(true)}
          onMouseLeave={() => setFavHover(false)}
          disabled={loading}
          aria-busy={loading}
        >
          {!isUserFavorite
            ? lang.en.button.addFavoriteDest
            : favHover
              ? lang.en.button.removeFavoriteDest
              : lang.en.button.favorited}
        </button>
      </div>
      
      <AlertModal
        show={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title="Update Failed"
        message="Failed to update favorite. Please try again."
        variant="danger"
      />
    </>
  );
}
