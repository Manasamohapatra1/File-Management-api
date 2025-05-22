const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const sharedKeyCredential = new StorageSharedKeyCredential(
  accountName,
  accountKey
);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);
const containerClient = blobServiceClient.getContainerClient(containerName);
async function uploadFile(file) {
  const blobName = file.originalname; // preserve original name
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadFile(file.path);
  return blobName; // Return name for download
}
async function listFiles() {
  let files = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    files.push(blob.name);
  }
  return files;
}
async function streamFile(filename, res) {
  const blobClient = containerClient.getBlobClient(filename);
  if (!(await blobClient.exists())) {
    throw new Error("File not found");
  }

  const downloadResponse = await blobClient.download();

  // Set headers to download
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"`
  );

  // Pipe stream
  downloadResponse.readableStreamBody.pipe(res);
}
async function deleteFile(filename) {
  const blobClient = containerClient.getBlobClient(filename);
  await blobClient.delete();
}

module.exports = {
  uploadFile,
  listFiles,
  streamFile,
  deleteFile,
};
