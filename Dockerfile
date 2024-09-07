# Usa la imagen oficial de Node.js como base
FROM node:20

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de package.json y package-lock.json al contenedor
COPY gym/package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto del código al contenedor
COPY gym .

# Expone el puerto que tu aplicación utiliza
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
