import "./FavoriteDestination.css";
import { useState, useEffect } from "react";
import { lang } from "../../lang.constants";
import {
  toggleUserFavoriteDestination,
} from "../../utilities/destinations-api";

export default function FavoriteDestination({ destination, user, getData }) {
  const [isUserFavorite, setIsUserFavorite] = useState(false);
  const [favHover, setFavHover] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (destination && user) {
      setIsUserFavorite(destination.users_favorite?.indexOf(user._id) !== -1);
    }
  }, [destination, user]);
  async function handleAddToFavorites(e) {
    if (loading) return;
    setLoading(true);
    try {
      // Optimistically update local state for instant feedback
      setIsUserFavorite(!isUserFavorite);
      await toggleUserFavoriteDestination(destination._id, user._id);
      // Then refresh data from server to ensure consistency
      await getData();
    } catch (error) {
      // Revert optimistic update on error
      setIsUserFavorite(!isUserFavorite);
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <button
        className={`btn btn-icon my-4 ${isUserFavorite ? 'btn-favorite-remove' : 'btn-favorite-add'}`}
        onClick={handleAddToFavorites}
        onMouseEnter={() => setFavHover(true)}
        onMouseLeave={() => setFavHover(false)}
        disabled={loading}
        aria-busy={loading}
      >
        {!isUserFavorite
          ? loading ? "Adding..." : lang.en.button.addFavoriteDest
          : favHover
            ? loading ? "Removing..." : lang.en.button.removeFavoriteDest
            : loading ? "Updating..." : lang.en.button.favorited}
      </button>
    </div>
  );
}
