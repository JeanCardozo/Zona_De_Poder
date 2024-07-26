const conexion = require("../database/zona_de_poder_db");

//ROLES--------------------------------------------------------------

//llamado desde create_rol para hacer la insercion a la base de datos en la tabla roles
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

//llamado desde actualizar para hacer la insercion de update en la base de datos
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

//CLIENTES-------------------------------------------------------------------

exports.crearcliente = (req, res) => {
  const ide = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.ape;
  const edad = req.body.edad;
  const sexo = req.body.sexo;
  const fecha = req.body.inscripcion;
  const peso = req.body.peso;
  const altura = req.body.altura;
  const correo = req.body.correo;
  const numero = req.body.numero;
  const mensu = req.body.mensualidad;
  const usu = req.body.usuario;
  const tipo = req.body.rol;

  const query =
    "INSERT INTO cliente (id, nombre, apellido, edad, sexo,fecha_de_inscripcion,peso,altura,correo_electronico,numero_telefono,id_mensualidad,id_usuario,id_tallas) VALUES ($1, $2, $3, $4,$5,$6,$7,$8,$9)";
  const values = [
    ide,
    nom,
    ape,
    edad,
    sexo,
    fecha,
    peso,
    altura,
    correo,
    numero,
    mensu,
    usu,
    tipo,
  ];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_clientes");
    }
  });
};

exports.savecliente = (req, res) => {
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
