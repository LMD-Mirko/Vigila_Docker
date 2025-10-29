# 🧪 Guía de Pruebas - VIGILA

## Pruebas Manuales Paso a Paso

### 1. Verificar Estado del Servicio

```bash
curl http://localhost:4000/
```

**Resultado esperado:**
```json
{
  "service": "VIGILA Backend",
  "status": "active",
  "aws_services": {
    "ec2": "simulado (Docker container)",
    "rds": "simulado (MySQL)",
    "s3": "simulado (MinIO)"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Subir un Video

Primero, crea un archivo de prueba:

```bash
# Crear un archivo de video de prueba (test.mp4 de 1MB)
dd if=/dev/urandom of=test.mp4 bs=1024 count=1024
```

Luego súbelo:

```bash
curl -X POST -F "video=@test.mp4" http://localhost:4000/upload
```

**Resultado esperado:**
```json
{
  "message": "✅ Video subido correctamente",
  "video": {
    "id": 1,
    "filename": "test.mp4",
    "s3_key": "videos/1705317000000-test.mp4",
    "size": 1048576
  }
}
```

### 3. Listar Videos

```bash
curl http://localhost:4000/videos
```

**Resultado esperado:**
```json
{
  "count": 1,
  "videos": [
    {
      "id": 1,
      "filename": "test.mp4",
      "s3_key": "videos/1705317000000-test.mp4",
      "size": 1048576,
      "upload_date": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 4. Ver Estadísticas

```bash
curl http://localhost:4000/stats
```

**Resultado esperado:**
```json
{
  "statistics": {
    "total_videos": 1,
    "total_size": 1048576,
    "avg_size": 1048576
  }
}
```

### 5. Descargar Video

```bash
curl http://localhost:4000/videos/1/download -o video_descargado.mp4
```

### 6. Verificar en MinIO

1. Abre http://localhost:9090
2. Inicia sesión con:
   - Usuario: `admin`
   - Contraseña: `admin123`
3. Ve al bucket "videos"
4. Deberías ver el archivo subido

### 7. Verificar en MySQL

```bash
# Conectarse al contenedor de MySQL
docker exec -it vigila-db mysql -u root -proot vigila

# Dentro de MySQL, ejecutar:
SELECT * FROM videos;
```

## Pruebas de Escalabilidad

### Escalar el Backend

```bash
# Levantar 3 instancias del backend
docker compose up -d --scale backend=3

# Verificar que hay 3 contenedores
docker ps | grep vigila-backend
```

## Pruebas de Resiliencia

### Reiniciar un Contenedor

```bash
# Reiniciar el backend
docker restart vigila-backend

# Verificar que recupere la conexión
curl http://localhost:4000/
```

### Reiniciar la Base de Datos

```bash
# Reiniciar MySQL
docker restart vigila-db

# Esperar unos segundos y verificar que el backend reconecte
docker logs -f vigila-backend
```

## Pruebas de Rendimiento

### Probar con Múltiples Videos

```bash
# Subir 10 videos de prueba
for i in {1..10}; do
  dd if=/dev/urandom of=test_$i.mp4 bs=1024 count=1024 2>/dev/null
  curl -X POST -F "video=@test_$i.mp4" http://localhost:4000/upload
  rm test_$i.mp4
done
```

## Limpieza

```bash
# Eliminar archivos de prueba
rm -f test*.mp4 video_descargado.mp4

# Detener contenedores
docker compose down
```

