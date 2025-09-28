import "./FavoriteDestination.css";
import "./FavoriteDestination.css";
import { useState, useEffect } from "react";
import {
  showDestination,
  toggleUserFavoriteDestination,
} from "../../utilities/destinations-api";

export default function FavoriteDestination({ destination, user, getData }) {
  const [isUserFavorite, setIsUserFavorite] = useState(false);
  useEffect(() => {
    setIsUserFavorite(destination.users_favorite.indexOf(user._id) !== -1);
  }, []);
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
