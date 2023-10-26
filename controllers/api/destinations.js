const Destination = require("../../models/destination");

async function index(req, res) {
  try {
    const destinations = await Destination.find({});
    return res.json(destinations);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function createDestination(req, res) {
  try {
    const destination = await Destination.create(req.body);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function showDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateDestination(req, res) {
  try {
    const destination = await Destination.findByIdAndUpdate(req.params.id, req.body);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deleteDestination(req, res) {
  try {
    const destination = await Destination.findByIdAndDelete(req.params.id);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create: createDestination,
  show: showDestination,
  update: updateDestination,
  delete: deleteDestination,
  index
};
