const Destination = require("../../models/destination");

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
    const destination = await Destination.findById(req.body);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updateDestination(req, res) {
  try {
    const destination = await Destination.findByIdAndUpdate(req.body);
    return res.json(destination);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deleteDestination(req, res) {
  try {
    const destination = await Destination.findByIdAndDelete(req.body);
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
};
