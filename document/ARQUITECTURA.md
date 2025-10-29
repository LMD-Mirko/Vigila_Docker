# 🏗️ Arquitectura del Sistema VIGILA

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DOCKER HOST                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Docker Network: vigila-network                  │   │
│  │                      (Bridge Network)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         │                    │                    │                 │
│         ▼                    ▼                    ▼                 │
│  ┌─────────────┐      ┌─────────────┐     ┌─────────────┐         │
│  │   Backend   │◄────►│     RDS     │     │     S3      │         │
│  │ (Node.js)   │      │   (MySQL)   │     │  (MinIO)    │         │
│  │             │      │             │     │             │         │
│  │  Port 4000  │      │  Port 3307  │     │ Port 9000/  │         │
│  │             │      │             │     │     9090    │         │
│  └─────────────┘      └─────────────┘     └─────────────┘         │
│         │                                                           │
│         │                                                           │
│         │ Volume: s3_data                                          │
│         │ Volume: db_data                                          │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          │ Exposed Ports
          │
          ▼
    ┌─────────────┐
    │   Usuario   │
    │  (Cliente)  │
    └─────────────┘
```

## Mapeo de Servicios AWS

### 1. EC2 (Elastic Compute Cloud) → Contenedor Node.js

**Función:** Servidor de aplicaciones backend

**Implementación:** Docker container con Node.js

**Responsabilidades:**
- Procesar solicitudes HTTP/API
- Manejar subida de archivos de video
- Comunicarse con RDS para guardar metadata
- Comunicarse con S3 para almacenar videos
- Servir archivos de video mediante descarga

**Configuración:**
- Imagen base: `node:18-alpine`
- Puerto expuesto: `4000`
- Volúmenes: `./backend:/app`
- Red interna: `vigila-network`

### 2. RDS (Relational Database Service) → MySQL 8

**Función:** Base de datos relacional para metadata

**Implementación:** Contenedor MySQL

**Responsabilidades:**
- Almacenar información de videos (metadata)
- Tracking de uploads
- Consultas y reportes
- Backup de información crítica

**Esquema de Base de Datos:**
```sql
CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  s3_key VARCHAR(255) NOT NULL,
  size INT,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Configuración:**
- Imagen: `mysql:8`
- Puerto expuesto: `3307` (interno: 3306)
- Usuario: `root`
- Contraseña: `root` (NO usar en producción)
- Base de datos: `vigila`
- Volumen persistente: `db_data`

### 3. S3 (Simple Storage Service) → MinIO

**Función:** Almacenamiento de objetos (videos)

**Implementación:** Contenedor MinIO (S3-compatible)

**Responsabilidades:**
- Almacenar archivos de video
- Gestión de buckets
- Acceso a archivos mediante API
- Optimización de almacenamiento

**Configuración:**
- Imagen: `minio/minio`
- Puerto API: `9000`
- Puerto Console: `9090`
- Credenciales: `admin` / `admin123`
- Bucket predeterminado: `videos`
- Volumen persistente: `s3_data`

### 4. IAM (Identity and Access Management) → Archivo .env

**Función:** Gestión de credenciales y seguridad

**Implementación:** Variables de entorno en archivo `.env`

**Responsabilidades:**
- Centralizar credenciales sensibles
- Controlar acceso a servicios
- Facilitar rotación de credenciales
- Evitar hardcoding de passwords

**Variables de Entorno:**
```env
DB_HOST=db
DB_USER=root
DB_PASSWORD=root
DB_NAME=vigila
S3_ACCESS_KEY=admin
S3_SECRET_KEY=admin123
```

### 5. Systems Manager → Docker Compose

**Función:** Automatización y orquestación

**Implementación:** Archivo `docker-compose.yml`

**Responsabilidades:**
- Orquestar todos los servicios
- Definir dependencias entre contenedores
- Gestionar volúmenes
- Configurar redes internas
- Escalar servicios horizontalmente

## Flujo de Datos

### 1. Flujo de Subida de Video

```
Usuario → Backend → MySQL (metadata) + MinIO (archivo)
         ↓
    Response JSON
```

**Paso a Paso:**
1. Usuario envía POST /upload con archivo de video
2. Backend recibe archivo con Multer
3. Backend sube archivo a MinIO (S3 simulado)
4. Backend guarda metadata en MySQL (RDS simulado)
5. Backend elimina archivo temporal
6. Backend responde con confirmación

### 2. Flujo de Descarga de Video

```
Usuario → Backend → MySQL (buscar metadata) → MinIO (obtener archivo) → Usuario
```

**Paso a Paso:**
1. Usuario solicita GET /videos/:id/download
2. Backend consulta MySQL para obtener s3_key
3. Backend obtiene archivo de MinIO
4. Backend sirve archivo al usuario

### 3. Flujo de Listado

```
Usuario → Backend → MySQL (query) → JSON Response
```

## Componentes Técnicos

### Backend Stack

- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Upload:** Multer
- **Database:** mysql2
- **Storage:** MinIO Client (compatible S3)
- **Environment:** dotenv

### Database

- **Engine:** MySQL 8.0
- **Protocol:** TCP/IP
- **Persistence:** Docker Volume

### Object Storage

- **Service:** MinIO
- **Protocol:** S3 Compatible API
- **Persistence:** Docker Volume
- **UI:** MinIO Console (web)

## Seguridad

### Medidas Implementadas

1. **Red Interna:**
   - Todos los contenedores en red privada
   - No expuestos directamente a internet

2. **Credenciales:**
   - Variables de entorno (.env)
   - No hardcodeadas

3. **Datos:**
   - Volúmenes persistentes
   - Backup automático con Docker

### Recomendaciones para Producción

⚠️ **NO usar en producción:**
- Credenciales por defecto (root/root, admin/admin123)
- Redes públicas sin firewall
- Sin HTTPS/TLS
- Sin encriptación de datos sensibles

✅ **Implementar en producción:**
- Usar AWS IAM real
- Habilitar SSL/TLS
- Implementar rate limiting
- Usar secrets manager
- Habilitar CloudWatch logs
- Configurar VPC apropiadamente

## Escalabilidad

### Escalado Horizontal

```bash
# Escalar backend a 3 instancias
docker compose up -d --scale backend=3
```

Esto simula múltiples instancias EC2 detrás de un load balancer.

### Escalado Vertical

Modificar recursos en `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

## Monitoreo (Opcional)

Para agregar monitoreo tipo CloudWatch:

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

## Costos

### Desarrollo (Local)
- **Costo:** $0 USD
- **AWS Free Tier:** N/A
- **Recursos:** CPU y RAM local

### Producción (AWS Estimado)
- **EC2 t3.micro:** $7-10/mes
- **RDS db.t3.micro:** $15-20/mes
- **S3 100GB:** $2-3/mes
- **Total:** ~$25-35 USD/mes

Con AWS Free Tier (primer año): ~$5-10 USD/mes

## Ventajas de esta Arquitectura

✅ **Costo cero en desarrollo**
✅ **Portabilidad** - Corre en cualquier sistema con Docker
✅ **Reproducibilidad** - Mismo entorno cada vez
✅ **Aislamiento** - Servicios aislados entre sí
✅ **Fácil escalado** - Agregar/quitar contenedores
✅ **Rápido deployment** - Un solo comando (`docker compose up`)
✅ **Migración fácil a AWS** - Mismo código, diferente infraestructura

