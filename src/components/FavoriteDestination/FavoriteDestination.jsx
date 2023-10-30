import "./FavoriteDestination.css";
import { useState } from "react";
import {
  showDestination,
  toggleUserFavoriteDestination,
} from "../../utilities/destinations-api";

export default function FavoriteDestination({ destination, user }) {
  const [isUserFavorite, setIsUserFavorite] = useState(false);
  async function handleAddToFavorites(e) {
    await toggleUserFavoriteDestination(destination._id, user._id);
    console.log(destination, user)
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
