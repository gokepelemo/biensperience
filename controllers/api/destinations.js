const mongoose = require('mongoose');
const Destination = require("../../models/destination");
const User = require("../../models/user");
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function index(req, res) {
  try {
    const destinations = await Destination.find({}).populate("photo");
    res.status(200).json(destinations);
  } catch (err) {
    console.error('Error fetching destinations:', err);
    res.status(400).json({ error: 'Failed to fetch destinations' });
  }
}

async function createDestination(req, res) {
  try {
    req.body.user = req.user._id;

    // Get all destinations to check for fuzzy duplicates
    const allDestinations = await Destination.find({});

    // Check for exact duplicate (case-insensitive)
    const exactDuplicate = await Destination.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
      country: { $regex: new RegExp(`^${escapeRegex(req.body.country)}$`, 'i') }
    });

    if (exactDuplicate) {
      return res.status(409).json({
        error: 'Duplicate destination',
        message: `A destination named "${req.body.name}, ${req.body.country}" already exists. Please choose a different destination.`
      });
    }

    // Check for fuzzy duplicate on name with same country
    const sameCountryDestinations = allDestinations.filter(dest =>
      dest.country.toLowerCase().trim() === req.body.country.toLowerCase().trim()
    );

    const fuzzyDuplicate = findDuplicateFuzzy(
      sameCountryDestinations,
      req.body.name,
      'name',
      85
    );

    if (fuzzyDuplicate) {
      return res.status(409).json({
        error: 'Similar destination exists',
        message: `A similar destination "${fuzzyDuplicate.name}, ${fuzzyDuplicate.country}" already exists. Did you mean to use that instead?`
      });
    }

    const destination = await Destination.create(req.body);
    res.json(destination);
  } catch (err) {
    console.error('Error creating destination:', err);
    res.status(400).json({ error: 'Failed to create destination' });
  }
}

async function showDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate(
      "photo"
    );
    res.status(200).json(destination);
  } catch (err) {
    console.error('Error fetching destination:', err);
    res.status(400).json({ error: 'Failed to fetch destination' });
  }
}

async function updateDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    let destination = await Destination.findById(req.params.id).populate(
      "user"
    );
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    if (req.user._id.toString() !== destination.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to update this destination' });
    }

    // Check for duplicate destination if name or country is being updated
    if ((req.body.name && req.body.name !== destination.name) ||
        (req.body.country && req.body.country !== destination.country)) {
      const checkName = req.body.name || destination.name;
      const checkCountry = req.body.country || destination.country;

      // Check for exact duplicate
      const exactDuplicate = await Destination.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(checkName)}$`, 'i') },
        country: { $regex: new RegExp(`^${escapeRegex(checkCountry)}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (exactDuplicate) {
        return res.status(409).json({
          error: 'Duplicate destination',
          message: `A destination named "${checkName}, ${checkCountry}" already exists. Please choose a different destination.`
        });
      }

      // Check for fuzzy duplicate
      const allDestinations = await Destination.find({ _id: { $ne: req.params.id } });
      const sameCountryDestinations = allDestinations.filter(dest =>
        dest.country.toLowerCase().trim() === checkCountry.toLowerCase().trim()
      );

      const fuzzyDuplicate = findDuplicateFuzzy(
        sameCountryDestinations,
        checkName,
        'name',
        85
      );

      if (fuzzyDuplicate) {
        return res.status(409).json({
          error: 'Similar destination exists',
          message: `A similar destination "${fuzzyDuplicate.name}, ${fuzzyDuplicate.country}" already exists. Did you mean to use that instead?`
        });
      }
    }

    destination = Object.assign(destination, req.body);
    await destination.save();
    res.status(200).json(destination);
  } catch (err) {
    console.error('Error updating destination:', err);
    res.status(400).json({ error: 'Failed to update destination' });
  }
}

async function deleteDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    let destination = await Destination.findById(req.params.id).populate(
      "user"
    );
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    if (req.user._id.toString() !== destination.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to delete this destination' });
    }
    
    await destination.deleteOne();
    res.status(200).json({ message: 'Destination deleted successfully', destination });
  } catch (err) {
    console.error('Error deleting destination:', err);
    res.status(400).json({ error: 'Failed to delete destination' });
  }
}

async function toggleUserFavoriteDestination(req, res) {
  try {
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(req.params.destinationId)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    let destination = await Destination.findById(req.params.destinationId);
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const idx = destination.users_favorite.findIndex(id => id.toString() === user._id.toString());
    if (idx === -1) {
      destination.users_favorite.push(user._id);
      await destination.save();
      res.status(201).json(destination);
    } else {
      destination.users_favorite.splice(idx, 1);
      await destination.save();
      res.status(200).json(destination);
    }
  } catch (err) {
    console.error('Error toggling favorite destination:', err);
    res.status(400).json({ error: 'Failed to toggle favorite destination' });
  }
}

async function addPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate("user");

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    if (req.user._id.toString() !== destination.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this destination' });
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    // Add photo to photos array
    destination.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await destination.save();

    res.status(201).json(destination);
  } catch (err) {
    console.error('Error adding photo to destination:', err);
    res.status(400).json({ error: 'Failed to add photo' });
  }
}

async function removePhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate("user");

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    if (req.user._id.toString() !== destination.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this destination' });
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Remove photo from array
    destination.photos.splice(photoIndex, 1);

    // Adjust default_photo_index if necessary
    if (destination.default_photo_index >= destination.photos.length) {
      destination.default_photo_index = Math.max(0, destination.photos.length - 1);
    }

    await destination.save();

    res.status(200).json(destination);
  } catch (err) {
    console.error('Error removing photo from destination:', err);
    res.status(400).json({ error: 'Failed to remove photo' });
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate("user");

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    if (req.user._id.toString() !== destination.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to modify this destination' });
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    destination.default_photo_index = photoIndex;
    await destination.save();

    res.status(200).json(destination);
  } catch (err) {
    console.error('Error setting default photo:', err);
    res.status(400).json({ error: 'Failed to set default photo' });
  }
}

module.exports = {
  create: createDestination,
  show: showDestination,
  update: updateDestination,
  delete: deleteDestination,
  toggleUserFavoriteDestination,
  index,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
};
