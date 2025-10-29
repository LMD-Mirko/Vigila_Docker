#!/bin/bash

# Script de prueba para el sistema VIGILA
# Autor: Sistema de automatización
# Fecha: 2024

echo "Iniciando pruebas del sistema VIGILA"
echo "========================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar URL
check_url() {
    if curl -s -f "$1" > /dev/null; then
        echo -e "${GREEN}[OK] $2${NC}"
        return 0
    else
        echo -e "${RED}[ERROR] $2${NC}"
        return 1
    fi
}

# Verificar que Docker esté corriendo
echo "1. Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Docker está instalado${NC}"
echo ""

# Verificar contenedores
echo "2. Verificando contenedores..."
if docker ps | grep -q vigila-backend; then
    echo -e "${GREEN}[OK] Backend (EC2 simulado) está corriendo${NC}"
else
    echo -e "${RED}[ERROR] Backend no está corriendo${NC}"
    echo "   Ejecuta: docker compose up -d"
    exit 1
fi

if docker ps | grep -q vigila-db; then
    echo -e "${GREEN}[OK] Base de datos (RDS simulado) está corriendo${NC}"
else
    echo -e "${RED}[ERROR] Base de datos no está corriendo${NC}"
fi

if docker ps | grep -q vigila-storage; then
    echo -e "${GREEN}[OK] Almacenamiento (S3 simulado) está corriendo${NC}"
else
    echo -e "${RED}[ERROR] Almacenamiento no está corriendo${NC}"
fi
echo ""

# Probar endpoints
echo "3. Probando endpoints del API..."
echo ""

check_url "http://localhost:4000/" "Endpoint raíz (/)"
check_url "http://localhost:9090" "MinIO Console"
echo ""

# Probar subida de video
echo "4. Probando subida de video..."
echo "   Creando archivo de prueba..."
TEST_FILE="test-video.mp4"
dd if=/dev/urandom of="$TEST_FILE" bs=1024 count=1024 2>/dev/null

echo "   Subiendo archivo..."
UPLOAD_RESPONSE=$(curl -s -X POST -F "video=@$TEST_FILE" http://localhost:4000/upload)

if echo "$UPLOAD_RESPONSE" | grep -q "correctamente"; then
    echo -e "${GREEN}[OK] Video subido correctamente${NC}"
    echo "   Respuesta: $UPLOAD_RESPONSE"
else
    echo -e "${RED}[ERROR] Error subiendo video${NC}"
    echo "   Respuesta: $UPLOAD_RESPONSE"
fi

rm -f "$TEST_FILE"
echo ""

# Listar videos
echo "5. Listando videos..."
VIDEOS=$(curl -s http://localhost:4000/videos)
echo "$VIDEOS" | grep -q "count" && echo -e "${GREEN}[OK] Videos listados${NC}" || echo -e "${RED}[ERROR] Error listando videos${NC}"
echo ""

# Estadísticas
echo "6. Obteniendo estadísticas..."
STATS=$(curl -s http://localhost:4000/stats)
echo "$STATS" | grep -q "statistics" && echo -e "${GREEN}[OK] Estadísticas obtenidas${NC}" || echo -e "${RED}[ERROR] Error obteniendo estadísticas${NC}"
echo ""

echo "========================================"
echo -e "${GREEN}[OK] Pruebas completadas${NC}"
echo ""
echo "Resumen de servicios:"
echo "   - Backend (EC2): http://localhost:4000"
echo "   - MySQL (RDS): localhost:3307"
echo "   - MinIO (S3): http://localhost:9090"
echo ""
echo "Para ver logs: docker compose logs -f"
echo "Para detener: docker compose down"

