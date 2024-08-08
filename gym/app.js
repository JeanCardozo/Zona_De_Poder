const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use("/", require("./Router"));

app.listen(5000, () => {
  console.log("Servidor corriendo en http://localhost:5000");
});
