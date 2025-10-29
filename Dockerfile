FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache git
RUN git clone https://github.com/LMD-Mirko/Vigila_Docker.git .
RUN npm install --only=production
RUN mkdir -p uploads && chmod 777 uploads
EXPOSE 4000
CMD ["node", "index.js"]
