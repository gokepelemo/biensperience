/**
 * ExperienceHeader Component
 * Displays experience title, photos, and metadata
 */

import { Link } from 'react-router-dom';
import PhotoCard from '../../../components/PhotoCard/PhotoCard';
import { formatCurrency } from '../../../utilities/currency-utils';

export default function ExperienceHeader({
  experience,
  travelTips,
  canEdit
}) {
  if (!experience) return null;

  return (
    <div id="overview" className="experience-header">
      <h1 className="experience-title animation-fade_in">{experience.name}</h1>

      {/* Photos */}
      {experience.photos && experience.photos.length > 0 && (
        <div id="photos" className="row mb-4">
          <div className="col-12">
            <PhotoCard
              photos={experience.photos}
              defaultPhotoId={experience.default_photo_id}
              altText={experience.name}
            />
          </div>
        </div>
      )}

      {/* Destination Link */}
      {experience.destination && (
        <div className="mb-3">
          <strong>Destination: </strong>
          <Link to={`/destinations/${experience.destination._id}`}>
            {experience.destination.name}, {experience.destination.country}
          </Link>
        </div>
      )}

      {/* Description */}
      {experience.description && (
        <div className="mb-4">
          <h3>About</h3>
          <p className="experience-description">{experience.description}</p>
        </div>
      )}

      {/* Cost Estimate */}
      {experience.cost_estimate > 0 && (
        <div className="mb-3">
          <strong>Estimated Cost: </strong>
          {formatCurrency(experience.cost_estimate)}
        </div>
      )}

      {/* Experience Type Tags */}
      {experience.experience_type && experience.experience_type.length > 0 && (
        <div className="mb-3">
          <strong>Type: </strong>
          {experience.experience_type.join(', ')}
        </div>
      )}

      {/* Travel Tips */}
      {travelTips && travelTips.length > 0 && (
        <div id="travel-tips" className="mb-4">
          <h3>Travel Tips</h3>
          <ul className="travel-tips-list">
            {travelTips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Edit Button */}
      {canEdit && (
        <div className="mb-4">
          <Link
            to={`/experiences/${experience._id}/update`}
            className="btn btn-primary"
          >
            Edit Experience
          </Link>
        </div>
      )}
    </div>
  );
}
