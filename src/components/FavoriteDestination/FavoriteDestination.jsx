import "./FavoriteDestination.css";
import "./FavoriteDestination.css";
import { useState, useEffect } from "react";
import {
  toggleUserFavoriteDestination,
} from "../../utilities/destinations-api";

export default function FavoriteDestination({ destination, user, getData }) {
  const [isUserFavorite, setIsUserFavorite] = useState(false);
  useEffect(() => {
    setIsUserFavorite(destination.users_favorite.indexOf(user._id) !== -1);
  }, [destination.users_favorite, user._id]);
  async function handleAddToFavorites(e) {
    let favoriteDestination = await toggleUserFavoriteDestination(
      destination._id,
      user._id
    );
    favoriteDestination
      ? setIsUserFavorite(!isUserFavorite)
      : setIsUserFavorite(false);
    getData();
  }
  return (
    <div>
      <button
        className="btn btn-light my-4 add-to-fav-btn"
        onClick={handleAddToFavorites}
      >
        {!isUserFavorite ? `+ Add to Favorite Destinations` : `❤️`}
      </button>
    </div>
  );
}
