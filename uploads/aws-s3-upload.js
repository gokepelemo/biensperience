// ref: ga-wdi-boston/express-multer-upload-api
"use strict";
require("dotenv").config();

const AWS = require("aws-sdk");
const slugify = require("slugify");

AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

const fs = require("fs");
const mime = require("mime-types");

const s3Upload = function (file, originalName, newName) {
  newName = slugify(newName, {
    lower: true,
  })
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
