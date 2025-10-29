FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache curl

# Crear package.json directamente (no depende de archivos externos)
RUN cat > package.json << 'PKGEOF'
{
  "name": "vigila-backend",
  "version": "1.0.0",
  "description": "Backend para sistema de videovigilancia VIGILA simulando AWS",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "keywords": [
    "videovigilancia",
    "aws",
    "docker",
    "nodejs"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.6.5",
    "minio": "^7.1.3",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
PKGEOF

# Instalar dependencias
RUN npm install --only=production

# Crear index.js directamente
RUN cat > index.js << 'IDXEOF'
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
const s3Endpoint = process.env.S3_ENDPOINT || 'http://storage:9000';
const endPoint = s3Endpoint.replace('http://', '').replace('https://', '').replace(':9000', '');

const minioClient = new Minio.Client({
  endPoint: endPoint || 'storage',
  port: 9000,
  useSSL: false,
  accessKey: process.env.S3_ACCESS_KEY || 'admin',
  secretKey: process.env.S3_SECRET_KEY || 'admin123'
});

// Conexión a la base de datos MySQL (simulación de AWS RDS)
const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'vigila'
};

let db;

// Inicializar conexión a la base de datos
async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('[OK] Conectado a MySQL (RDS simulado)');

    // Crear tabla si no existe
    await db.execute(\`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        s3_key VARCHAR(255) NOT NULL,
        size INT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    \`);
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
    const objectName = \`videos/\${Date.now()}-\${req.file.originalname}\`;
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
    
    res.setHeader('Content-Disposition', \`attachment; filename="\${video.filename}"\`);
    stream.pipe(res);
  } catch (error) {
    console.error('[ERROR] Error descargando video:', error);
    res.status(500).json({ error: 'Error descargando video' });
  }
});

// Endpoint: Estadísticas del sistema
app.get('/stats', async (req, res) => {
  try {
    const [rows] = await db.execute(\`
      SELECT 
        COUNT(*) as total_videos,
        SUM(size) as total_size,
        AVG(size) as avg_size
      FROM videos
    \`);
    
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
  console.log(\`[INFO] Servidor VIGILA activo en puerto \${PORT}\`);
  console.log(\`[INFO] Accede en: http://localhost:\${PORT}\`);
  
  // Inicializar servicios
  await initDatabase();
  await initStorage();
  
  console.log('[OK] Todos los servicios AWS simulados están listos');
});
IDXEOF

# Crear directorio para uploads
RUN mkdir -p uploads && chmod 777 uploads

# Exponer puerto
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Comando para iniciar la aplicación
CMD ["node", "index.js"]
