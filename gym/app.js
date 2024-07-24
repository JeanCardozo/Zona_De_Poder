const express = require("express");
const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));
app.use(express(JSON));

app.use("/", require("./Router"));

app.listen(5000, () => {
  console.log("Servidor corriendo en http://localhost:5000");
});
