FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache curl

# Crear package.json directamente en el contenedor
RUN echo '{ \
  "name": "vigila-backend", \
  "version": "1.0.0", \
  "main": "index.js", \
  "dependencies": { \
    "express": "^4.18.2", \
    "multer": "^1.4.5-lts.1", \
    "mysql2": "^3.6.5", \
    "minio": "^7.1.3", \
    "dotenv": "^16.4.1" \
  } \
}' > package.json

# Instalar dependencias
RUN npm install --only=production

# Crear index.js directamente
RUN echo 'const express = require("express"); \
const multer = require("multer"); \
const mysql = require("mysql2/promise"); \
const Minio = require("minio"); \
const fs = require("fs"); \
require("dotenv").config(); \
const app = express(); \
app.use(express.json()); \
const upload = multer({ dest: "uploads/", limits: { fileSize: 100 * 1024 * 1024 } }); \
const s3Endpoint = process.env.S3_ENDPOINT || "http://storage:9000"; \
const endPoint = s3Endpoint.replace("http://", "").replace("https://", "").replace(":9000", ""); \
const minioClient = new Minio.Client({ \
  endPoint: endPoint || "storage", \
  port: 9000, \
  useSSL: false, \
  accessKey: process.env.S3_ACCESS_KEY || "admin", \
  secretKey: process.env.S3_SECRET_KEY || "admin123" \
}); \
const dbConfig = { \
  host: process.env.DB_HOST || "db", \
  user: process.env.DB_USER || "root", \
  password: process.env.DB_PASSWORD || "root", \
  database: process.env.DB_NAME || "vigila" \
}; \
let db; \
async function initDatabase() { \
  try { \
    db = await mysql.createConnection(dbConfig); \
    console.log("[OK] Conectado a MySQL"); \
    await db.execute(`CREATE TABLE IF NOT EXISTS videos ( \
      id INT AUTO_INCREMENT PRIMARY KEY, \
      filename VARCHAR(255) NOT NULL, \
      s3_key VARCHAR(255) NOT NULL, \
      size INT, \
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP \
    )`); \
    console.log("[OK] Tabla creada"); \
  } catch (error) { \
    console.error("[ERROR] MySQL:", error.message); \
    setTimeout(initDatabase, 5000); \
  } \
} \
async function initStorage() { \
  try { \
    const bucketName = "videos"; \
    const exists = await minioClient.bucketExists(bucketName); \
    if (!exists) { \
      await minioClient.makeBucket(bucketName); \
      console.log("[OK] Bucket creado"); \
    } \
  } catch (error) { \
    console.error("[ERROR] MinIO:", error.message); \
  } \
} \
app.get("/", (req, res) => { \
  res.json({ \
    service: "VIGILA Backend", \
    status: "active", \
    timestamp: new Date().toISOString() \
  }); \
}); \
app.post("/upload", upload.single("video"), async (req, res) => { \
  try { \
    if (!req.file) return res.status(400).json({ error: "No file" }); \
    const objectName = `videos/${Date.now()}-${req.file.originalname}`; \
    await minioClient.fPutObject("videos", objectName, req.file.path); \
    const [result] = await db.execute("INSERT INTO videos (filename, s3_key, size) VALUES (?, ?, ?)", [req.file.originalname, objectName, req.file.size]); \
    fs.unlinkSync(req.file.path); \
    res.json({ message: "Video uploaded", video: { id: result.insertId, filename: req.file.originalname } }); \
  } catch (error) { \
    res.status(500).json({ error: error.message }); \
  } \
}); \
app.get("/videos", async (req, res) => { \
  try { \
    const [videos] = await db.execute("SELECT * FROM videos ORDER BY upload_date DESC"); \
    res.json({ count: videos.length, videos }); \
  } catch (error) { \
    res.status(500).json({ error: error.message }); \
  } \
}); \
const PORT = process.env.PORT || 4000; \
const HOST = process.env.HOST || "0.0.0.0"; \
app.listen(PORT, HOST, async () => { \
  console.log(`[INFO] Servidor activo en puerto ${PORT}`); \
  await initDatabase(); \
  await initStorage(); \
  console.log("[OK] Servicios listos"); \
});' > index.js

# Crear directorio para uploads
RUN mkdir -p uploads && chmod 777 uploads

# Exponer puerto
EXPOSE 4000

# Comando para iniciar la aplicación
CMD ["node", "index.js"]
