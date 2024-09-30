const express = require("express");
const app = express();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
dotenv.config();

// Configuración de la sesión global
app.use(cookieParser());
app.use(
  session({
    secret: "tu_secreto_aqui",
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
  if (req.session.user) {
    // Renovar la sesión
    req.session.touch();

    // Asegurarse de que userData esté disponible para todas las vistas
    res.locals.userData = req.session.user;
  } else {
    res.locals.userData = null;
  }
  next();
});

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Importa y usa las rutas desde el Router
app.use("/", require("./Router"));

// Programar la tarea para que se ejecute todos los días a la medianoche
cron.schedule("* * * * *", () => {
  console.log("Ejecutando actualización de estados de mensualidades...");
  actualizarEstadosMensualidades();
});

app.use(morgan("dev"));
app.use(cors());

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
