const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
require("dotenv").config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const container = process.env.AZURE_STORAGE_CONTAINER_NAME;

if (!accountName || !accountKey || !container) {
  throw new Error(
    "Missing env vars: AZURE_STORAGE_ACCOUNT_NAME / AZURE_STORAGE_ACCOUNT_KEY / AZURE_STORAGE_CONTAINER_NAME"
  );
}

const creds = new StorageSharedKeyCredential(accountName, accountKey);
const svc = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  creds
);
const containerClient = svc.getContainerClient(container);

async function ensureContainer() {
  // default access is private; do not pass { access: "private" }
  await containerClient.createIfNotExists();
}

function keepOriginalName(name) {
  // sanitize only; keep original to satisfy your request
  return String(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadFile(file) {
  await ensureContainer();
  const blobName = keepOriginalName(file.originalname); // may overwrite same-name files
  const block = containerClient.getBlockBlobClient(blobName);

  await block.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype || "application/octet-stream",
    },
    metadata: { originalname: file.originalname },
  });

  return {
    name: blobName,
    size: file.size,
    contentType: file.mimetype || "application/octet-stream",
  };
}

async function listFiles() {
  await ensureContainer();
  const out = [];
  for await (const b of containerClient.listBlobsFlat({
    includeMetadata: true,
  })) {
    out.push({
      name: b.name,
      size: b.properties.contentLength ?? null,
      contentType: b.properties.contentType ?? null,
      createdOn: b.properties.createdOn ?? null,
    });
  }
  return out;
}

async function streamFile(filename, res) {
  await ensureContainer();
  const blob = containerClient.getBlobClient(filename);
  if (!(await blob.exists())) throw new Error("File not found");

  const dl = await blob.download();
  const ct =
    dl.contentType ||
    dl.headers?.["content-type"] ||
    "application/octet-stream";
  res.setHeader("Content-Type", ct);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"`
  );
  dl.readableStreamBody.pipe(res);
}

async function deleteFile(filename) {
  await ensureContainer();
  const blob = containerClient.getBlobClient(filename);
  if (!(await blob.exists())) throw new Error("File not found");
  await blob.delete();
}

module.exports = { uploadFile, listFiles, streamFile, deleteFile };
