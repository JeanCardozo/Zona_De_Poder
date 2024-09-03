# Usar una imagen base de Node.js
FROM node:20

# Crear un directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de configuración de la aplicación
COPY package*.json ./

# Instalar las dependencias necesarias
RUN npm install

# Copiar el resto de los archivos de la aplicación al contenedor
COPY . .

# Exponer el puerto en el que tu aplicación se ejecutará
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
