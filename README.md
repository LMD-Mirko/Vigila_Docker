# 🎥 VIGILA - Sistema de Videovigilancia en la Nube

## Descripción del Proyecto

**VIGILA** es una simulación completa de infraestructura en la nube usando Docker, que replica los servicios principales de AWS para un sistema de videovigilancia.

### Servicios AWS Simulados

| Servicio AWS | Tecnología | Función |
|--------------|------------|---------|
| **EC2** | Contenedor Node.js | Backend de procesamiento de video |
| **RDS** | MySQL 8 | Base de datos para metadata de videos |
| **S3** | MinIO | Almacenamiento de archivos de video |
| **IAM** | Archivo `.env` | Gestión de credenciales y seguridad |
| **Systems Manager** | Docker Compose | Automatización y orquestación |

## 🚀 Inicio Rápido

### Requisitos Previos

- Docker Desktop instalado y corriendo
- Docker Compose v2+ instalado
- Git (opcional)

### Instalación

1. **Clonar o navegar al proyecto:**
```bash
cd vigila-cloud
```

2. **Levantar todos los servicios:**
```bash
docker compose up -d
```

3. **Verificar que los servicios estén corriendo:**
```bash
docker ps
```

Deberías ver 3 contenedores activos:
- `vigila-backend` (puerto 4000)
- `vigila-db` (puerto 3307)
- `vigila-storage` (puertos 9000 y 9090)

## 📡 API Endpoints

El backend expone los siguientes endpoints:

### **GET /** - Estado del servicio
```bash
curl http://localhost:4000/
```

### **POST /upload** - Subir video
```bash
curl -X POST -F "video=@tu_video.mp4" http://localhost:4000/upload
```

### **GET /videos** - Listar todos los videos
```bash
curl http://localhost:4000/videos
```

### **GET /stats** - Estadísticas del sistema
```bash
curl http://localhost:4000/stats
```

### **GET /videos/:id/download** - Descargar video
```bash
curl http://localhost:4000/videos/1/download -o video_descargado.mp4
```

## 🌐 Interfaces Web

### MinIO Console (S3 simulado)
- **URL:** http://localhost:9090
- **Usuario:** admin
- **Contraseña:** admin123

Aquí puedes ver y gestionar los buckets y archivos (videos) almacenados.

### MySQL (RDS simulado)
- **Host:** localhost
- **Puerto:** 3307
- **Usuario:** root
- **Contraseña:** root
- **Base de datos:** vigila

Usa cualquier cliente MySQL (DBeaver, MySQL Workbench, etc.) para conectarte.

## 🔧 Gestión de Servicios

### Ver logs en tiempo real
```bash
# Ver logs del backend
docker logs -f vigila-backend

# Ver logs de todos los servicios
docker compose logs -f
```

### Detener servicios
```bash
docker compose down
```

### Reiniciar servicios
```bash
docker compose restart
```

### Ver volúmenes (datos persistentes)
```bash
docker volume ls
```

### Escalar el backend (múltiples instancias EC2)
```bash
docker compose up -d --scale backend=3
```

### Eliminar todo (incluyendo datos)
```bash
docker compose down -v
```

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                 Docker Host                    │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Backend     │  │     MySQL    │  │  MinIO   │  │
│  │  (Node.js)   │──│  (RDS sim)   │  │(S3 sim)  │  │
│  │  :4000       │  │    :3306     │  │:9000/9090│  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                     │
│            Docker Network: vigila-network          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 🔐 Seguridad

- Todas las credenciales están en `.env` (simulando IAM)
- Red interna de Docker para comunicación segura
- Variables de entorno para configuración sensible
- `.gitignore` configurado para no subir credenciales

## 💰 Optimización de Costos

Este proyecto simula una infraestructura AWS a **costo cero** para desarrollo y pruebas:

- ✅ Sin costos de EC2
- ✅ Sin costos de RDS
- ✅ Sin costos de S3
- ✅ Sin costos de transferencia de datos
- ✅ Escalable localmente sin costo adicional

## 🎓 Beneficios de esta Simulación

1. **Aprendizaje**: Practica conceptos de AWS sin costo
2. **Desarrollo**: Desarrolla y prueba localmente
3. **Migración Fácil**: Código compatible para migrar a AWS real
4. **CI/CD**: Perfecto para automatización y pruebas
5. **Seguridad**: Entorno aislado y controlado

## 📈 Monitoreo (Opcional)

Para agregar monitoreo tipo CloudWatch:

```bash
# Agregar Prometheus y Grafana al docker-compose.yml
# Ver documentación completa en el proyecto
```

## 🐛 Solución de Problemas

### El backend no puede conectar a la base de datos
```bash
# Verificar que todos los contenedores estén corriendo
docker ps

# Ver logs del contenedor de base de datos
docker logs vigila-db
```

### No puedo acceder a MinIO
```bash
# Verificar que el contenedor esté corriendo en el puerto 9090
docker ps | grep vigila-storage

# Reiniciar el contenedor
docker restart vigila-storage
```

### Los videos no se suben
```bash
# Verificar logs del backend
docker logs -f vigila-backend

# Verificar permisos del directorio uploads
docker exec vigila-backend ls -la uploads
```

## 📝 Notas de Desarrollo

- El código del backend está en `./backend/index.js`
- Los datos de la base de datos persisten en el volumen `db_data`
- Los videos se almacenan en el volumen `s3_data`
- El puerto 4000 está mapeado al backend
- El puerto 3306 está mapeado a MySQL
- Los puertos 9000 y 9090 están mapeados a MinIO

## 📞 Contacto

Para más información sobre la migración a AWS real, consulta la documentación oficial de AWS.

---

**Desarrollado como proyecto final para simulación de AWS con Docker** 🚀

