const conexion = require("../database/zona_de_poder_db");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const SECRET_KEY = "negrosdemierda"; // Asegúrate de mantener esto en secreto
const mercadopago = require("mercadopago");
const {
  MercadoPagoConfig,
  Preference,
  configurations,
} = require("mercadopago");
const { token } = require("morgan");

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

exports.crearclienteS = async (req, res) => {
  const id = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.apellido;
  const edad = req.body.edad;
  const sexo = req.body.sexo;
  const correo = req.body.correo;
  const numero = req.body.numero;
  const mensu = req.body.mensualidad;
  const usu = req.body.usuario;

  try {
    // Paso 1: Consultar los valores de meses y días desde la tabla mensualidades
    const queryMensualidades =
      "SELECT mes, dias FROM mensualidades WHERE id = $1";
    const resultsMensualidades = await conexion.query(queryMensualidades, [
      mensu,
    ]);

    if (resultsMensualidades.rows.length === 0) {
      return res.status(404).json({ error: "Mensualidad no encontrada" });
    }

    const { mes: meses, dias } = resultsMensualidades.rows[0];

    // Validar los valores de meses y días
    if (isNaN(meses) || isNaN(dias)) {
      return res.status(400).json({ error: "Datos de mensualidad inválidos" });
    }

    // Paso 2: Calcular la fecha final
    let fechaInicio = new Date();
    fechaInicio.setTime(
      fechaInicio.getTime() + new Date().getTimezoneOffset() * 60000
    );

    if (isNaN(fechaInicio.getTime())) {
      return res.status(400).json({ error: "Fecha de inscripción inválida" });
    }

    fechaInicio.setMonth(fechaInicio.getMonth() + parseInt(meses, 10));
    fechaInicio.setDate(fechaInicio.getDate() + parseInt(dias, 10));
    const fechaFinal = fechaInicio.toISOString().split("T")[0]; // Formato YYYY-MM-DD

    // Encriptar la contraseña de forma asíncrona
    const hashedPassword = await bcrypt.hash(id, saltRounds);

    // Paso 3: Realizar las inserciones en la base de datos con transacción
    await conexion.query("BEGIN");

    const queryClientes =
      "INSERT INTO clientes (id, nombre, apellido, edad, sexo, fecha_de_inscripcion, correo_electronico, numero_telefono, id_mensualidad, id_usuario, estado, contraseña) VALUES ($1, $2, $3, $4, $5, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), $6, $7, $8, $9, $10, $11) RETURNING id";
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
      hashedPassword,
    ];

    const resultClientes = await conexion.query(queryClientes, valuesClientes);
    const ide = resultClientes.rows[0].id; // Capturar el ID recién creado

    const queryTallas =
      "INSERT INTO tallas (id_cliente, nombre, fecha) VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'))";
    const valuesTallas = [ide, nom];
    await conexion.query(queryTallas, valuesTallas);

    const queryMensualidad =
      "INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio, fecha_fin, id_mensualidad, estado) VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), $3, $4, $5)";
    const valuesMensualidad = [ide, nom, fechaFinal, mensu, "Activo"];
    await conexion.query(queryMensualidad, valuesMensualidad);

    // Nueva inserción a la tabla usuarios
    const queryUsuarios =
      "INSERT INTO usuarios (id, nombre, apellido, telefono, correo_electronico, contraseña, id_rol, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";
    const valuesUsuarios = [
      id, // id del cliente como id del usuario
      nom, // nombre
      ape, // apellido
      numero, // telefono
      correo, // correo electronico
      hashedPassword, // contraseña encriptada
      3, // id_rol = 3
      "Activo", // estado = "Activo"
    ];
    await conexion.query(queryUsuarios, valuesUsuarios);

    // Confirmar la transacción
    await conexion.query("COMMIT");

    res.status(200);
    res.render("administrador/clientes/create_clientes", {
      alert: true,
      alertTitle: "Registro Exitoso",
      alertMessage: "Usuario registrado con éxito, Redirigiendo...",
      alertIcon: "success",
      showConfirmButton: false,
      timer: 2500,
      ruta: `/actualizar_tallas/${ide}`,
      mensualidades: resultsMensualidades.rows, // Pasar la lista de mensualidades
    });
  } catch (error) {
    // Si hay un error, revertir la transacción
    await conexion.query("ROLLBACK");
    console.error("Error en la creación del cliente:", error);
    return res.status(500).json({ error: error.message });
  }
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

exports.renovar_cliente = (req, res) => {
  const id = req.body.id;
  const mensualidad = req.body.mensualidad;

  const queryMensualidades =
    "SELECT mes, dias FROM mensualidades WHERE id = $1";

  conexion.query(
    queryMensualidades,
    [mensualidad],
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

      // Calcular la fecha final
      let fechaInicio = new Date();
      fechaInicio.setTime(
        fechaInicio.getTime() + new Date().getTimezoneOffset() * 60000
      );

      if (isNaN(fechaInicio.getTime())) {
        return res.status(400).json({ error: "Fecha de inscripción inválida" });
      }

      fechaInicio.setMonth(fechaInicio.getMonth() + parseInt(meses, 10));
      fechaInicio.setDate(fechaInicio.getDate() + parseInt(dias, 10));
      const fechaFinal = fechaInicio.toISOString().split("T")[0]; // Formato YYYY-MM-DD

      const queryVentas = `SELECT * FROM mensualidad_clientes WHERE id = $1`;
      const valuesVentas = [id];

      conexion.query("BEGIN", (err) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: err.message });
        }

        conexion.query(queryVentas, valuesVentas, (error, resultsVentas) => {
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

          if (resultsVentas.rows.length === 0) {
            return res.status(404).json({ error: "Cliente no encontrado" });
          }
          const id_cliente = resultsVentas.rows[0].id_cliente;
          const clienteNombre = resultsVentas.rows[0].nombre;

          const queryInsertMensualidadCliente =
            "INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio, fecha_fin, id_mensualidad, estado) VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'), $3, $4, $5)";
          const valuesInsertMensualidadCliente = [
            id_cliente,
            clienteNombre,
            fechaFinal,
            mensualidad,
            "Activo",
          ];

          conexion.query(
            queryInsertMensualidadCliente,
            valuesInsertMensualidadCliente,
            (errorInsert) => {
              if (errorInsert) {
                return conexion.query("ROLLBACK", (rollbackErr) => {
                  if (rollbackErr) {
                    console.log(rollbackErr);
                    return res.status(500).json({ error: rollbackErr.message });
                  }
                  console.log(errorInsert);
                  return res.status(500).json({ error: errorInsert.message });
                });
              }

              const queryUpdateEstado =
                "UPDATE mensualidad_clientes SET estado = 'Inactivo' WHERE id = $1 ";
              const valuesUpdateEstado = [id];

              conexion.query(
                queryUpdateEstado,
                valuesUpdateEstado,
                (errorUpdate) => {
                  if (errorUpdate) {
                    return conexion.query("ROLLBACK", (rollbackErr) => {
                      if (rollbackErr) {
                        console.log(rollbackErr);
                        return res
                          .status(500)
                          .json({ error: rollbackErr.message });
                      }
                      console.log(errorUpdate);
                      return res
                        .status(500)
                        .json({ error: errorUpdate.message });
                    });
                  }

                  const queryUpdateCliente =
                    "UPDATE clientes SET estado = 'Activo' WHERE id = $1 ";
                  const valuesUpdateCliente = [id_cliente];

                  conexion.query(
                    queryUpdateCliente,
                    valuesUpdateCliente,
                    (errorUpdate) => {
                      if (errorUpdate) {
                        return conexion.query("ROLLBACK", (rollbackErr) => {
                          if (rollbackErr) {
                            console.log(rollbackErr);
                            return res
                              .status(500)
                              .json({ error: rollbackErr.message });
                          }
                          console.log(errorUpdate);
                          return res
                            .status(500)
                            .json({ error: errorUpdate.message });
                        });
                      }

                      // Si todo está bien, hacemos el COMMIT y redireccionamos
                      conexion.query("COMMIT", (errCommit) => {
                        if (errCommit) {
                          console.log(errCommit);
                          return res
                            .status(500)
                            .json({ error: errCommit.message });
                        }

                        // Redireccionar a otra página después de realizar las operaciones
                        res.redirect("/index_admin"); // Cambia la URL a la que quieres redirigir
                      });
                    }
                  );
                }
              );
            }
          );
        });
      });
    }
  );
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

      // Mostrar una alerta de redirección y redirigir a la selección de mensualidades
      res.render("administrador/mensualidades/registro_exito", {
        tempRegistroId: tempRegistroId, // Pasar el ID del registro temporal a la vista
      });
    });
  } catch (error) {
    console.error("Error al registrar:", error);
    res.status(500).json({ success: false, message: "Error al registrar" });
  }
};

// LOGICA PARA USAR MERCADO PAGO-----------------------------------------------

let TOKEN = process.env.MP_ACCESS_TOKEN_V;
console.log(TOKEN);

mercadopago.configure({
  access_token: TOKEN,
  sandbox: true, // Habilitar modo sandbox
});

exports.createOrder = async (req, res) => {
  const { title, unit_price, tempRegistroId } = req.body;

  if (!title || !unit_price || !tempRegistroId) {
    return renderMensualidadesPage(res, {
      alertTitle: "Advertencia",
      alertMessage: "¡Faltan datos necesarios para crear la orden!",
      alertIcon: "warning",
      showConfirmButton: true,
      tempRegistroId: req.body.tempRegistroId,
      mensualidades: [], // Manejar adecuadamente el resultado de las mensualidades
    });
  }

  try {
    const preference1 = {
      items: [
        {
          title: title,
          unit_price: parseFloat(unit_price),
          currency_id: "COP", // Cambia la moneda según tu caso
          quantity: 1,
        },
      ],
      back_urls: {
        success: `http://localhost:5000/success?tempRegistroId=${tempRegistroId}`,
        failure: `http://localhost:5000/failure?tempRegistroId=${tempRegistroId}`,
        pending: `http://localhost:5000/pending?tempRegistroId=${tempRegistroId}`,
      },
      notification_url: "http://localhost:5000/webhook",
      auto_return: "approved",
    };

    console.log(preference1);

    const result = await mercadopago.preferences.create(preference1);

    // Renderizar la vista de redirección con la URL de Mercado Pago
    return res.render("administrador/mensualidades/redirect-to-mercadopago", {
      init_point: result.body.init_point,
    });
  } catch (error) {
    console.error("Error al crear la orden de pago:", error);
    return renderMensualidadesPage(res, {
      alertTitle: "Error",
      alertMessage: "Hubo un problema al crear la orden de pago.",
      alertIcon: "error",
      showConfirmButton: true,
      tempRegistroId: null,
      mensualidades: [],
    });
  }
};

exports.receiveWebhook = async (req, res) => {
  try {
    const payment = req.query;

    if (payment.type === "payment") {
      const data = await mercadopago.payment.findById(payment["data.id"]);
      console.log(data);
    }

    res.sendStatus(204);
  } catch (error) {
    console.error("Error en el webhook:", error);
    // No es necesario renderizar una página de error aquí ya que los webhooks no devuelven una vista
    res.sendStatus(500);
  }
};

// Función para renderizar la página de mensualidades con alertas
function renderMensualidadesPage(
  res,
  {
    alertTitle,
    alertMessage,
    alertIcon,
    showConfirmButton,
    tempRegistroId,
    mensualidades,
  }
) {
  if (!res.headersSent) {
    res.render("administrador/mensualidades/mensualidades", {
      alertTitle,
      alertMessage,
      alertIcon,
      showConfirmButton,
      tempRegistroId,
      mensualidades,
    });
  }
}

// INICIO DE SESION --------------------------------------------------------------------------------------------------
exports.login = async (req, res) => {
  const user = req.body.user;
  const pass = req.body.pass;

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
// Controlador para registrar ingreso
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
      // Si el cliente no existe, renderizamos la página index con un error
      return res.render("administrador/index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Cliente no encontrado o contraseña incorrecta.",
        alertIcon: "error",
        showConfirmButton: true,
        sonido:
          "https://raw.githubusercontent.com/JeanCardozo/audios/main/usb.mp3",
        ruta: "index_admin",
        ultimosClientes: [], // En caso de error, puedes dejar vacíos los datos
        datosVentas: [],
        datosSumaPorMes: [],
        datosIngresosHoy: [],
        datosVentasVencidas: [],
        datosMensualidades: [],
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
        ultimosClientes: [],
        datosVentas: [],
        datosSumaPorMes: [],
        datosIngresosHoy: [],
        datosVentasVencidas: [],
        datosMensualidades: [],
      });
    }

    // Llamada a la lógica para obtener los datos necesarios antes de renderizar la página

    const fechaHoyBogota = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });

    // Consulta SQL para obtener el total de ventas por mes
    const queryVentas = `
      SELECT 
        mc.id AS id_ventas, 
        mc.fecha_inicio, 
        m.id AS id_mensualidad, 
        m.total_pagar,
        TO_CHAR(mc.fecha_inicio, 'Mon YYYY') AS mes_anio 
      FROM 
        mensualidad_clientes AS mc 
      INNER JOIN 
        mensualidades AS m ON mc.id_mensualidad = m.id
      ORDER BY 
        mc.fecha_inicio DESC;
    `;
    const resultVentas = await conexion.query(queryVentas);
    const datosVentas = resultVentas.rows;

    // Sumar las ventas por mes
    const datosSumaPorMes = datosVentas.reduce((acc, curr) => {
      const mes = curr.mes_anio;
      if (!acc[mes]) {
        acc[mes] = 0;
      }
      acc[mes] += parseFloat(curr.total_pagar);
      return acc;
    }, {});

    const datosSumaArray = Object.keys(datosSumaPorMes).map((mes) => ({
      mes: mes,
      total: datosSumaPorMes[mes],
    }));

    // Consulta SQL para obtener los ingresos de hoy
    const queryIngresosHoy = `
      SELECT 
        ic.fecha_ingresos,
        ic.cantidad_ingresos
      FROM 
        ingresos_clientes AS ic
      WHERE 
        DATE(ic.fecha_ingresos) = $1
      ORDER BY 
        ic.fecha_ingresos DESC;
    `;
    const resultIngresosHoy = await conexion.query(queryIngresosHoy, [
      fechaHoyBogota,
    ]);
    const datosIngresosHoy = resultIngresosHoy.rows;

    // Consulta SQL para obtener los últimos 5 clientes registrados
    const queryUltimosClientes = `
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
    const resultUltimosClientes = await conexion.query(queryUltimosClientes);
    const ultimosClientes = resultUltimosClientes.rows;

    // Consulta SQL para obtener ventas vencidas
    const queryVentasVencidas = `
      SELECT * FROM mensualidad_clientes WHERE estado = 'Vencida' ORDER BY fecha_fin DESC LIMIT 5;
    `;
    const resultVentasVencidas = await conexion.query(queryVentasVencidas);
    const datosVentasVencidas = resultVentasVencidas.rows;

    const querymensualidades = `
      SELECT * FROM mensualidades;
    `;
    const resultMensualidades = await conexion.query(querymensualidades);
    const datosMensualidades = resultMensualidades.rows;

    // Finalmente, renderizamos la vista con todos los datos
    res.render("administrador/index", {
      alert: true,
      alertTitle: "Ingreso registrado",
      alertMessage: "Ingreso registrado correctamente.",
      alertIcon: "success",
      showConfirmButton: true,
      sonido:
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/inicio.mp3",
      ruta: "index_admin",
      datosVentas: datosVentas,
      datosSumaPorMes: datosSumaArray,
      datosIngresosHoy: datosIngresosHoy,
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
      datosMensualidades: datosMensualidades,
    });
  } catch (error) {
    console.error("Error al registrar el ingreso:", error);
    res.status(500).send("Error en el servidor");
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
        return res.status(500).json({ error: error.message });
      }
      console.log("usuarios segun eso", results.rows);
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
       INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id
       ORDER BY id_mensu_cliente`;

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

    console.log("Datos del formulario recibidos:", req.body);

    console.log("Días recibidos:", dias);

    if (!Array.isArray(dias) || dias.length === 0) {
      throw new Error("Los días no son válidos.");
    }
    if (!Array.isArray(actividades)) {
      throw new Error("Las actividades no son válidas.");
    }
    if (typeof seriesRepeticiones !== "object") {
      throw new Error("La estructura de series y repeticiones no es válida.");
    }

    for (const dia of dias) {
      for (const actividad of actividades) {
        const series = seriesRepeticiones[`series_${actividad}`];
        const repeticiones = seriesRepeticiones[`repeticiones_${actividad}`];

        if (series === undefined || repeticiones === undefined) {
          throw new Error(`Faltan datos para la actividad ${actividad}.`);
        }

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
    res
      .status(500)
      .send(
        "Error al guardar el plan de entrenamiento. Por favor, intente de nuevo."
      );
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

  const query = `
    UPDATE mensualidad_clientes
    SET estado = 'Vencida'
    WHERE fecha_fin <= CURRENT_DATE
      AND estado != 'Vencida'
    RETURNING *;
  `;

  conexion.query(query, (error, results) => {
    if (error) {
      console.error(
        "Error al actualizar los estados de mensualidad_clientes:",
        error
      );
      return;
    }

    console.log(`${results.rowCount} registros actualizados a 'Vencida'.`);

    // Ahora hacemos la consulta para obtener los clientes afectados
    const consultaCliente = `
      SELECT id_cliente FROM mensualidad_clientes WHERE estado = 'Vencida';
    `;

    conexion.query(consultaCliente, (error, clientes) => {
      if (error) {
        console.error(
          "Error al obtener los clientes con mensualidades vencidas:",
          error
        );
        return;
      }

      const idsClientes = clientes.rows.map((cliente) => cliente.id_cliente);
      if (idsClientes.length === 0) {
        console.log("No hay clientes con mensualidades vencidas.");
        return;
      }

      // Actualizamos el estado de esos clientes
      const updateCliente = `
        UPDATE clientes
        SET estado = 'Inactivo' -- o el estado deseado
        WHERE id = ANY($1);
      `;

      conexion.query(updateCliente, [idsClientes], (error, results) => {
        if (error) {
          console.error(
            "Error al actualizar el estado de los clientes:",
            error
          );
        } else {
          console.log(
            `${results.rowCount} clientes actualizados a 'Inactivo'.`
          );
        }
      });
    });
  });

  console.log("Finalización de la actualización de estados.");
};

exports.mensaje_ayuda = (req, res) => {
  const id = req.body.id;
  const nom = req.body.nombre;
  const co = req.body.correo;
  const mensajeAyuda = req.body.mensaje_ayuda;

  const query =
    "INSERT INTO pqrs (id,nombre,correo_electronico,mensaje) VALUES ($1,$2,$3,$4)";
  const values = [id, nom, co, mensajeAyuda];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    } else {
      res.redirect("/ayuda"); // Redirigir a la página principal o donde desees
    }
  });
};
