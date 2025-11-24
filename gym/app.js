// app.js
const express = require("express");
const app = express();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const pgSession = require("connect-pg-simple")(session);
const pool = require("./database/zona_de_poder_db"); // Asegúrate de exportar tu pool de PostgreSQL
// const { authenticateToken, loadUserData } = require("./middlewares/auth");

dotenv.config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new pgSession({
      pool: pool, // Usar el pool de PostgreSQL
      tableName: "session", // Nombre de la tabla para las sesiones (opcional)
    }),
    secret: process.env.SECRET_KEY, // Define una variable de entorno para el secreto
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true en producción
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000, // 2 horas
    },
  })
);

app.use((req, res, next) => {
  if (req.session.userData) {
    req.session.touch(); // Renueva la sesión
    res.locals.userData = req.session.userData; // Disponibilidad global
  } else {
    res.locals.userData = null;
  }
  next();
});

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// app.use(authenticateToken);
// app.use(loadUserData);

// Importa y usa las rutas desde el Router
app.use("/", require("./Router"));

// Programar la tarea para que se ejecute todos los días a la medianoche
cron.schedule("0 0 * * *", () => {
  // Ejecuta a la medianoche
  console.log("Ejecutando actualización de estados de mensualidades...");
  actualizarEstadosMensualidades();
});

app.use(morgan("dev"));
app.use(cors({ origin: "*" }));

app.use((req, res, next) => {
  // Si los datos de usuario están en la sesión, los asignamos a res.locals
  if (req.session.userData) {
    res.locals.userData = {
      id_usuario: req.session.userData.id_usuario,
      nombre_usuario: req.session.userData.nombre_usuario,
      rol: req.session.userData.rol,
      tiene_imagen: req.session.userData.tiene_imagen,
      imagen_perfil: req.session.userData.tiene_imagen
        ? `/profile-image/${req.session.userData.id_usuario}`
        : "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png",
    };
  } else {
    // Si no hay sesión, dejamos los datos como null
    res.locals.userData = null;
  }
  next();
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

module.exports = app;
