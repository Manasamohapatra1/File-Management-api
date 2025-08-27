const express = require("express");
const multer = require("multer");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require("dotenv").config();

const azure = require("./upload/azureBlobService");

const app = express();
const PORT = process.env.PORT || 8080;

// Basic health check (Railway needs a fast 200)
app.get("/", (_req, res) => res.status(200).send("OK"));

// CORS + JSON
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// Multer (memory → direct to Azure)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Swagger (OpenAPI 3)
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "File Management API", version: "1.0.0" },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ["./index.js"],
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /files:
 *   post:
 *     summary: Upload a file
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
 *       201:
 *         description: File uploaded
 */
app.post("/files", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const saved = await azure.uploadFile(req.file);
    res.status(201).json({ message: "File uploaded", file: saved });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /files:
 *   get:
 *     summary: List files
 *     responses:
 *       200:
 *         description: List of files
 */
app.get("/files", async (_req, res, next) => {
  try {
    res.status(200).json(await azure.listFiles());
  } catch (err) {
    next(err);
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
 *     responses:
 *       200:
 *         description: File stream
 *       404:
 *         description: Not found
 */
app.get("/files/:filename", async (req, res, next) => {
  try {
    await azure.streamFile(req.params.filename, res);
  } catch (err) {
    next(err);
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
 *     responses:
 *       200:
 *         description: File deleted
 *       404:
 *         description: Not found
 */
app.delete("/files/:filename", async (req, res, next) => {
  try {
    await azure.deleteFile(req.params.filename);
    res.status(200).json({ message: "File deleted" });
  } catch (err) {
    next(err);
  }
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const code = err.message === "File not found" ? 404 : 500;
  res.status(code).json({ message: err.message || "Server error" });
});

app.listen(PORT, "0.0.0.0", () => console.log(`HTTP on ${PORT}`));
