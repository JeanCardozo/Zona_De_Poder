const conexion = require("../database/zona_de_poder_db");

exports.crear = (req, res) => {
  const id = req.body.id;
  const rol = req.body.rol;

  const query = "INSERT INTO roles (id,tipo_de_rol) VALUES ($1,$2)";
  const values = [id, rol];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_roles");
    }
  });
};

exports.update = (req, res) => {
  const id = parseInt(req.body.id, 10);
  const tipo_de_rol = req.body.tipo_de_rol;

  // Verifica que el ID sea un número válido
  if (isNaN(id)) {
    console.log("Invalid ID:", req.body.id);
    return res.status(400).json({ error: "Invalid ID" });
  }

  const query = "UPDATE roles SET tipo_de_rol = $1 WHERE id = $2";
  const values = [tipo_de_rol, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_roles");
    }
  });
};

//crear cliente

exports.savec = (req, res) => {
  const user = req.body.user;
  const ape = req.body.ape;
  const dire = req.body.dire;
  const gen = req.body.gen;

  const query =
    "INSERT INTO cliente (nombre, apellido, direccion, genero) VALUES ($1, $2, $3, $4)";
  const values = [user, ape, dire, gen];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/vercliente");
    }
  });
};

exports.updatecliente = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const direccion = req.body.direccion;
  const genero = req.body.genero;

  const query =
    "UPDATE cliente SET nombre = $1, apellido = $2, direccion = $3, genero = $4 WHERE id = $5";
  const values = [nombre, apellido, direccion, genero, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/vercliente");
    }
  });
};
