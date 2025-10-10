const Photo = require("../../models/photo");
const s3Upload = require("../../uploads/aws-s3-upload");

async function createPhoto(req, res) {
  let rand = Math.ceil(Math.random() * 500);
  try {
    req.body.user = req.user._id;
    req.body.photo_credit = req.body.photo_credit
      ? req.body.photo_credit
      : "Biensperience";

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    s3Upload(
      req.file.path,
      req.file.originalname,
      `${rand}-${req.body.name ? req.body.name : "Biensperience"}`
    )
      .then((response) => {
        console.log("S3 upload successful:", response.Location);
        return Photo.create({
          photo_credit: req.body.photo_credit,
          photo_credit_url: req.body.photo_credit_url,
          url: response.Location,
          user: req.user._id,
        });
      })
      .then((upload) => {
        res.status(201).json({ upload: upload.toObject() });
      })
      .catch((error) => {
        console.error("Photo upload error:", error);
        res.status(500).json({ error: 'Failed to upload photo' });
      });
  } catch (err) {
    console.error("Photo creation error:", err);
    res.status(400).json({ error: 'Failed to create photo' });
  }
}

async function updatePhoto(req, res) {
  try {
    let photo = await Photo.findById(req.params.id).populate("user");
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (req.user._id !== photo.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to update this photo' });
    }
    photo = Object.assign(photo, req.body);
    await photo.save();
    return res.status(200).json(photo);
  } catch (err) {
    console.error('Update photo error:', err);
    res.status(400).json({ error: 'Failed to update photo' });
  }
}

async function deletePhoto(req, res) {
  try {
    const photo = await Photo.findById(req.params.id).populate("user");
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (req.user._id !== photo.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized to delete this photo' });
    }
    await photo.deleteOne();
    return res.status(200).end();
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(400).json({ error: 'Failed to delete photo' });
  }
}

module.exports = {
  create: createPhoto,
  delete: deletePhoto,
  update: updatePhoto,
};
