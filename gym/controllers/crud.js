const conexion = require("../database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const saltRounds = 10;

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

exports.update_cliente = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const peso = req.body.peso;
  const altura = req.body.altura;
  const correo = req.body.correo;
  const telefono = req.body.telefono;
  const mensualidad_id = req.body.mensualidad;

  const query = `
    UPDATE clientes 
    SET nombre = $1, apellido = $2, peso = $3, altura = $4, 
        correo_electronico = $5, numero_telefono = $6, 
        id_mensualidad = $7
    WHERE id = $8
  `;
  const values = [
    nombre,
    apellido,
    peso,
    altura,
    correo,
    telefono,
    mensualidad_id,
    id,
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

// desactivar usuario

exports.crearusu = async (req, res) => {
  const ide = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.ape;
  const tele = parseInt(req.body.telefono);
  const correo = req.body.correo;
  const contra = req.body.contra;
  const rol = req.body.roles;

  try {
    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(contra, saltRounds);

    // Preparar la consulta con la contraseña encriptada
    const query =
      "INSERT INTO usuarios (id, nombre, apellido, telefono, correo_electronico, contraseña, id_rol, estado) VALUES ($1, $2, $3, $4, $5, $6, $7,$8)";
    const values = [ide, nom, ape, tele, correo, hashedPassword, rol, "Activo"];

    // Ejecutar la consulta
    conexion.query(query, values, (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ error: error.message });
      } else {
        res.redirect("/ver_usuarios");
      }
    });
  } catch (error) {
    console.error("Error al encriptar la contraseña:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
};

exports.desactivarusuario = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query = "UPDATE usuarios SET estado = 'Inactivo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_usuarios");
  });
};
