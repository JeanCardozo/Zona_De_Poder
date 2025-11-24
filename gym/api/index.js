const express = require("express");
const serverless = require("serverless-http");
const path = require("path");
const router = require("../Router");

const app = express();

// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, "../public")));

// Usar el router para manejar las rutas
app.use("/", router);

// Manejar errores 404
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Página no encontrada",
    message: "Lo sentimos, la página que estás buscando no existe.",
  });
});

// Exportar la aplicación como función serverless
module.exports = app;
module.exports.handler = serverless(app);
