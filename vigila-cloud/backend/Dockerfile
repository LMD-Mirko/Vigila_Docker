FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código de la aplicación
COPY . .

# Crear directorio para uploads
RUN mkdir -p uploads

# Exponer puerto
EXPOSE 4000

# Comando para iniciar la aplicación
CMD ["node", "index.js"]

