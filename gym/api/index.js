const express = require("express");
const serverless = require("serverless-http");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

const app = express();

// Middleware de parseo y cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configurar sesión
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

// Configurar EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "../public")));

// Middleware para verificar que req.session está disponible
app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  next();
});

// Importar y usar las rutas
try {
  const router = require("../Router");
  app.use("/", router);
} catch (error) {
  console.error("Error al cargar las rutas:", error);
}

// Ruta de prueba para verificar que el servidor está funcionando
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Manejo de errores 404
app.use((req, res) => {
  console.log(`404 - Ruta no encontrada: ${req.method} ${req.path}`);
  res.status(404).render("error", {
    title: "Página no encontrada",
    message: "Lo sentimos, la página que estás buscando no existe.",
  });
});

// Manejo de errores 500
app.use((err, req, res, next) => {
  console.error("Error interno del servidor:", err);

  // Enviar respuesta de error
  res.status(500).render("error", {
    title: "Error interno del servidor",
    message: "Ocurrió un problema inesperado. Por favor, inténtalo más tarde.",
  });
});

module.exports = app;
module.exports.handler = serverless(app);
