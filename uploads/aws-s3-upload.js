// ref: ga-wdi-boston/express-multer-upload-api
require("dotenv").config();

const AWS = require("aws-sdk");
const slugify = require("slugify");
const path = require("path");

AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

const fs = require("fs");
const mime = require("mime-types");

const sanitizeFileName = require('./sanitize-filename');
const s3Upload = function (file, originalName, newName) {
  // Validate file path to prevent path traversal attacks
  if (!file || typeof file !== 'string') {
    throw new Error('Invalid file path');
  }

  // Resolve the path and ensure it's within the expected directory
  const resolvedPath = path.resolve(file);
  const uploadDir = path.resolve('./uploads'); // Assuming uploads are in ./uploads

  // Check if the resolved path is within the upload directory
  if (!resolvedPath.startsWith(uploadDir)) {
    throw new Error('Invalid file path - path traversal detected');
  }

  // Sanitize user-controlled file names
  newName = sanitizeFileName(slugify(newName, { lower: true }));
  const bucketName = process.env.BUCKET_NAME;
  console.log("file is ", file);
  const contentType = mime.lookup(originalName);
  const extension = mime.extension(contentType);
  const stream = fs.createReadStream(file);
  const params = {
    Bucket: bucketName,
    Key: `${newName}.${extension}`,
    Body: stream,
    ContentType: contentType,
  };
  return new Promise((resolve, reject) => {
    s3.upload(params, function (err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

module.exports = s3Upload;
