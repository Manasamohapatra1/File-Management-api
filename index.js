const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const azureBlobService = require("./upload/azureBlobService");

dotenv.config();
const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for Swagger testing
app.use(express.json());

// Multer setup
const upload = multer({ dest: "uploads/" }); // temp storage

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "File Management API",
      version: "1.0.0",
      description: "API for managing files with Azure Blob Storage",
    },
    servers: [{ url: "http://localhost:3000" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a file
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filename = await azureBlobService.uploadFile(req.file);
    res.status(200).json({ message: "File uploaded", filename });
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

/**
 * @swagger
 * /files:
 *   get:
 *     summary: List files
 *     responses:
 *       200:
 *         description: A list of files
 */
app.get("/files", async (req, res) => {
  try {
    const files = await azureBlobService.listFiles();
    res.status(200).json(files);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to list files", error: err.message });
  }
});

/**
 * @swagger
 * /files/{filename}:
 *   get:
 *     summary: Download a file
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: File name to download
 *     responses:
 *       200:
 *         description: PDF File download
 */
app.get("/files/:filename", async (req, res) => {
  try {
    await azureBlobService.streamFile(req.params.filename, res);
  } catch (err) {
    res.status(500).json({ message: "Download failed", error: err.message });
  }
});

/**
 * @swagger
 * /files/{filename}:
 *   delete:
 *     summary: Delete a file
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: File name to delete
 *     responses:
 *       200:
 *         description: File deleted
 */
app.delete("/files/:filename", async (req, res) => {
  try {
    await azureBlobService.deleteFile(req.params.filename);
    res.status(200).json({ message: "File deleted" });
  } catch (err) {
    res.status(500).json({ message: "Deletion failed", error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
