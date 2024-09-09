FROM node:20

WORKDIR /gym

COPY package*.json ./

RUN npm install
RUN npm install -g nodemon

COPY . .

EXPOSE 3000

CMD ["npx", "nodemon", "app.js"]