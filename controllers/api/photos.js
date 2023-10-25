const Photo = require("../../models/photo");

async function createPhoto(req, res) {
  try {
    const photo = await Photo.create(req.body);
    return res.json(photo);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updatePhoto(req, res) {
  try {
    const photo = await Photo.findByIdAndUpdate(req.body);
    return res.json(photo);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deletePhoto(req, res) {
  try {
    const photo = await Photo.findByIdAndDelete(req.body);
    return res.json(photo);
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create: createPhoto,
  delete: deletePhoto,
  update: updatePhoto,
};
