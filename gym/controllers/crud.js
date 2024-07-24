const conexion = require("../database/zona_de_poder_db");

exports.save = (req, res) => {
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
  const id = req.body.id;
  const nombre = req.body.nombre;
  const rol = req.body.rol;

  const query = "UPDATE roles SET nombre = $1, rol = $2 WHERE id = $3";
  const values = [nombre, rol, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver");
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
