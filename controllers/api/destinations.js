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
    let destination = await Destination.findById(req.params.id).populate(
      "user"
    );
    if (req.user._id !== destination.user._id) res.status(401).end();

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
    let destination = await Destination.findById(req.params.id).populate(
      "user"
    );
    if (req.user._id !== destination.user._id) res.status(401).end();
    destination.deleteOne();
    res.status(200).json(destination);
  } catch (err) {
    console.error('Error deleting destination:', err);
    res.status(400).json({ error: 'Failed to delete destination' });
  }
}

async function toggleUserFavoriteDestination(req, res) {
  try {
    let destination = await Destination.findById(req.params.destinationId);
    const user = await User.findById(req.params.userId);
    const idx = destination.users_favorite.indexOf(user._id);
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

module.exports = {
  create: createDestination,
  show: showDestination,
  update: updateDestination,
  delete: deleteDestination,
  toggleUserFavoriteDestination,
  index,
};
