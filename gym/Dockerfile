FROM node:20

WORKDIR /gym

COPY package*.json ./

RUN npm install --build-from-source=bcrypt
RUN npm install -g nodemon

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
