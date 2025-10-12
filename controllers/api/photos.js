const Photo = require("../../models/photo");
const { s3Upload, s3Delete } = require("../../uploads/aws-s3-upload");
const fs = require("fs");
const path = require("path");

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

    // Delete from S3 if the photo URL is an S3 URL
    if (photo.url && photo.url.includes('amazonaws.com')) {
      try {
        await s3Delete(photo.url);
        console.log('Successfully deleted photo from S3:', photo.url);
      } catch (s3Error) {
        console.error('Failed to delete from S3:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete local file if it exists (for photos that were uploaded but not yet moved to S3)
    // Extract filename from URL or use s3_key if available
    if (photo.s3_key || photo.url) {
      try {
        // Try to find local file in uploads/images directory
        const filename = photo.s3_key || path.basename(new URL(photo.url).pathname);
        const localPath = path.join(__dirname, '../../uploads/images', filename);
        
        // Check if file exists before attempting deletion
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          console.log('Successfully deleted local file:', localPath);
        }
      } catch (fsError) {
        console.error('Failed to delete local file:', fsError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await photo.deleteOne();
    console.log('Successfully deleted photo from database:', req.params.id);
    
    return res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(400).json({ error: 'Failed to delete photo' });
  }
}

async function createPhotoFromUrl(req, res) {
  try {
    req.body.user = req.user._id;

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const photo = await Photo.create({
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url,
      url: url,
      user: req.user._id,
    });

    res.status(201).json({ upload: photo.toObject() });
  } catch (err) {
    console.error("Photo URL creation error:", err);
    res.status(400).json({ error: 'Failed to create photo from URL' });
  }
}

async function createPhotoBatch(req, res) {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadPromises = req.files.map((file, index) => {
      const rand = Math.ceil(Math.random() * 500);
      const name = req.body.name || "Biensperience";
      
      return s3Upload(
        file.path,
        file.originalname,
        `${rand}-${name}-${index}`
      )
        .then((response) => {
          return Photo.create({
            photo_credit: req.body.photo_credit || 'Biensperience',
            photo_credit_url: req.body.photo_credit_url || '',
            url: response.Location,
            user: req.user._id,
          });
        });
    });

    const photos = await Promise.all(uploadPromises);
    const photoObjects = photos.map(photo => photo.toObject());
    
    res.status(201).json({ uploads: photoObjects });
  } catch (err) {
    console.error("Batch photo upload error:", err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
}

module.exports = {
  create: createPhoto,
  createBatch: createPhotoBatch,
  createFromUrl: createPhotoFromUrl,
  delete: deletePhoto,
  update: updatePhoto,
};
