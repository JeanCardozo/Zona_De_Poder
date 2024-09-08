FROM node:20

WORKDIR /app

COPY package*.json ./

# Instalar nodemon globalmente
RUN npm install -g nodemon && npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
