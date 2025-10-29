FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache curl

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --only=production

# Copiar código de la aplicación
COPY . .

# Crear directorio para uploads
RUN mkdir -p uploads && chmod 777 uploads

# Exponer puerto
EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Comando para iniciar la aplicación
CMD ["node", "index.js"]

