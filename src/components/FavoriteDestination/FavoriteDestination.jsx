import "./FavoriteDestination.css";
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
    setIsUserFavorite(destination.users_favorite.indexOf(user._id) !== -1);
  }, [destination.users_favorite, user._id]);
  async function handleAddToFavorites(e) {
    if (loading) return;
    setLoading(true);
    await toggleUserFavoriteDestination(destination._id, user._id);
    await getData();
    setLoading(false);
    // State will update via useEffect when parent passes new destination prop
  }
  return (
    <div>
      <button
        className="btn btn-light my-4 add-to-fav-btn"
        onClick={handleAddToFavorites}
        onMouseEnter={() => setFavHover(true)}
        onMouseLeave={() => setFavHover(false)}
        disabled={loading}
        aria-busy={loading}
      >
        {!isUserFavorite
          ? lang.en.ADD_FAVORITE_DEST
          : favHover
            ? lang.en.UNFAVORITE
            : lang.en.FAVORITED}
      </button>
    </div>
  );
}
