const conexion = require("../database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const SECRET_KEY = "negrosdemierda"; // Asegúrate de mantener esto en secreto

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

exports.crearclienteS = (req, res) => {
  const id = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.apellido;
  const edad = req.body.edad;
  const sexo = req.body.sexo;
  const fecha = req.body.inscripcion;
  const correo = req.body.correo;
  const numero = req.body.numero;
  const mensu = req.body.mensualidad;
  const usu = req.body.usuario;

  const queryClientes =
    "INSERT INTO clientes (id, nombre, apellido, edad, sexo, fecha_de_inscripcion, correo_electronico, numero_telefono, id_mensualidad, id_usuario, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id";
  const valuesClientes = [
    id,
    nom,
    ape,
    edad,
    sexo,
    fecha,
    correo,
    numero,
    mensu,
    usu,
    "Activo",
  ];

  conexion.query("BEGIN", (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }

    conexion.query(queryClientes, valuesClientes, (error, results) => {
      if (error) {
        return conexion.query("ROLLBACK", (rollbackErr) => {
          if (rollbackErr) {
            console.log(rollbackErr);
            return res.status(500).json({ error: rollbackErr.message });
          }
          console.log(error);
          return res.status(500).json({ error: error.message });
        });
      }

      const ide = results.rows[0].id; // Capturar el ID recién creado
      const queryTallas =
        "INSERT INTO tallas (id_cliente, nombre) VALUES ($1, $2)";
      const valuesTallas = [ide, nom];

      conexion.query(
        queryTallas,
        valuesTallas,
        (errorTallas, resultsTallas) => {
          if (errorTallas) {
            return conexion.query("ROLLBACK", (rollbackErr) => {
              if (rollbackErr) {
                console.log(rollbackErr);
                return res.status(500).json({ error: rollbackErr.message });
              }
              console.log(errorTallas);
              return res.status(500).json({ error: errorTallas.message });
            });
          }

          // Nueva consulta para insertar en la tabla mensualidad_clientes
          const queryMensualidad =
            "INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio ,tiempo_plan, estado) VALUES ($1, $2, $3, $4 ,$5)";
          const valuesMensualidad = [ide, nom, fecha, mensu, "Activo"];

          conexion.query(
            queryMensualidad,
            valuesMensualidad,
            (errorMensualidad, resultsMensualidad) => {
              if (errorMensualidad) {
                return conexion.query("ROLLBACK", (rollbackErr) => {
                  if (rollbackErr) {
                    console.log(rollbackErr);
                    return res.status(500).json({ error: rollbackErr.message });
                  }
                  console.log(errorMensualidad);
                  return res
                    .status(500)
                    .json({ error: errorMensualidad.message });
                });
              }

              conexion.query("COMMIT", (commitErr) => {
                if (commitErr) {
                  console.log(commitErr);
                  return res.status(500).json({ error: commitErr.message });
                }
                res.redirect(`/actualizar_tallas/${ide}`);
              });
            }
          );
        }
      );
    });
  });
};

exports.update_cliente = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const edad = req.body.edad;
  const sexo = req.body.sexo;
  const correo_electronico = req.body.correo_electronico;
  const numero_telefono = req.body.numero_telefono;
  const id_mensualidad = parseInt(req.body.id_mensualidad);

  const query = `
    UPDATE clientes 
    SET nombre = $1, apellido = $2, edad = $3, sexo = $4, 
        correo_electronico = $5, numero_telefono = $6, 
        id_mensualidad = $7
    WHERE id = $8
  `;
  const values = [
    nombre,
    apellido,
    edad,
    sexo,
    correo_electronico,
    numero_telefono,
    id_mensualidad,
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

exports.desactivarcliente = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query = "UPDATE clientes SET estado = 'Inactivo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_clientes");
  });
};

exports.activarcliente = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query = "UPDATE clientes SET estado = 'Activo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_clientes");
  });
};

// USUARIOS -----------------------------------------------------------------

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
      "INSERT INTO usuarios (id, nombre, apellido, telefono, correo_electronico, contraseña, id_rol, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";
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

exports.update_usuarios = (req, res) => {
  const id = parseInt(req.body.id, 10);
  const nombre = parseFloat(req.body.nombre);
  const ape = parseFloat(req.body.apellido);
  const telefono = parseFloat(req.body.telefono);
  const correo = parseFloat(req.body.correo_electronico);
  const contraseña = parseFloat(req.body.contra);

  // Verifica que el ID sea un número válido
  if (isNaN(id)) {
    console.log("Invalid ID:", req.body.id);
    return res.status(400).json({ error: "Invalid ID" });
  }

  const query =
    "UPDATE usuarios SET nombre = $1, apellido = $2, telefono = $3, correo = $4, contraseña = $5 WHERE id = $6";
  const values = [nombre, ape, telefono, correo, contraseña, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_talla");
    }
  });
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

exports.activarusuario = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query = "UPDATE usuarios SET estado = 'Activo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_usuarios");
  });
};

// TALLAS --------------------------------------------------------------------

//actualizar tallas

exports.update_tallas = (req, res) => {
  const id = parseInt(req.body.id, 10);
  const medida_pecho = parseFloat(req.body.medida_pecho);
  const medida_brazo = parseFloat(req.body.medida_brazo);
  const medida_cintura = parseFloat(req.body.medida_cintura);
  const medida_abdomen = parseFloat(req.body.medida_abdomen);
  const medida_cadera = parseFloat(req.body.medida_cadera);
  const medida_pierna = parseFloat(req.body.medida_pierna);
  const medida_pantorrilla = parseFloat(req.body.medida_pantorrilla);

  // Verifica que el ID sea un número válido
  if (isNaN(id)) {
    console.log("Invalid ID:", req.body.id);
    return res.status(400).json({ error: "Invalid ID" });
  }

  const query =
    "UPDATE tallas SET medida_pecho = $1, medida_brazo = $2, medida_cintura = $3, medida_abdomen = $4, medida_cadera = $5, medida_pierna = $6, medida_pantorrilla = $7 WHERE id = $8";
  const values = [
    medida_pecho,
    medida_brazo,
    medida_cintura,
    medida_abdomen,
    medida_cadera,
    medida_pierna,
    medida_pantorrilla,
    id,
  ];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_talla");
    }
  });
};

// Crear convenio
exports.crearConvenio = (req, res) => {
  const id = req.body.id;
  const tipo = req.body.tipo;

  const query =
    "INSERT INTO mensualidad_convencional (id,tipo_de_mensualidad,estado) VALUES ($1,$2,$3)";
  const values = [id, tipo, "Activo"];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_convenio");
    }
  });
};

// actualizar convenio
exports.update_convenio = (req, res) => {
  const id = parseInt(req.body.id, 10);
  const tipo = req.body.tipo;

  // Verifica que el ID sea un número válido
  if (isNaN(id)) {
    console.log("Invalid ID:", req.body.id);
    return res.status(400).json({ error: "Invalid ID" });
  }

  const query =
    "UPDATE mensualidad_convencional SET tipo_de_mensualidad = $1 WHERE id = $2";
  const values = [tipo, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_convenio");
    }
  });
};

exports.desactivarconvenio = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query =
    "UPDATE mensualidad_convencional SET estado = 'Inactivo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_convenio");
  });
};

exports.activarconvenio = (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.status(400).json({ error: "ID es requerido" });
  }

  const query =
    "UPDATE mensualidad_convencional SET estado = 'Activo' WHERE id = $1";
  const values = [id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.error("Error al desactivar el usuario:", error);
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
    res.redirect("/ver_convenio");
  });
};

// crear mensualidad fija
exports.crearMensu = (req, res) => {
  const id = req.body.id;
  const tipo = req.body.tipo;

  const query =
    "INSERT INTO mensualidad_convencional (id,tipo_de_mensualidad,estado) VALUES ($1,$2,$3)";
  const values = [id, tipo, "Activo"];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_convenio");
    }
  });
};

// REGISTRAR --------------------------------------------------------------------------
exports.register = async (req, res) => {
  const id = req.body.id;
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const correo = req.body.correo;
  const telefono = req.body.telefono;
  const contraseña = req.body.pass;
  const estado = "Activo";
  const id_rol = 3;

  console.log("Nombre:", nombre); // Verifica el valor
  console.log("Contraseña:", contraseña); // Verifica el valor

  if (!id || !nombre || !apellido || !correo || !telefono || !contraseña) {
    return res
      .status(400)
      .json({ success: false, message: "Todos los campos son obligatorios" });
  }

  try {
    let hashedPassword = await bcrypt.hash(contraseña, 10);

    // Inserta en la base de datos
    conexion.query(
      "INSERT INTO usuarios (id, nombre, apellido, correo_electronico, telefono, contraseña,id_rol, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, nombre, apellido, correo, telefono, hashedPassword, id_rol, estado],
      (error, results) => {
        if (error) {
          console.log(error);
          return res
            .status(500)
            .json({ success: false, message: "Error en la base de datos" });
        } else {
          res.render("registrar", {
            alert: true,
            alertTitle: "Registro",
            alertMessage: "Usuario registrado con éxito",
            alertIcon: "success",
            showConfirmButton: false,
            timer: 1500,
            ruta: "/login_index",
          });
        }
      }
    );
  } catch (error) {
    console.error("Error al registrar:", error);
    res.status(500).json({ success: false, message: "Error al registrar" });
  }
};

// INICIO DE SESION --------------------------------------------------------------------------------------------------
exports.login = async (req, res) => {
  const user = req.body.user; // Captura el ID del usuario ingresado en el formulario
  const pass = req.body.pass; // Captura la contraseña ingresada

  if (user && pass) {
    conexion.query(
      "SELECT * FROM usuarios WHERE id = $1",
      [user],
      async (error, results) => {
        if (error) {
          console.error("Error en la base de datos:", error);
          return res.status(500).render("login_index", {
            alert: true,
            alertTitle: "Error",
            alertMessage: "Error en la base de datos",
            alertIcon: "error",
            showConfirmButton: true,
            timer: 1500,
            ruta: "login_index",
          });
        }

        // Verifica si el usuario existe y si la contraseña coincide
        if (
          results.rows.length === 0 || // Si no encuentra el usuario en la base de datos
          !(await bcrypt.compare(pass, results.rows[0].contraseña)) // Si la contraseña no coincide
        ) {
          res.render("login_index", {
            alert: true,
            alertTitle: "Error",
            alertMessage: "Identificación o contraseña incorrecta",
            alertIcon: "error",
            showConfirmButton: true,
            timer: 1500,
            ruta: "login_index",
          });
        } else {
          // Genera el JWT con el ID del usuario
          const userPayload = { id: results.rows[0].id };
          const token = jwt.sign(userPayload, SECRET_KEY, { expiresIn: "1h" });

          // Envía el token como una cookie para la sesión del usuario
          res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
          });

          // Redirige al administrador después del login exitoso
          res.render("login_index", {
            alert: true,
            alertTitle: "Conexión exitosa",
            alertMessage: "¡LOGIN CORRECTO!",
            alertIcon: "success",
            showConfirmButton: false,
            timer: 1500,
            ruta: "index_admin",
          });
        }
      }
    );
  } else {
    // Si no se ingresó usuario o contraseña
    res.render("login_index", {
      alert: true,
      alertTitle: "Advertencia",
      alertMessage: "¡Por favor ingrese un usuario y/o password!",
      alertIcon: "warning",
      showConfirmButton: true,
      timer: 1500,
      ruta: "login_index",
    });
  }
};

// GRUPOS MUSCULARES ---------------------------------------------------

//CREAR
exports.crear_gm = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.nombre_grupo;
  const seccion = req.body.seccion;

  const query =
    "INSERT INTO grupos_musculares (id,nombre,seccion) VALUES ($1,$2,$3)";
  const values = [id, nombre, seccion];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_grupo_muscular");
    }
  });
};

// actualizar
exports.update_gm = (req, res) => {
  const id = req.body.id; // El ID de la fila que se quiere actualizar
  const nombre = req.body.nombre_grupo;
  const seccion = req.body.seccion; // Asegúrate de que 'seccion' es el nombre correcto en el formulario

  // Asegúrate de que la consulta solo actualiza los campos 'nombre' y 'seccion' para la fila con el ID correspondiente
  const query = `
    UPDATE grupos_musculares 
    SET nombre = $1, seccion = $2
    WHERE id = $3
  `;
  const values = [nombre, seccion, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_grupo_muscular");
    }
  });
};

// ACTIVIDAD FISICA -------------------------------------------------------

//CREAR
exports.crear_af = (req, res) => {
  const id = req.body.id;
  const nombre_ejercicio = req.body.nombre_ejercicio;
  const series = req.body.series;
  const reps = req.body.reps;
  const video_ejemplo = req.body.video_ejemplo;
  const gm = req.body.gm;

  const query =
    "INSERT INTO actividad_fisica (id, nombre_ejercicio, series, repeticiones, video_ejemplo, id_grupo_muscular) VALUES ($1,$2,$3,$4,$5,$6)";
  const values = [id, nombre_ejercicio, series, reps, video_ejemplo, gm];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_acti_fisica");
    }
  });
};

// actualizar
exports.update_af = (req, res) => {
  const id = req.body.id; // Aquí debe ser 'id', no 'idd'
  const nombre = req.body.nombre_ejercicio;
  const series = req.body.series;
  const reps = req.body.reps;
  const video_ejemplo = req.body.video_ejemplo;
  const gm = req.body.gm;

  console.log("ID Actividad Física:", id); // Aquí debería imprimir el ID de la actividad física
  console.log("Nombre Ejercicio:", nombre);
  console.log("Series:", series);
  console.log("Repeticiones:", reps);
  console.log("Video Ejemplo:", video_ejemplo);
  console.log("Grupo Muscular ID:", gm);

  const query = `
    UPDATE actividad_fisica
    SET nombre_ejercicio = $1, series = $2, repeticiones = $3, video_ejemplo = $4, id_grupo_muscular = $5
    WHERE id = $6
  `;
  const values = [nombre, series, reps, video_ejemplo, gm, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_acti_fisica");
    }
  });
};
