// ref: ga-wdi-boston/express-multer-upload-api
require("dotenv").config();

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const slugify = require("slugify");
const path = require("path");

// Create S3 client with v3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

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
  const key = `${newName}.${extension}`;
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: stream,
    ContentType: contentType,
  };
  
  // Use async/await with v3 SDK
  return (async () => {
    try {
      const command = new PutObjectCommand(params);
      const data = await s3Client.send(command);
      
      // AWS SDK v3 doesn't return Location, so construct it manually
      const region = process.env.AWS_REGION || "us-east-1";
      const location = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
      
      // Add Location to response for backward compatibility
      data.Location = location;
      
      console.log('S3 upload successful:', location);
      return data;
    } catch (err) {
      console.error('S3 upload error:', err);
      throw err;
    }
  })();
};

/**
 * Delete a file from S3 bucket
 * @param {string} fileUrl - The full S3 URL or just the key
 * @returns {Promise} Resolves when file is deleted
 */
const s3Delete = function (fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw new Error('Invalid file URL');
  }

  const bucketName = process.env.BUCKET_NAME;
  
  // Extract the key from the full URL if needed
  // URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
  // or: https://s3.<region>.amazonaws.com/<bucket>/<key>
  let key = fileUrl;
  
  try {
    const url = new URL(fileUrl);
    const pathname = url.pathname;
    
    // Remove leading slash and bucket name if present
    key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    
    // If the bucket name is in the path, remove it
    if (key.startsWith(`${bucketName}/`)) {
      key = key.substring(bucketName.length + 1);
    }
  } catch (err) {
    // If it's not a valid URL, assume it's already just the key
    console.log('Using fileUrl as key directly:', fileUrl);
  }

  console.log('Deleting from S3:', { bucket: bucketName, key });

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  // Use async/await with v3 SDK
  return (async () => {
    try {
      const command = new DeleteObjectCommand(params);
      const data = await s3Client.send(command);
      console.log('S3 delete successful:', data);
      return data;
    } catch (err) {
      console.error('S3 delete error:', err);
      throw err;
    }
  })();
};

module.exports = { s3Upload, s3Delete };
