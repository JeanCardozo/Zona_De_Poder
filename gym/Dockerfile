# Usa la imagen base de Node.js
FROM node:20

# Establece el directorio de trabajo en /app
WORKDIR /app

# Copia el archivo package.json y package-lock.json
COPY package*.json ./

# Instala todas las dependencias, incluyendo nodemon localmente
RUN npm install

# Copia el resto del código de la aplicación al contenedor
COPY . .

# Expone el puerto 5000
EXPOSE 5000

# Comando para iniciar el servidor en modo desarrollo usando nodemon
CMD ["npm", "run", "dev"]
