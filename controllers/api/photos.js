const Photo = require("../../models/photo");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const handle = require("../../uploads/error-handler");
const customErrors = require("../../uploads/custom-errors");
const handle404 = customErrors.handle404;
const requireOwnership = customErrors.requireOwnership;
const s3Upload = require("../../uploads/aws-s3-upload");

async function createPhoto(req, res) {
  let rand = Math.ceil(Math.random() * 500);
  try {
    req.body.user = req.user._id;
    req.body.photo_credit = req.body.photo_credit ? req.body.photo_credit : "biensperience";
    s3Upload(req.file.path, req.file.originalname, `${rand}-${req.body.name ? req.body.name : "biensperience"}`)
      .then((response) => {
        console.log(response.Location);
        return Photo.create({
          photo_credit: req.body.photo_credit,
          url: response.Location,
          user: req.user._id,
        });
      })
      .then((upload) => {
        res.status(201).json({ upload: upload.toObject() });
      })
      .catch(console.error);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function updatePhoto(req, res) {
  try {
    const photo = await Photo.findByIdAndUpdate(req.params.id, req.body);
    return res.json(photo);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deletePhoto(req, res) {
  try {
    const photo = await Photo.findByIdAndDelete(req.params.id);
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
