// ...existing code...
const express = require("express");
const serverless = require("serverless-http");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const router = require("../Router");

const app = express();

// parse body y cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sesión mínima en memoria (para que Router.js pueda usar req.session).
// Nota: en serverless la sesión en memoria no persiste entre invocaciones.
// Para persistencia usar store compatible (Redis, DB) o JWT en producción.
app.use(
  session({
    secret: process.env.SECRET_KEY || "Zonadpr",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000,
    },
  })
);

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

// Manejar errores internos
app.use((err, req, res, next) => {
  console.error("Error interno del servidor:", err);
  res.status(500).render("error", {
    title: "Error interno del servidor",
    message: "Ocurrió un problema inesperado. Por favor, inténtalo más tarde.",
  });
});

// Exportar la aplicación como función serverless
module.exports = app;
module.exports.handler = serverless(app);
// ...existing code...
