const express = require("express");
const app = express();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Configuración de la sesión global
app.use(
  session({
    secret: "negrosdemierda", // Cambia esta cadena secreta a algo más seguro en producción
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Asegúrate de que sea `true` si usas HTTPS en producción
  })
);

app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Importa y usa las rutas desde el Router
app.use("/", require("./Router"));

// Programar la tarea para que se ejecute todos los días a la medianoche
cron.schedule("0 0 * * *", () => {
  console.log("Ejecutando actualización de estados de mensualidades...");
  actualizarEstadosMensualidades();
});

app.use(morgan("dev"));
app.use(cors());

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
