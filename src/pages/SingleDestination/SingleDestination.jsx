import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";

export default function SingleDestination() {
  const [destination, setDestination] = useState({});
  const { destinationId } = useParams();
  useEffect(() => {
    async function getDestination() {
      let destinationData = await showDestination(destinationId);
      setDestination(destinationData);
    }
    getDestination();
  }, []);
  return (
    <>
      <h1>{destination.name}</h1>
    </>
  );
}
