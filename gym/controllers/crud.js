const conexion = require("../database/zona_de_poder_db");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const SECRET_KEY = "negrosdemierda"; // Asegúrate de mantener esto en secreto

//ROLES--------------------------------------------------------------

//llamado desde create_rol para hacer la insercion a la base de datos en la tabla roles
exports.crearRoles = (req, res) => {
  const rol = req.body.rol;

  const query = "INSERT INTO roles (tipo_de_rol) VALUES ($1)";
  const values = [rol];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_roles?create=success");
    }
  });
};

//llamado desde actualizar para hacer la insercion de update en la base de datos
exports.updateRoles = (req, res) => {
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
      res.redirect("/ver_roles?update=success");
    }
  });
};

//CLIENTES-------------------------------------------------------------------

//Paginacion

exports.crearclienteS = (req, res) => {
  const id = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.apellido;
  const edad = req.body.edad;
  const sexo = req.body.sexo;
  const correo = req.body.correo;
  const numero = req.body.numero;
  const mensu = req.body.mensualidad;
  const usu = req.body.usuario;

  // Paso 1: Consultar los valores de meses y días desde la tabla mensualidades
  const queryMensualidades =
    "SELECT mes, dias FROM mensualidades WHERE id = $1";
  conexion.query(
    queryMensualidades,
    [mensu],
    (errorMensualidades, resultsMensualidades) => {
      if (errorMensualidades) {
        console.log(errorMensualidades);
        return res.status(500).json({ error: errorMensualidades.message });
      }

      if (resultsMensualidades.rows.length === 0) {
        return res.status(404).json({ error: "Mensualidad no encontrada" });
      }

      const { mes: meses, dias } = resultsMensualidades.rows[0];

      // Validar los valores de meses y días
      if (isNaN(meses) || isNaN(dias)) {
        return res
          .status(400)
          .json({ error: "Datos de mensualidad inválidos" });
      }

      // Paso 2: Calcular la fecha final
      let fechaInicio = new Date();
      fechaInicio.setTime(
        fechaInicio.getTime() + new Date().getTimezoneOffset() * 60000
      );
      console.log(meses, dias);
      if (isNaN(fechaInicio.getTime())) {
        return res.status(400).json({ error: "Fecha de inscripción inválida" });
      }

      fechaInicio.setMonth(fechaInicio.getMonth() + parseInt(meses, 10));
      fechaInicio.setDate(fechaInicio.getDate() + parseInt(dias, 10));
      const fechaFinal = fechaInicio.toISOString().split("T")[0]; // Formato YYYY-MM-DD

      // Paso 3: Realizar las inserciones en la base de datos
      const queryClientes =
        "INSERT INTO clientes (id, nombre, apellido, edad, sexo, fecha_de_inscripcion, correo_electronico, numero_telefono, id_mensualidad, id_usuario, estado) VALUES ($1, $2, $3, $4, $5, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), $6, $7, $8, $9, $10) RETURNING id";
      const valuesClientes = [
        id,
        nom,
        ape,
        edad,
        sexo,
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

              const queryMensualidad =
                "INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio, fecha_fin, id_mensualidad, estado) VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), $3, $4, $5)";
              const valuesMensualidad = [ide, nom, fechaFinal, mensu, "Activo"];

              conexion.query(
                queryMensualidad,
                valuesMensualidad,
                (errorMensualidad, resultsMensualidad) => {
                  if (errorMensualidad) {
                    return conexion.query("ROLLBACK", (rollbackErr) => {
                      if (rollbackErr) {
                        console.log(rollbackErr);
                        return res
                          .status(500)
                          .json({ error: rollbackErr.message });
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
                    res.status(200);
                    res.render("administrador/clientes/create_clientes", {
                      alert: true,
                      alertTitle: "Registro Exitoso",
                      alertMessage:
                        "Usuario registrado con éxito, Redirigiendo...",
                      alertIcon: "success",
                      showConfirmButton: false,
                      timer: 2500,
                      ruta: `/actualizar_tallas/${ide}`,
                      mensualidades: resultsMensualidades.rows, // Pasar la lista de mensualidades
                    });
                  });
                }
              );
            }
          );
        });
      });
    }
  );
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

  const queryUpdateCliente = `
    UPDATE clientes 
    SET nombre = $1, apellido = $2, edad = $3, sexo = $4, 
        correo_electronico = $5, numero_telefono = $6, 
        id_mensualidad = $7
    WHERE id = $8
  `;
  const valuesUpdateCliente = [
    nombre,
    apellido,
    edad,
    sexo,
    correo_electronico,
    numero_telefono,
    id_mensualidad,
    id,
  ];

  conexion.query("BEGIN", (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }

    conexion.query(
      queryUpdateCliente,
      valuesUpdateCliente,
      (error, results) => {
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

        // Actualizar la tabla tallas con los nuevos datos
        const queryUpdateTallas = `
        UPDATE tallas 
        SET nombre = $1
        WHERE id_cliente = $2
      `;
        const valuesUpdateTallas = [nombre, id];

        conexion.query(
          queryUpdateTallas,
          valuesUpdateTallas,
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

            // Actualizar la tabla mensualidad_clientes con los nuevos datos
            const queryUpdateMensualidad = `
          UPDATE mensualidad_clientes 
          SET nombre = $1, id_mensualidad = $2
          WHERE id_cliente = $3
        `;
            const valuesUpdateMensualidad = [nombre, id_mensualidad, id];

            conexion.query(
              queryUpdateMensualidad,
              valuesUpdateMensualidad,
              (errorMensualidad, resultsMensualidad) => {
                if (errorMensualidad) {
                  return conexion.query("ROLLBACK", (rollbackErr) => {
                    if (rollbackErr) {
                      console.log(rollbackErr);
                      return res
                        .status(500)
                        .json({ error: rollbackErr.message });
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
                  res.status(200);
                  res.render("administrador/clientes/create_clientes", {
                    alert: true,
                    alertTitle: "Registro Exitoso",
                    alertMessage:
                      "Usuario Actualizado con éxito, Redirigiendo...",
                    alertIcon: "success",
                    showConfirmButton: false,
                    timer: 2500,
                    ruta: `/ver_clientes`,
                    mensualidades: resultsMensualidad.rows, // Pasar la lista de mensualidades
                  });
                });
              }
            );
          }
        );
      }
    );
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

    // Obtener la lista de roles para mostrar en el formulario
    const rolesQuery = "SELECT * FROM roles";
    const rolesResults = await conexion.query(rolesQuery);

    // Ejecutar la consulta
    conexion.query(query, values, (error, results) => {
      if (error) {
        console.log(error);

        return res.render("administrador/usuarios/create_usuarios", {
          alert: true,
          alertTitle: "Error",
          alertMessage: "Error al Crear el usuario.",
          alertIcon: "error",
          showConfirmButton: true,
          roles: rolesResults.rows, // Enviar roles a la vista
        });
      } else {
        return res.render("administrador/usuarios/create_usuarios", {
          alert: true,
          alertTitle: "Éxito",
          alertMessage: "Usuario Creado correctamente.",
          alertIcon: "success",
          showConfirmButton: true,
          ruta: "/ver_usuarios",
          roles: rolesResults.rows, // Enviar roles a la vista
        });
      }
    });
  } catch (error) {
    console.error("Error al encriptar la contraseña:", error);
    return res.render("administrador/usuarios/create_usuarios", {
      alert: true,
      alertTitle: "Error",
      alertMessage: "Error en la encriptación de la contraseña.",
      alertIcon: "error",
      showConfirmButton: true,
      roles: rolesResults.rows, // Enviar roles a la vista
    });
  }
};

exports.update_usuarios = async (req, res) => {
  const id = parseInt(req.body.id, 10);
  const nombre = req.body.nombre;
  const ape = req.body.apellido;
  const telefono = req.body.telefono;
  const correo = req.body.correo_electronico;
  const contraseña = req.body.contra;

  if (isNaN(id)) {
    console.log("Invalid ID:", req.body.id);
    return res.render("administrador/usuarios/actualizar_usuarios", {
      user: { id, nombre, ape, telefono, correo },
      alert: true,
      alertTitle: "Error",
      alertMessage: "ID inválido.",
      alertIcon: "error",
      showConfirmButton: true,
    });
  }

  let query;
  let values;

  try {
    if (contraseña) {
      console.log("Contraseña original:", contraseña);
      const hashedPassword = await bcrypt.hash(contraseña, 10);
      console.log("Contraseña hasheada:", hashedPassword);
      query = `
        UPDATE usuarios 
        SET nombre = $1, apellido = $2, telefono = $3, correo_electronico = $4, contraseña = $5 
        WHERE id = $6
      `;
      values = [nombre, ape, telefono, correo, hashedPassword, id];
    } else {
      query = `
        UPDATE usuarios 
        SET nombre = $1, apellido = $2, telefono = $3, correo_electronico = $4 
        WHERE id = $5
      `;
      values = [nombre, ape, telefono, correo, id];
    }

    conexion.query(query, values, (error, results) => {
      if (error) {
        console.log(error);
        return res.render("administrador/usuarios/actualizar_usuarios", {
          user: { id, nombre, ape, telefono, correo },
          alert: true,
          alertTitle: "Error",
          alertMessage: "Error al actualizar el usuario.",
          alertIcon: "error",
          showConfirmButton: true,
        });
      } else {
        return res.render("administrador/usuarios/actualizar_usuarios", {
          user: { id, nombre, ape, telefono, correo },
          alert: true,
          alertTitle: "Éxito",
          alertMessage: "Usuario actualizado correctamente.",
          alertIcon: "success",
          showConfirmButton: true,
          ruta: "/ver_usuarios",
        });
      }
    });
  } catch (error) {
    console.log("Error encriptando la contraseña:", error);
    return res.render("administrador/usuarios/actualizar_usuarios", {
      user: { id, nombre, ape, telefono, correo },
      alert: true,
      alertTitle: "Error",
      alertMessage: "Error en la encriptación de la contraseña.",
      alertIcon: "error",
      showConfirmButton: true,
    });
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
  const peso = parseFloat(req.body.peso);
  const altura = parseFloat(req.body.altura);
  const id_cliente = parseFloat(req.body.id_cliente);
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
    "UPDATE tallas SET medida_pecho = $1, medida_brazo = $2, medida_cintura = $3, medida_abdomen = $4, medida_cadera = $5, medida_pierna = $6, medida_pantorrilla = $7, peso = $9, altura = $10 WHERE id = $8";
  const values = [
    medida_pecho,
    medida_brazo,
    medida_cintura,
    medida_abdomen,
    medida_cadera,
    medida_pierna,
    medida_pantorrilla,
    id,
    peso,
    altura,
  ];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      // Buscar los datos del usuario en la base de datos
      const queryUser = "SELECT * FROM tallas WHERE id = $1";
      conexion.query(queryUser, [id], (errorUser, resultsUser) => {
        if (errorUser) {
          console.log(errorUser);
          return res.status(500).json({ error: errorUser.message });
        }

        // Pasar los datos del usuario al objeto de datos
        res.render("administrador/tallas/actualizar_tallas", {
          mensaje: "Tallas actualizadas con éxito.",
          id_cliente: id_cliente,
          user: resultsUser.rows[0],
        });
      });
    }
  });
};
// Crear convenio
exports.crearConvenio = (req, res) => {
  const tipo = req.body.tipo;

  const query =
    "INSERT INTO mensualidad_convencional (tipo_de_mensualidad,estado) VALUES ($1,$2)";
  const values = [tipo, "Activo"];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_convenio?create=success");
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
      res.redirect("/ver_convenio?update=success");
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
  const tipo = req.body.con;
  const tiempo = req.body.tiempo;
  const pagar = req.body.pagar;

  const mes = req.body.meses;
  const dia = req.body.dias;

  const query =
    "INSERT INTO mensualidades (id,total_pagar,id_mensualidad_convencional,tiempo_plan, mes, dias) VALUES ($1,$2,$3,$4,$5,$6)";
  const values = [id, pagar, tipo, tiempo, mes, dia];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_mensualidad?create=success");
    }
  });
};

exports.update_mensualidad = (req, res) => {
  const id = parseInt(req.body.ide, 10) || null;
  const total_pagar = parseFloat(req.body.pagar) || 0;
  const tipo = parseInt(req.body.tipo, 10) || null;
  const tiempo = req.body.tiempo || "";

  const query =
    "UPDATE mensualidades SET total_pagar = $2, id_mensualidad_convencional = $3, tiempo_plan = $4 WHERE id = $1";
  const values = [id, total_pagar, tipo, tiempo];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_mensualidad?update=success");
    }
  });
};

// REGISTRAR --------------------------------------------------------------------------
exports.register = async (req, res) => {
  const { id, nombre, apellido, correo, telefono, pass } = req.body;

  if (!id || !nombre || !apellido || !correo || !telefono || !pass) {
    return res.status(400).json({
      success: false,
      message: "Todos los campos son obligatorios",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(pass, 10);

    // Almacenar temporalmente en la tabla `temp_registro`
    const query = `
      INSERT INTO temp_registro (id_usuario, nombre, apellido, correo, telefono, contraseña)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const values = [id, nombre, apellido, correo, telefono, hashedPassword];

    conexion.query(query, values, (error, result) => {
      if (error) {
        console.error("Error en la base de datos:", error);
        return res.status(500).json({
          success: false,
          message: "Error en la base de datos",
        });
      }

      const tempRegistroId = result.rows[0].id;

      // Redirigir a la página de selección de mensualidades
      res.redirect(`/mensualidades?tempRegistroId=${tempRegistroId}`);
    });
  } catch (error) {
    console.error("Error al registrar:", error);
    res.status(500).json({ success: false, message: "Error al registrar" });
  }
};

// ruta para la redirección a PayU -----------------------------------------------

// INICIO DE SESION --------------------------------------------------------------------------------------------------
exports.login = async (req, res) => {
  const user = req.body.user;
  const pass = req.body.pass;

  console.log("hpta: ", user);

  if (!user || !pass) {
    return renderLoginPage(res, {
      alertTitle: "Advertencia",
      alertMessage: "¡Por favor ingrese un usuario y contraseña!",
      alertIcon: "warning",
    });
  }

  try {
    const results = await conexion.query(
      `SELECT u.id, u.contraseña, u.estado, u.id_rol, r.tipo_de_rol, u.nombre FROM usuarios as u
        INNER JOIN roles as r ON u.id_rol = r.id 
       WHERE u.id = $1`,
      [user]
    );

    if (results.rows.length === 0) {
      return renderLoginPage(res, {
        alertTitle: "Error",
        alertMessage: "Identificación o contraseña incorrecta",
        alertIcon: "error",
      });
    }

    const userData = results.rows[0];

    if (!(await bcrypt.compare(pass, userData.contraseña))) {
      return renderLoginPage(res, {
        alertTitle: "Error",
        alertMessage: "Identificación o contraseña incorrecta",
        alertIcon: "error",
      });
    }

    if (userData.estado === "Inactivo") {
      return renderLoginPage(res, {
        alertTitle: "Error",
        alertMessage: "El usuario está inactivo y no puede iniciar sesión",
        alertIcon: "error",
      });
    }

    // Genera el token
    const token = generateToken(userData);
    setTokenCookie(res, token);

    // Guarda los datos del usuario en la sesión
    req.session.userData = {
      id: userData.id,
      nombre_usuario: userData.nombre,
      rol: userData.tipo_de_rol,
    };

    const routeByRole = {
      1: "index_admin",
      3: "clientes/index_c",
      // Agregar más roles según sea necesario
    };

    const ruta = routeByRole[userData.id_rol] || "login_index";

    return res.render("login_index", {
      alert: true,
      alertTitle: "Conexión exitosa",
      alertMessage: "¡LOGIN CORRECTO!",
      alertIcon: "success",
      showConfirmButton: false,
      timer: 1000,
      ruta: ruta,
    });
  } catch (error) {
    console.error("Error en la base de datos:", error);
    return renderLoginPage(res, {
      alertTitle: "Error",
      alertMessage: "Error en la base de datos",
      alertIcon: "error",
    });
  }
};

function renderLoginPage(res, alertOptions) {
  return res.render("login_index", {
    alert: true,
    ...alertOptions,
    showConfirmButton: true,
    timer: 1500,
    ruta: "login_index",
  });
}

function generateToken(userData) {
  const userPayload = {
    id: userData.id,
    role: userData.id_rol,
  };
  return jwt.sign(userPayload, SECRET_KEY, { expiresIn: "1h" });
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}

// GRUPOS MUSCULARES ---------------------------------------------------

//CREAR
exports.crear_gm = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.musculo;
  const seccion = req.body.seccion;

  const query =
    "INSERT INTO grupos_musculares (id,nombre,seccion) VALUES ($1,$2,$3)";
  const values = [id, nombre, seccion];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_grupo_muscular?create=success");
    }
  });
};

// actualizar
exports.update_gm = (req, res) => {
  const id = req.body.id; // El ID de la fila que se quiere actualizar
  const nombre = req.body.musculo;
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
      res.redirect("/ver_grupo_muscular?update=success");
    }
  });
};

// ACTIVIDAD FISICA -------------------------------------------------------

//CREAR
exports.crear_af = (req, res) => {
  const nombre_ejercicio = req.body.nombre_ejercicio;
  const gm = req.body.seccion;

  const query =
    "INSERT INTO actividad_fisica (nombre_ejercicio, id_grupo_muscular) VALUES ($1, $2)";
  const values = [nombre_ejercicio, gm];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_acti_fisica?create=success");
    }
  });
};

// actualizar
exports.update_af = (req, res) => {
  const id = req.body.id;
  const nombre = req.body.actividad;
  const gm = req.body.gm;

  const query = `
    UPDATE actividad_fisica
    SET nombre_ejercicio = $1, id_grupo_muscular = $2
    WHERE id = $3
  `;
  const values = [nombre, gm, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_acti_fisica?update=success");
    }
  });
};

// PLAN DE ENTRENAMIENTO --------------------------------------------------------------------------------------------------------------

//CREAR PLAN DE ENTRENAMIENTO CON FORMULARIOS DIFERENTES(DEJARLO TAL CUAL ESTA A MENOS QUE SE QUIERA MODIFICAR LA LOGICA)

exports.mostrarFormularioConCliente = (req, res, id_cliente) => {
  conexion.query(
    "SELECT * FROM clientes WHERE id = $1",
    [id_cliente],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        // Obtener las actividades físicas
        conexion.query(
          `SELECT 
              af.id AS af_id, 
              af.nombre_ejercicio AS af_nombre, 
            
              gm.id AS gm_id, 
              gm.nombre AS gm_nombre 
            FROM 
              actividad_fisica af 
            INNER JOIN 
              grupos_musculares gm 
            ON 
              af.id_grupo_muscular = gm.id 
            ORDER BY 
              af.id`,
          (error, actividadesResults) => {
            if (error) {
              return res.status(500).json({ error: error.message });
            }

            conexion.query(
              "SELECT * FROM grupos_musculares ORDER BY id",

              (error, results) => {
                if (error) {
                  return res.status(500).json({ error: error.message }); // Manejo de error
                }
              }
            );
            res.render("administrador/plan_de_entrenamiento/create_plan_ent", {
              user: results.rows[0],
              id_cliente: id_cliente,
              actividades: actividadesResults.rows,
            });
          }
        );
      } else {
        res.status(404).json({
          error: `No se encontró un usuario con el id_cliente ${id_cliente}`,
        });
      }
    }
  );
};

exports.mostrarFormularioVacio = (req, res) => {
  // Obtener las actividades físicas
  conexion.query(
    `SELECT 
      af.id AS af_id, 
      af.nombre_ejercicio AS af_nombre, 
     
      gm.id AS gm_id, 
      gm.nombre AS gm_nombre 
    FROM 
      actividad_fisica af 
    INNER JOIN 
      grupos_musculares gm 
    ON 
      af.id_grupo_muscular = gm.id 
    ORDER BY 
      af.id`,
    (error, actividadesResults) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      conexion.query(
        "SELECT * FROM grupos_musculares ORDER BY id",

        (error, gruposMuscularesResult) => {
          if (error) {
            return res.status(500).json({ error: error.message }); // Manejo de error
          }

          res.render("administrador/plan_de_entrenamiento/create_plan_ent", {
            id_cliente: null,
            actividades: actividadesResults.rows,
            gruposMusculares: gruposMuscularesResult.rows,
          });
        }
      );
    }
  );
};
// ACTUALIZAR PLAN DE ENTRENAMIENTO
exports.update_pe = (req, res) => {
  const { id, dia, id_actividad_fisica, series, repeticiones } = req.body;

  const query = `
    UPDATE plan_entrenamiento
    SET dia = $1, id_actividad_fisica = $2, series = $3, repeticiones = $4
    WHERE id = $5
  `;
  const values = [dia, id_actividad_fisica, series, repeticiones, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ver_plan_ent");
    }
  });
};

// INGRESO DE CLIENTES AL GIMNASIO PRESENCIAL
exports.registrarIngreso = async (req, res) => {
  try {
    const identificacionConAsterisco = req.body.identificacion;

    // Separar el * de la identificación real
    const contraseña = identificacionConAsterisco;
    const id_cliente = identificacionConAsterisco.replace("*", "");

    // Verificar que el ID sea numérico y no esté vacío
    if (!id_cliente || isNaN(id_cliente)) {
      return res.status(400).json({ error: "Identificación inválida." });
    }

    // Buscar si el cliente existe en la base de datos
    const clienteQuery = "SELECT * FROM clientes WHERE id = $1";
    const clienteResult = await conexion.query(clienteQuery, [id_cliente]);

    if (clienteResult.rowCount === 0) {
      return res.render("administrador/index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Cliente no encontrado o contraseña incorrecta.",
        alertIcon: "error",
        showConfirmButton: true,
        sonido:
          "https://raw.githubusercontent.com/JeanCardozo/audios/main/usb.mp3",
        ruta: "index_admin",
      });
    }

    // Obtener el valor máximo de cantidad_ingresos para este cliente
    const maxCantidadQuery = `
      SELECT COALESCE(MAX(cantidad_ingresos), 0) + 1 AS nueva_cantidad_ingresos 
      FROM ingresos_clientes 
      WHERE id_cliente = $1
    `;
    const maxCantidadResult = await conexion.query(maxCantidadQuery, [
      id_cliente,
    ]);
    const nuevaCantidadIngresos =
      maxCantidadResult.rows[0].nueva_cantidad_ingresos;

    // Insertar un nuevo ingreso en la tabla ingresos_clientes
    const insertQuery = `
      INSERT INTO ingresos_clientes (id_cliente, contraseña, cantidad_ingresos, fecha_ingresos)
VALUES ($1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'))
RETURNING id_cliente;
    `;
    const insertResult = await conexion.query(insertQuery, [
      id_cliente,
      contraseña,
      nuevaCantidadIngresos,
    ]);

    if (insertResult.rowCount === 0) {
      return res.render("administrador/index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Error al registrar el ingreso.",
        alertIcon: "error",
        showConfirmButton: true,
        sonido:
          "https://raw.githubusercontent.com/JeanCardozo/audios/main/usb.mp3",
        ruta: "index_admin",
      });
    }

    // Obtener los últimos clientes para pasarlos a la vista
    const ultimosClientesQuery = `
    SELECT 
      c.nombre, 
      c.id_mensualidad AS id_mensu_cliente, 
      m.id AS id_mensu, 
      m.tiempo_plan
    FROM  
      clientes c
    INNER JOIN 
      mensualidades m ON c.id_mensualidad = m.id
    ORDER BY 
      c.fecha_de_inscripcion DESC
    LIMIT 5;
  `;
    const ultimosClientesResult = await conexion.query(ultimosClientesQuery);
    const ultimosClientes = ultimosClientesResult.rows;

    const queryVentasVencidas = `
    SELECT * FROM mensualidad_clientes WHERE estado = 'Vencida' ORDER BY fecha_inicio DESC;`;

    const resultVentasVencidas = await conexion.query(queryVentasVencidas);
    const datosVentasVencidas = resultVentasVencidas.rows;

    // Renderizar la vista index_admin con un mensaje de éxito
    res.render("administrador/index", {
      alert: true,
      alertTitle: "Éxito",
      alertMessage: "Ingreso registrado exitosamente",
      alertIcon: "success",
      showConfirmButton: true,
      sonido:
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/inicio.mp3",
      ruta: "index_admin",
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
    });
  } catch (error) {
    console.error("Error en registrarIngreso:", error);
    res.render("administrador/index", {
      alert: true,
      alertTitle: "Error",
      alertMessage: "Error interno del servidor.",
      alertIcon: "error",
      showConfirmButton: true,
      sonido:
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/usb.mp3",
      ruta: "index_admin",
      ultimosClientes: [], // Pasar una lista vacía en caso de error
    });
  }
};

// ver cientes

exports.verClientes = (req, res) => {
  const query = `
    SELECT c.id,c.nombre,c.apellido,c.edad,c.sexo,c.fecha_de_inscripcion,c.correo_electronico,c.numero_telefono,
    c.id_mensualidad,c.id_usuario,c.estado,m.id AS id_mensual,m.total_pagar,m.tiempo_plan,u.nombre AS nom_usu
    FROM clientes AS c 
    LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
    LEFT JOIN usuarios AS u ON c.id_usuario= u.id ORDER BY c.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

// ver usuarios API POST
exports.verUsuarios = (req, res) => {
  conexion.query(
    `SELECT u.id AS id_usuarios, u.nombre, u.apellido, u.telefono, u.correo_electronico, u.contraseña, u.id_rol, u.estado,
            r.id AS id_roles, r.tipo_de_rol AS rol 
     FROM usuarios AS u 
     INNER JOIN roles AS r ON u.id_rol = r.id 
     WHERE u.id_rol IN ($1, $2)`,
    [1, 2],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.status(200).json(results.rows);
    }
  );
};

// ver mensualidades

exports.verMensualidades = (req, res) => {
  const query = `
        SELECT  m.id AS id_mensualidad,m.total_pagar,mc.tipo_de_mensualidad,m.tiempo_plan FROM
         mensualidades AS m INNER JOIN mensualidad_convencional AS mc ON m.id_mensualidad_convencional =mc.id ORDER BY m.id
`;
  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

// Ver tallas

exports.verTallas = (req, res) => {
  const query = `
        SELECT * FROM tallas ORDER BY id
`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

//Ver ventas

exports.verVentas = (req, res) => {
  const query = `
SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
       m.id AS id_mensualidad, m.tiempo_plan, m.total_pagar, m.id_mensualidad_convencional, 
       mensu.id AS id_mensualidad_convencional, mensu.tipo_de_mensualidad 
       FROM mensualidad_clientes AS mc
       INNER JOIN mensualidades AS m ON mc.id_mensualidad = m.id
       INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

// ver grupos musculares

exports.verGm = (req, res) => {
  const query = `
SELECT * FROM grupos_musculares ORDER BY id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

// ver plan de entrenamiento

exports.verPlanEntrenamiento = (req, res) => {
  const query = `
      SELECT pe.id AS id_plan_entrenamiento, pe.dia, pe.id_cliente, pe.id_actividad_fisica, pe.series, pe.repeticiones,
      c.id AS id_del_cliente, c.nombre,
      ac.id AS id_actividad, ac.nombre_ejercicio, ac.id_grupo_muscular,
      gm.id AS id_grupo, gm.nombre AS nombre_musculo, gm.seccion
      FROM plan_entrenamiento AS pe
      INNER JOIN clientes AS c ON pe.id_cliente = c.id
      LEFT JOIN actividad_fisica AS ac ON pe.id_actividad_fisica = ac.id
      LEFT JOIN grupos_musculares AS gm ON ac.id_grupo_muscular = gm.id
      ORDER BY pe.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

exports.guardarPlanentrenamiento = async (req, res) => {
  try {
    const { id_cliente, dias, actividades, seriesRepeticiones } = req.body;

    // Verificar que 'dias' es un array y 'actividades' es un array
    if (!Array.isArray(dias) || !Array.isArray(actividades)) {
      throw new Error("Los días o las actividades no son válidos.");
    }

    // Validar que seriesRepeticiones es un objeto
    if (typeof seriesRepeticiones !== "object") {
      throw new Error("La estructura de series y repeticiones no es válida.");
    }

    // Por cada día seleccionado, guarda las actividades con series y repeticiones
    for (const dia of dias) {
      for (const actividad of actividades) {
        // Obtener series y repeticiones para cada actividad
        const series = seriesRepeticiones[`series_${actividad}`];
        const repeticiones = seriesRepeticiones[`repeticiones_${actividad}`];

        // Verificar que series y repeticiones no sean undefined
        if (series === undefined || repeticiones === undefined) {
          throw new Error(`Faltan datos para la actividad ${actividad}.`);
        }

        // Inserta en la base de datos
        await pool.query(
          `INSERT INTO plan_entrenamiento (dia, id_cliente, id_actividad_fisica, series, repeticiones)
           VALUES ($1, $2, $3, $4, $5)`,
          [dia, id_cliente, actividad, series, repeticiones]
        );
      }
    }

    res.redirect("/ver_plan_ent");
  } catch (error) {
    console.error("Error al guardar el plan de entrenamiento:", error.message);
    res.status(500).send("Error al guardar el plan de entrenamiento.");
  }
};

// Ver actividad fisica

exports.verActividadFisica = (req, res) => {
  const query = `
   SELECT 
      af.id AS af_id, 
      af.nombre_ejercicio AS af_nombre, 
     
      gm.nombre AS gm_nombre 
    FROM 
      actividad_fisica af 
    INNER JOIN 
      grupos_musculares gm 
    ON 
      af.id_grupo_muscular = gm.id 
    ORDER BY 
      af.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(results.rows);
  });
};

// ACTUALIZAR EL ESTADO DE MENSUALIDAD_CLIENTES CADA DIA--------------------
exports.actualizarEstadosMensualidades = () => {
  console.log("Iniciando actualización de estados...");
  console.log("Fecha actual:", new Date());

  const query = `
    UPDATE mensualidad_clientes
    SET estado = 'Vencida'
    WHERE fecha_fin <= CURRENT_DATE
      AND estado != 'Vencida'
    RETURNING *;
  `;

  console.log("Query a ejecutar:", query);

  conexion.query(query, (error, results) => {
    if (error) {
      console.error("Error al actualizar los estados:", error);
    } else {
      console.log(`${results.rowCount} registros actualizados a 'Vencida'.`);
      console.log("Registros actualizados:", results.rows);
    }
    console.log("Finalización de la actualización de estados.");
  });
};
