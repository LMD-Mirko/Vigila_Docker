FROM node:18-alpine

WORKDIR /app

# Instalar git y curl
RUN apk add --no-cache git curl

# Descargar el código desde GitHub
RUN git clone https://github.com/LMD-Mirko/Vigila_Docker.git temp-repo

# Copiar archivos necesarios
RUN cp temp-repo/package.json . && cp temp-repo/index.js .

# Limpiar repositorio temporal
RUN rm -rf temp-repo

# Instalar dependencias
RUN npm install --only=production

# Crear directorio uploads
RUN mkdir -p uploads && chmod 777 uploads

# Exponer puerto
EXPOSE 4000

# Comando de inicio
CMD ["node", "index.js"]
