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
// En Railway no existe servicio "storage" automáticamente.
// Soportamos variables estándar y, si no existen, omitimos la inicialización.
const s3EndpointRaw = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT; // ej: http://storage:9000
const s3Port = parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000', 10);
const s3AccessKey = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'admin';
const s3SecretKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'admin123';

let minioClient = null;
if (s3EndpointRaw) {
  const sanitized = s3EndpointRaw.replace('http://', '').replace('https://', '');
  const hostOnly = sanitized.includes(':') ? sanitized.split(':')[0] : sanitized;
  minioClient = new Minio.Client({
    endPoint: hostOnly,
    port: s3Port,
    useSSL: false,
    accessKey: s3AccessKey,
    secretKey: s3SecretKey
  });
} else {
  console.log('[INFO] S3_ENDPOINT no definido. Se omitirá la inicialización de MinIO.');
}

// Conexión a la base de datos MySQL (simulación de AWS RDS)
// Soporta variables nativas de Railway MySQL: MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT
const dbConfig = {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'db',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || 'root',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'vigila',
  port: process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : undefined
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
  if (!minioClient) {
    console.log('[INFO] MinIO no configurado. Saltando inicialización de almacenamiento.');
    return;
  }
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

    // Subir a MinIO (S3 simulado) si está configurado; si no, guardamos solo metadata local
    const objectName = `videos/${Date.now()}-${req.file.originalname}`;
    if (minioClient) {
      await minioClient.fPutObject('videos', objectName, req.file.path, {
        'Content-Type': req.file.mimetype
      });
      console.log('[OK] Video subido a MinIO (S3):', objectName);
    } else {
      console.log('[INFO] MinIO no configurado. Se omite subida de objeto, se registrará solo metadata.');
    }

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
    if (!minioClient) {
      return res.status(503).json({ error: 'Almacenamiento no configurado en este despliegue' });
    }
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

