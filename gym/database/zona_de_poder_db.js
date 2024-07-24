const { Pool } = require("pg");
require("dotenv").config();

const conexion = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

conexion.connect((error) => {
  if (error) {
    console.error("El error de conexión es: " + error);
    return;
  }
  console.log("Conectado a la BD PostgreSQL");
});

module.exports = conexion;
