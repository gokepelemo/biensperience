const Photo = require("../../models/photo");
const s3Upload = require("../../uploads/aws-s3-upload");

async function createPhoto(req, res) {
  let rand = Math.ceil(Math.random() * 500);
  try {
    req.body.user = req.user._id;
    req.body.photo_credit = req.body.photo_credit
      ? req.body.photo_credit
      : "Biensperience";
    s3Upload(
      req.file.path,
      req.file.originalname,
      `${rand}-${req.body.name ? req.body.name : "Biensperience"}`
    )
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
    const photo = await Photo.findById(req.params.id).populate("user");
    if (req.user._id !== photo.user._id) res.status(401).end();
    photo = Object.assign(photo, req.body);
    photo.save();
    return res.status(200).json(photo);
  } catch (err) {
    res.status(400).json(err);
  }
}

async function deletePhoto(req, res) {
  try {
    const photo = await Photo.findById(req.params.id).populate("user");
    if (req.user._id !== photo.user._id) res.status(401).end();
    await photo.deleteOne();
    return res.status(410).end();
  } catch (err) {
    res.status(400).json(err);
  }
}

module.exports = {
  create: createPhoto,
  delete: deletePhoto,
  update: updatePhoto,
};
