const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuración de Multer para almacenar archivos temporalmente
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB límite
});

// Cliente MinIO (simulación de AWS S3)
const minioClient = new Minio.Client({
  endPoint: process.env.S3_ENDPOINT.replace('http://', '').replace(':9000', ''),
  port: 9000,
  useSSL: false,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY
});

// Conexión a la base de datos MySQL (simulación de AWS RDS)
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

let db;

// Inicializar conexión a la base de datos
async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('[OK] Conectado a MySQL (RDS simulado)');

    // Crear tabla si no existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        s3_key VARCHAR(255) NOT NULL,
        size INT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Tabla de videos creada/verificada');
  } catch (error) {
    console.error('[ERROR] Error conectando a MySQL:', error.message);
    setTimeout(initDatabase, 5000);
  }
}

// Inicializar bucket de MinIO
async function initStorage() {
  try {
    const bucketName = 'videos';
    const exists = await minioClient.bucketExists(bucketName);
    
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log('[OK] Bucket "videos" creado en MinIO (S3 simulado)');
    } else {
      console.log('[OK] Bucket "videos" ya existe en MinIO');
    }
  } catch (error) {
    console.error('[ERROR] Error inicializando MinIO:', error.message);
  }
}

// Endpoint: Verificar estado del servicio
app.get('/', (req, res) => {
  res.json({
    service: 'VIGILA Backend',
    status: 'active',
    aws_services: {
      ec2: 'simulado (Docker container)',
      rds: 'simulado (MySQL)',
      s3: 'simulado (MinIO)'
    },
    timestamp: new Date().toISOString()
  });
});

// Endpoint: Subir video
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de video' });
    }

    console.log('[INFO] Video recibido:', req.file.originalname);

    // Subir a MinIO (S3 simulado)
    const objectName = `videos/${Date.now()}-${req.file.originalname}`;
    await minioClient.fPutObject('videos', objectName, req.file.path, {
      'Content-Type': req.file.mimetype
    });
    console.log('[OK] Video subido a MinIO (S3):', objectName);

    // Guardar metadata en MySQL (RDS simulado)
    const [result] = await db.execute(
      'INSERT INTO videos (filename, s3_key, size) VALUES (?, ?, ?)',
      [req.file.originalname, objectName, req.file.size]
    );
    console.log('[OK] Metadata guardada en MySQL (RDS)');

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Video subido correctamente',
      video: {
        id: result.insertId,
        filename: req.file.originalname,
        s3_key: objectName,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('[ERROR] Error subiendo video:', error);
    res.status(500).json({ error: 'Error subiendo video: ' + error.message });
  }
});

// Endpoint: Listar videos
app.get('/videos', async (req, res) => {
  try {
    const [videos] = await db.execute('SELECT * FROM videos ORDER BY upload_date DESC');
    res.json({
      count: videos.length,
      videos: videos
    });
  } catch (error) {
    console.error('[ERROR] Error obteniendo videos:', error);
    res.status(500).json({ error: 'Error obteniendo videos' });
  }
});

// Endpoint: Descargar video desde S3
app.get('/videos/:id/download', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM videos WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Video no encontrado' });
    }

    const video = rows[0];
    const stream = await minioClient.getObject('videos', video.s3_key);
    
    res.setHeader('Content-Disposition', `attachment; filename="${video.filename}"`);
    stream.pipe(res);
  } catch (error) {
    console.error('[ERROR] Error descargando video:', error);
    res.status(500).json({ error: 'Error descargando video' });
  }
});

// Endpoint: Estadísticas del sistema
app.get('/stats', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        COUNT(*) as total_videos,
        SUM(size) as total_size,
        AVG(size) as avg_size
      FROM videos
    `);
    
    res.json({
      statistics: rows[0]
    });
  } catch (error) {
    console.error('[ERROR] Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`[INFO] Servidor VIGILA activo en puerto ${PORT}`);
  console.log(`[INFO] Accede en: http://localhost:${PORT}`);
  
  // Inicializar servicios
  await initDatabase();
  await initStorage();
  
  console.log('[OK] Todos los servicios AWS simulados están listos');
});

