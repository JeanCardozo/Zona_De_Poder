# Usa una imagen base
FROM node:20

# Define el directorio de trabajo en el contenedor
WORKDIR /app

# Copia el archivo package.json y package-lock.json al directorio de trabajo
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código al contenedor
COPY . .

# Expone el puerto en el que la app correrá
EXPOSE 5000

# Define el comando por defecto para ejecutar la aplicación
CMD ["npm", "start"]
