# 🔧 Guía de Solución de Problemas - VIGILA

## Problemas Comunes y Soluciones

### ❌ Error: Puerto 3306 ya está en uso

**Síntoma:**
```
Error response from daemon: failed to bind host port for 0.0.0.0:3306:3306/tcp: 
address already in use
```

**Causa:** Ya hay un servicio MySQL corriendo en tu sistema en el puerto 3306.

**Solución:** Ya aplicada en este proyecto - MySQL se mapea al puerto **3307** para evitar conflictos.

**Verificar:**
```bash
docker ps | grep vigila-db
# Deberías ver: 0.0.0.0:3307->3306/tcp
```

**Conectarse a MySQL:**
```bash
# Puerto externo cambiado a 3307
mysql -h localhost -P 3307 -u root -proot vigila

# Desde Docker
docker exec -it vigila-db mysql -u root -proot vigila
```

---

### ⚠️ Advertencia: 'version' es obsoleto

**Síntoma:**
```
WARN[0000] docker-compose.yml: the attribute `version` is obsolete
```

**Causa:** Docker Compose v2 ya no requiere ni acepta la línea `version`.

**Solución:** Ya corregida - se eliminó la línea `version: '3.8'` del `docker-compose.yml`.

---

### ❌ Backend no puede conectar a MySQL

**Síntoma:**
```bash
docker logs vigila-backend
# ❌ Error conectando a MySQL: connect ECONNREFUSED
```

**Causa:** MySQL tarda unos segundos en iniciarse completamente.

**Solución:** Esperar 10-15 segundos y reintentar. El backend tiene auto-reconexión.

**Verificar:**
```bash
# Ver logs del backend
docker logs -f vigila-backend

# Deberías ver eventualmente:
# ✅ Conectado a MySQL (RDS simulado)
# ✅ Tabla de videos creada/verificada
```

**Solución manual:** Reiniciar el backend
```bash
docker restart vigila-backend
```

---

### ❌ No puedo acceder a MinIO Console

**Síntoma:** http://localhost:9090 no carga.

**Solución:**
```bash
# Verificar que el contenedor esté corriendo
docker ps | grep vigila-storage

# Si no está corriendo, ver logs
docker logs vigila-storage

# Reiniciar si es necesario
docker restart vigila-storage
```

**Credenciales:**
- Usuario: `admin`
- Contraseña: `admin123`

---

### ❌ Error al subir video

**Síntoma:**
```bash
curl -X POST -F "video=@video.mp4" http://localhost:4000/upload
# Error: connect ECONNREFUSED storage:9000
```

**Causa:** MinIO aún no está listo o no puede conectarse.

**Solución:**
```bash
# Verificar que MinIO esté corriendo
docker ps | grep vigila-storage

# Ver logs de MinIO
docker logs vigila-storage

# Reiniciar todo el stack
docker compose down
docker compose up -d
```

---

### ❌ Los videos suben pero no se guardan

**Síntoma:** El upload responde OK pero no ves el archivo.

**Verificación:**
```bash
# 1. Verificar en base de datos
docker exec vigila-db mysql -u root -proot vigila -e "SELECT * FROM videos;"

# 2. Verificar en MinIO (S3)
# Abre http://localhost:9090 y ve al bucket "videos"

# 3. Ver logs del backend
docker logs vigila-backend | grep "Video subido"
```

---

### ⚠️ Contenedores se detienen solos

**Síntoma:** Los contenedores aparecen con estado "Exited".

**Solución:**
```bash
# Ver logs para saber por qué
docker compose logs

# Ver el último contenedor que falló
docker ps -a

# Reiniciar todo
docker compose down
docker compose up -d
```

---

### 💾 Persistencia de datos

**Problema:** ¿Se pierden los datos al reiniciar?

**Respuesta:** NO - Los datos están en volúmenes persistentes de Docker.

**Verificar volúmenes:**
```bash
docker volume ls | grep vigila
# vigila-cloud_db_data
# vigila-cloud_s3_data
```

**Backup manual:**
```bash
# Backup de base de datos
docker exec vigila-db mysqldump -u root -proot vigila > backup.sql

# Restaurar backup
docker exec -i vigila-db mysql -u root -proot vigila < backup.sql
```

**Eliminar TODO (incluyendo datos):**
```bash
docker compose down -v  # ⚠️ Esto elimina volúmenes
```

---

### 🔄 Reconstruir backend después de cambios

**Si modificas el código del backend:**

```bash
# Reconstruir y reiniciar
docker compose up -d --build backend

# O reconstruir todo
docker compose up -d --build
```

---

### 🧹 Limpiar todo y empezar de cero

```bash
# 1. Detener contenedores
docker compose down

# 2. Eliminar volúmenes (OJO: pérdida de datos)
docker compose down -v

# 3. Eliminar imágenes (opcional)
docker rmi vigila-cloud-backend

# 4. Reiniciar desde cero
docker compose up -d --build
```

---

### 📊 Verificar uso de recursos

```bash
# Estadísticas de contenedores en tiempo real
docker stats

# Uso de disco
docker system df
```

---

### 🔍 Depuración avanzada

**Ver todos los logs juntos:**
```bash
docker compose logs -f
```

**Ver logs de un servicio específico:**
```bash
docker logs -f vigila-backend
docker logs -f vigila-db
docker logs -f vigila-storage
```

**Inspeccionar red:**
```bash
docker network inspect vigila-cloud_vigila-network
```

**Acceder al contenedor:**
```bash
# Backend
docker exec -it vigila-backend sh

# MySQL
docker exec -it vigila-db bash

# MinIO
docker exec -it vigila-storage sh
```

---

### 📞 Obtener ayuda adicional

Si el problema persiste:

1. **Verificar requisitos:**
```bash
docker --version      # Debe ser 20.10+
docker compose version # Debe ser 2.0+
```

2. **Ver logs completos:**
```bash
docker compose logs > logs.txt
cat logs.txt
```

3. **Verificar que puertos no estén ocupados:**
```bash
# Linux/Mac
sudo lsof -i :4000
sudo lsof -i :3307
sudo lsof -i :9090

# Windows
netstat -ano | findstr :4000
```

4. **Reinstalar Docker** si es necesario

---

## Checklist de Diagnóstico

Antes de reportar un problema, verifica:

- [ ] Docker está instalado y corriendo
- [ ] Puertos 4000, 3307, 9090 están libres
- [ ] Tienes suficiente espacio en disco (mínimo 2GB)
- [ ] Tienes suficiente RAM (mínimo 2GB)
- [ ] No hay firewall bloqueando puertos
- [ ] Todos los contenedores están corriendo (`docker ps`)
- [ ] Los logs no muestran errores críticos

---

## Resumen de Puertos

| Puerto | Servicio | Uso |
|--------|----------|-----|
| 4000 | Backend API | HTTP API |
| 3307 | MySQL | Base de datos (exterior) |
| 3306 | MySQL | Base de datos (interior) |
| 9000 | MinIO API | S3 API |
| 9090 | MinIO Console | Panel web |

**Nota:** El puerto 3307 es el externo mapeado al puerto 3306 interno del contenedor.

---

**Última actualización:** Resolución de conflicto de puerto 3306 ✅

