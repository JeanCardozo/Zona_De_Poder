FROM node:20

WORKDIR /app

COPY package*.json ./

# Instalar dependencias incluyendo nodemon como dependencia local
RUN npm install

COPY . .

EXPOSE 5000

# Utilizar el script dev en lugar de llamar a nodemon directamente
CMD ["npm", "run", "dev"]
