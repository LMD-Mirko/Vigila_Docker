const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Logger de requests
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const dt = Date.now() - t0;
    console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${dt}ms)`);
  });
  next();
});

function mask(v) {
  if (!v) return v;
  return v.length <= 4 ? '****' : v.slice(0, 2) + '****' + v.slice(-2);
}

function logStartupEnv() {
  console.log('[ENV] NODE_ENV =', process.env.NODE_ENV || 'undefined');
  console.log('[ENV] PORT =', process.env.PORT || 'undefined');
  console.log('[ENV] MYSQLHOST =', process.env.MYSQLHOST || process.env.DB_HOST || 'undefined');
  console.log('[ENV] MYSQLPORT =', process.env.MYSQLPORT || process.env.DB_PORT || 'undefined');
  console.log('[ENV] MYSQLUSER =', process.env.MYSQLUSER || process.env.DB_USER || 'undefined');
  console.log('[ENV] MYSQLDATABASE =', process.env.MYSQLDATABASE || process.env.DB_NAME || 'undefined');
  console.log('[ENV] MYSQLPASSWORD =', (process.env.MYSQLPASSWORD || process.env.DB_PASSWORD) ? mask(process.env.MYSQLPASSWORD || process.env.DB_PASSWORD) : 'undefined');
  console.log('[ENV] S3_ENDPOINT =', process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'undefined');
}

// Configuración de Multer para almacenar archivos temporalmente
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB límite
});

// Cliente MinIO (simulación de AWS S3)
// En Railway no existe servicio "storage" automáticamente.
// Soportamos variables estándar y, si no existen, omitimos la inicialización.
const s3EndpointRaw = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT; // ej: http://storage:9000
if (s3EndpointRaw) {
  console.log(`[INFO] S3_ENDPOINT detectado: ${s3EndpointRaw}`);
} else {
  console.log('[INFO] S3_ENDPOINT no establecido; se desactiva MinIO.');
}
const s3Port = parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000', 10);
const s3AccessKey = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'admin';
const s3SecretKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'admin123';

let minioClient = null;
if (s3EndpointRaw) {
  // Normalizar endpoint: quitar protocolo, puerto, path y trailing slash
  const withoutProto = s3EndpointRaw.replace('http://', '').replace('https://', '');
  const withoutPath = withoutProto.split('/')[0];
  const hostOnly = withoutPath.includes(':') ? withoutPath.split(':')[0] : withoutPath;
  minioClient = new Minio.Client({
    endPoint: hostOnly,
    port: s3Port,
    useSSL: false,
    accessKey: s3AccessKey,
    secretKey: s3SecretKey
  });
  console.log('[MINIO] Configurado host=', hostOnly, 'port=', s3Port);
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
    console.log('[DB] Conectando a', dbConfig.host, dbConfig.port || 3306, 'DB=', dbConfig.database, 'User=', dbConfig.user);
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
    console.error('[ERROR] Error conectando a MySQL:', error && error.message ? error.message : error);
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
    try {
      await minioClient.getBucketTagging('videos');
    } catch (e) {
      console.log('[MINIO] TagSet no existe (esperado si nunca se configuró).');
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
    uptimeSec: Math.round(process.uptime()),
    aws_services: {
      ec2: 'simulado (Docker container)',
      rds: 'simulado (MySQL)',
      s3: 'simulado (MinIO)'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/healthz', async (req, res) => {
  const health = { ok: true, db: false, s3: !!minioClient };
  try {
    if (db) {
      await db.query('SELECT 1');
      health.db = true;
    }
  } catch (e) {
    health.ok = false;
  }
  res.status(health.ok ? 200 : 503).json(health);
});

// Endpoint: Subir video
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de video' });
    }

    console.log('[INFO] Video recibido:', req.file.originalname, '| path:', req.file.path, '| size:', req.file.size);

    // Subir a MinIO (S3 simulado) si está configurado; si no, guardamos solo metadata local
    const objectName = `videos/${Date.now()}-${req.file.originalname}`;
    if (minioClient) {
      try {
        await minioClient.fPutObject('videos', objectName, req.file.path, {
          'Content-Type': req.file.mimetype
        });
        console.log('[OK] Video subido a MinIO (S3):', objectName);
      } catch (err) {
        console.error('[ERROR] fPutObject MinIO:', err && err.message ? err.message : err);
        return res.status(502).json({ error: 'Error subiendo a almacenamiento: ' + (err && err.message ? err.message : String(err)) });
      }
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
  logStartupEnv();
  
  // Inicializar servicios
  await initDatabase();
  await initStorage();
  
  console.log('[OK] Todos los servicios AWS simulados están listos');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] UncaughtException:', err);
});

