const express = require("express");
const serverless = require("serverless-http");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

const app = express();

console.log("🚀 Iniciando aplicación en Vercel...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DB_HOST:", process.env.DB_HOST);

// Middleware de parseo y cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configurar sesión EN MEMORIA (no persistente, pero funciona en Vercel)
app.use(
  session({
    secret: process.env.SECRET_KEY || "Zonadpr",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutos
    },
  })
);

// Configurar EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "../public")));

// Middleware para verificar que req.session existe
app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }

  if (req.session.userData) {
    res.locals.userData = req.session.userData;
  } else {
    res.locals.userData = null;
  }

  next();
});

// Importar rutas
let router;
try {
  router = require("../Router");
  console.log("✅ Router cargado correctamente");
} catch (error) {
  console.error("❌ Error al cargar Router:", error.message);
}

// Usar rutas
if (router) {
  app.use("/", router);
}

// Ruta de salud para verificar que el servidor está funcionando
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date(),
    node_env: process.env.NODE_ENV,
  });
});

// Manejo de errores 404
app.use((req, res) => {
  console.log(`⚠️ 404 - Ruta no encontrada: ${req.method} ${req.path}`);
  res.status(404).render("error", {
    title: "Página no encontrada",
    message: "Lo sentimos, la página que estás buscando no existe.",
  });
});

// Manejo de errores 500
app.use((err, req, res, next) => {
  console.error("❌ Error interno:", err);
  console.error("Stack:", err.stack);

  res.status(500).render("error", {
    title: "Error interno del servidor",
    message: "Ocurrió un problema inesperado. Por favor, inténtalo más tarde.",
  });
});

module.exports = app;
module.exports.handler = serverless(app);
