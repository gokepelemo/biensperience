const Destination = require("../../models/destination");
const User = require("../../models/user");

async function index(req, res) {
  try {
    const destinations = await Destination.find({}).populate("photo");
    res.status(200).json(destinations);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createDestination(req, res) {
  try {
    req.body.user = req.user._id;
    const destination = await Destination.create(req.body);
    res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function showDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate(
      "photo"
    );
    res.status(200).json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateDestination(req, res) {
  try {
    let destination = await Destination.findById(req.params.id).populate(
      "user"
    );
    if (req.user._id !== destination.user._id) res.status(401).end();
    destination = Object.assign(destination, req.body);
    destination.save();
    res.status(200).json(destination);
  } catch (err) {
    res.status(400).json(err);
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
    res.status(400).json(err);
  }
}

async function toggleUserFavoriteDestination(req, res) {
  try {
    let destination = await Destination.findById(req.params.destinationId);
    const user = await User.findById(req.params.userId);
    const idx = destination.users_favorite.indexOf(user._id);
    if (idx === -1) {
      destination.users_favorite.push(user._id);
      destination.save();
      res.status(201).json(destination);
    } else {
      destination.users_favorite.splice(idx, 1);
      destination.save();
      res.status(200).json(destination);
    }
  } catch (err) {
    res.status(400).json(err);
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
