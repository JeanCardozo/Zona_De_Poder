const conexion = require("../database/zona_de_poder_db");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const SECRET_KEY = "Zonadpr"; // Asegúrate de mantener esto en secreto
require("dotenv").config();
const PDFDocument = require("pdfkit"); // Asegúrate de tener pdfkit instalado
const path = require("path");
const multer = require("multer");
const { promisify } = require("util");

// CALENDARIO----------------------------------------------------

exports.crear_evento = (req, res) => {
  const evento = req.body.evento;
  const fecha = req.body.fecha;

  const query = "INSERT INTO eventos (nombre,fecha,estado) VALUES ($1,$2,$3)";
  const values = [evento, fecha, "Activo"];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/index_admin");
    }
  });
};
////////////////////////////////////////////////////////////////// ver pqrs/////////////////////////////////////////////////////////////////////
exports.verPqrss = (req, res) => {
  const query = `
    SELECT * FROM pqrs ORDER BY id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    }

    return res.status(200).json(results.rows);
  });
};
//ROLES--------------------------------------------------------------

//llamado desde create_rol para hacer la insercion a la base de datos en la tabla roles
exports.crearRoles = (req, res) => {
  const rol = req.body.rol;

  const query = "INSERT INTO roles (tipo_de_rol) VALUES ($1)";
  const values = [rol];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_roles?message=success");
    }
  });
};

//llamado desde actualizar para hacer la insercion de update en la base de datos
exports.updateRoles = (req, res) => {
  const id = parseInt(req.body.id, 10);
  const tipo_de_rol = req.body.tipo_de_rol;

  if (id) {
    console.log("Invalid ID:", id);
  }
  const query = "UPDATE roles SET tipo_de_rol=$1 WHERE id = $2";
  const values = [tipo_de_rol, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_roles?message=success");
    }
  });
};

//CLIENTES-------------------------------------------------------------------
// Configuración de multer para manejar la carga de archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
}).single("imagen_perfil");

const uploadAsync = promisify(upload);

exports.crearclienteS = async (req, res) => {
  try {
    // Procesar la subida de la imagen
    await uploadAsync(req, res);

    const {
      id,
      nombre,
      apellido,
      edad,
      sexo,
      correo,
      numero,
      mensualidad,
      usuario,
    } = req.body;

    // Procesar los datos de la imagen
    let imagenBuffer = null;
    let imagenContentType = null;
    if (req.file) {
      imagenBuffer = req.file.buffer;
      imagenContentType = req.file.mimetype;
    }

    const queryMensualidades =
      "SELECT mes, dias FROM mensualidades WHERE id = $1";
    const resultsMensualidades = await conexion.query(queryMensualidades, [
      mensualidad,
    ]);

    if (resultsMensualidades.rows.length === 0) {
      return res.status(404).json({ error: "Mensualidad no encontrada" });
    }

    const { mes: meses, dias } = resultsMensualidades.rows[0];

    // Calcular la fecha final
    let fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() + parseInt(meses, 10));
    fechaInicio.setDate(fechaInicio.getDate() + parseInt(dias, 10));
    const fechaFinal = fechaInicio.toISOString().split("T")[0];

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(id, saltRounds);

    // Iniciar transacción
    await conexion.query("BEGIN");

    const queryClientes = `
      INSERT INTO clientes (id, nombre, apellido, edad, sexo, fecha_de_inscripcion, correo_electronico, numero_telefono, id_mensualidad, id_usuario, estado, contraseña)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota', $6, $7, $8, $9, 'Activo', $10) RETURNING id
    `;
    const valuesClientes = [
      id,
      nombre,
      apellido,
      edad,
      sexo,
      correo,
      numero,
      mensualidad,
      usuario,
      hashedPassword,
    ];

    const resultClientes = await conexion.query(queryClientes, valuesClientes);

    const ide = resultClientes.rows[0].id;

    // Insertar datos en otras tablas
    const queryTallas = `
      INSERT INTO tallas (id_cliente, nombre, fecha)
       VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
    `;
    await conexion.query(queryTallas, [ide, nombre]);

    const queryMensualidad = `
      INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio, fecha_fin, id_mensualidad, estado)
       VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota', $3, $4, 'Activo')
    `;
    await conexion.query(queryMensualidad, [
      ide,
      nombre,
      fechaFinal,
      mensualidad,
    ]);

    const queryUsuarios = `
  INSERT INTO usuarios (id, nombre, apellido, telefono, correo_electronico, contraseña, id_rol, estado, imagen_perfil, imagen_content_type)
  VALUES ($1, $2, $3, $4, $5, $6, 3, 'Activo', $7, $8)
`;
    await conexion.query(queryUsuarios, [
      id,
      nombre,
      apellido,
      numero,
      correo,
      hashedPassword,
      imagenBuffer, // Nuevo dato
      imagenContentType, // Nuevo dato
    ]);

    // Confirmar la transacción
    await conexion.query("COMMIT");

    // Redirigir a la vista de actualización de tallas con éxito
    res.redirect(`/actualizar_tallas/${ide}?pdf=true`);
  } catch (error) {
    await conexion.query("ROLLBACK");
    console.error("Error en la creación del cliente:", error);
    return res.status(500).sendFile(__dirname + ".././views/500.html");
  }
};

// Controlador para renderizar el formulario de actualización (GET)

// Controlador para manejar la actualización de un cliente (POST)
exports.update_cliente = async (req, res) => {
  try {
    await uploadAsync(req, res);

    console.log("Archivo subido correctamente o no se subió ningún archivo.");
    console.log("req.body:  ", req.body);

    const id = parseInt(req.body.id, 10);
    if (isNaN(id)) {
      throw new Error("ID no válido.");
    }
    const nombre = req.body.nombre;
    const apellido = req.body.apellido;
    const edad = parseInt(req.body.edad, 10);
    const sexo = req.body.sexo;
    const correo_electronico = req.body.correo_electronico;
    const numero_telefono = parseInt(req.body.numero_telefono, 10);
    const id_mensualidad = parseInt(req.body.id_mensualidad, 10);
    const estado = req.body.estado;
    const contraseña = req.body.contra;

    console.log("Datos recibidos:", req.body);
    // Convertir y validar tipos de datos

    console.log("Datos convertidos:", {
      id,
      edad,
      id_mensualidad,
      numero_telefono,
    });

    if (
      [id, edad, numero_telefono].includes(NaN) ||
      (id_mensualidad !== null && isNaN(id_mensualidad))
    ) {
      console.error("Validación fallida: Datos numéricos inválidos.");
      return res.status(400).json({
        error: "Datos inválidos proporcionados. Verifica los campos numéricos.",
      });
    }

    // Iniciar la transacción
    await conexion.query("BEGIN");
    console.log("Transacción iniciada.");

    let query;
    let values;

    if (contraseña) {
      const hashedPassword = await bcrypt.hash(contraseña, 10);
      query = `
        UPDATE clientes 
        SET nombre = $1, apellido = $2, edad = $3, sexo = $4, 
            correo_electronico = $5, numero_telefono = $6, id_mensualidad = $7, contraseña = $8
        WHERE id = $9
      `;
      values = [
        nombre,
        apellido,
        edad,
        sexo,
        correo_electronico,
        numero_telefono,
        id_mensualidad,
        hashedPassword,
        id,
      ];

      // Actualizar la contraseña en la tabla de usuarios
      const queryUpdateUsuario = `
        UPDATE usuarios 
        SET contraseña = $1
        WHERE id = $2
      `;
      const valuesUpdateUsuario = [hashedPassword, id];
      await conexion.query(queryUpdateUsuario, valuesUpdateUsuario);
    } else {
      query = `
        UPDATE clientes 
        SET nombre = $1, apellido = $2, edad = $3, sexo = $4, 
            correo_electronico = $5, numero_telefono = $6, id_mensualidad = $7
        WHERE id = $8
      `;
      values = [
        nombre,
        apellido,
        edad,
        sexo,
        correo_electronico,
        numero_telefono,
        id_mensualidad,
        id,
      ];
    }

    // Actualizar los datos principales del cliente
    await conexion.query(query, values);
    console.log("Datos del cliente actualizados.");

    // Actualizar la imagen solo si se ha subido una nueva
    if (req.file) {
      const imagenBuffer = req.file.buffer;
      const imagenContentType = req.file.mimetype;

      const queryUpdateImagenUsuario = `
        UPDATE usuarios 
        SET imagen_perfil = $1, imagen_content_type = $2
        WHERE id = $3
      `;
      const valuesUpdateImagenUsuario = [imagenBuffer, imagenContentType, id];
      await conexion.query(queryUpdateImagenUsuario, valuesUpdateImagenUsuario);
    }

    // Confirmar la transacción
    await conexion.query("COMMIT");
    console.log("Transacción confirmada.");

    // Enviar respuesta de éxito
    res.status(200).json({
      alert: true,
      alertTitle: "Actualización Exitosa",
      alertMessage: "Cliente actualizado correctamente.",
      alertIcon: "success",
      showConfirmButton: false,
      timer: 2500,
      ruta: "/ver_clientes",
    });
  } catch (error) {
    console.error("Error en la actualización del cliente:", error);

    // Si ocurre un error, revertir la transacción
    try {
      await conexion.query("ROLLBACK");
      console.log("Transacción revertida.");
    } catch (rollbackError) {
      console.error("Error al hacer ROLLBACK:", rollbackError);
    }

    res.status(500).sendFile(__dirname + ".././views/500.html");
  }
};

exports.renovar_cliente = (req, res) => {
  const id = req.body.id;
  const mensualidad = req.body.mensualidad;

  const queryMensualidades =
    "SELECT mes, dias, total_pagar FROM mensualidades WHERE id = $1";

  conexion.query(
    queryMensualidades,
    [mensualidad],
    (errorMensualidades, resultsMensualidades) => {
      if (errorMensualidades) {
        return res.status(500).sendFile(__dirname + ".././views/500.html");
      }

      if (resultsMensualidades.rows.length === 0) {
        return res.status(404).json({ error: "Mensualidad no encontrada" });
      }

      const { mes: meses, dias, total_pagar } = resultsMensualidades.rows[0];

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
          return res.status(500).sendFile(__dirname + ".././views/500.html");
        }

        conexion.query(queryVentas, valuesVentas, (error, resultsVentas) => {
          if (error) {
            return conexion.query("ROLLBACK", (rollbackErr) => {
              if (rollbackErr) {
                console.log(rollbackErr);
                return res
                  .status(500)
                  .sendFile(__dirname + ".././views/500.html");
              }
              console.log(error);
              return res
                .status(500)
                .sendFile(__dirname + ".././views/500.html");
            });
          }

          if (resultsVentas.rows.length === 0) {
            return res.status(404).json({ error: "Cliente no encontrado" });
          }
          const id_cliente = resultsVentas.rows[0].id_cliente;
          const clienteNombre = resultsVentas.rows[0].nombre;

          const queryInsertMensualidadCliente =
            "INSERT INTO mensualidad_clientes (id_cliente, nombre, fecha_inicio, fecha_fin, id_mensualidad, estado) VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'),$3, $4, $5)";
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
                    return res
                      .status(500)
                      .sendFile(__dirname + ".././views/500.html");
                  }
                  console.log(errorInsert);
                  return res
                    .status(500)
                    .sendFile(__dirname + ".././views/500.html");
                });
              }

              const queryUpdateEstado =
                "UPDATE mensualidad_clientes SET estado = 'Inactivo' WHERE id = $1 ";
              const valuesUpdateEstado = [id];

              conexion.query(
                queryUpdateEstado,
                valuesUpdateEstado,
                (errorUpdate) => {
                  // <-- El callback correcto
                  if (errorUpdate) {
                    return conexion.query("ROLLBACK", (rollbackErr) => {
                      if (rollbackErr) {
                        return res
                          .status(500)
                          .sendFile(__dirname + "/500.html");
                      }
                      console.log(errorUpdate);
                      return res.status(500).sendFile(__dirname + "/500.html");
                    });
                  }

                  const queryUpdateCliente =
                    "UPDATE clientes SET estado = 'Activo', id_mensualidad = $1 WHERE id = $2";
                  const valuesUpdateCliente = [mensualidad, id_cliente];

                  conexion.query(
                    queryUpdateCliente,
                    valuesUpdateCliente,
                    (errorUpdateCliente) => {
                      if (errorUpdateCliente) {
                        return conexion.query("ROLLBACK", (rollbackErr) => {
                          if (rollbackErr) {
                            return res
                              .status(500)
                              .sendFile(__dirname + "/500.html");
                          }
                          console.log(errorUpdateCliente);
                          return res
                            .status(500)
                            .sendFile(__dirname + "/500.html");
                        });
                      }

                      // Si todo está bien, hacemos el COMMIT y redireccionamos
                      conexion.query("COMMIT", (errCommit) => {
                        if (errCommit) {
                          console.log(errCommit);
                          return res
                            .status(500)
                            .sendFile(__dirname + "/500.html");
                        }

                        res.redirect("/index_admin");
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
  try {
    // Procesar la carga de archivos
    await uploadAsync(req, res);

    console.log(req.file);

    const { id, nombre, ape, telefono, correo, contra, roles } = req.body;
    const tele = parseInt(telefono);

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(contra, saltRounds);

    // Preparar los datos de la imagen
    let imagenBuffer = null;
    let imagenContentType = null;
    if (req.file) {
      imagenBuffer = req.file.buffer;
      imagenContentType = req.file.mimetype;
    }

    // Preparar la consulta con la contraseña encriptada y la imagen
    const query =
      "INSERT INTO usuarios (id, nombre, apellido, telefono, correo_electronico, contraseña, id_rol, estado, imagen_perfil, imagen_content_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)";
    const values = [
      id,
      nombre,
      ape,
      tele,
      correo,
      hashedPassword,
      roles,
      "Activo",
      imagenBuffer,
      imagenContentType,
    ];

    // Ejecutar la consulta
    await conexion.query(query, values);

    // Obtener la lista de roles para mostrar en el formulario
    const rolesQuery = "SELECT * FROM roles";
    const rolesResults = await conexion.query(rolesQuery);

    return res.render("administrador/usuarios/create_usuarios", {
      alert: true,
      alertTitle: "Éxito",
      alertMessage: "Usuario Creado correctamente.",
      alertIcon: "success",
      showConfirmButton: true,
      ruta: "/ver_usuarios",
      roles: rolesResults.rows,
    });
  } catch (error) {
    console.error("Error al crear el usuario:", error);

    // Obtener la lista de roles para mostrar en el formulario en caso de error
    const rolesQuery = "SELECT * FROM roles";
    const rolesResults = await conexion.query(rolesQuery);

    let errorMessage = "Error al crear el usuario.";
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        errorMessage =
          "El archivo es demasiado grande. El tamaño máximo es de 2 MB.";
      }
    }

    return res.render("administrador/usuarios/create_usuarios", {
      alert: true,
      alertTitle: "Error",
      alertMessage: errorMessage,
      alertIcon: "error",
      showConfirmButton: true,
      roles: rolesResults.rows,
    });
  }
};

exports.update_usuarios = async (req, res) => {
  try {
    // Procesar la subida de la imagen
    await uploadAsync(req, res);

    // Verificar que los datos llegan correctamente
    console.log("req.body:", req.body); // Verifica que los datos del formulario están aquí
    console.log("req.file:", req.file); // Verifica que la imagen ha sido subida

    const id = parseInt(req.body.id, 10); // Aquí debería venir el ID
    if (isNaN(id)) {
      throw new Error("ID no válido.");
    }

    const nombre = req.body.nombre;
    const ape = req.body.apellido;
    const telefono = req.body.telefono;
    const correo = req.body.correo_electronico;
    const contraseña = req.body.contra;
    const rol = req.body.roles;
    const queryRoles = "SELECT id, tipo_de_rol FROM roles";
    const rolesResult = await conexion.query(queryRoles);
    const roles = rolesResult.rows;
    let query;
    let values;

    if (contraseña) {
      const hashedPassword = await bcrypt.hash(contraseña, 10);
      query = `
        UPDATE usuarios 
        SET nombre = $1, apellido = $2, telefono = $3, correo_electronico = $4, contraseña = $5, id_rol = $6
        WHERE id = $7
      `;
      values = [nombre, ape, telefono, correo, hashedPassword, rol, id];
    } else {
      query = `
        UPDATE usuarios 
        SET nombre = $1, apellido = $2, telefono = $3, correo_electronico = $4, id_rol = $5
        WHERE id = $6
      `;
      values = [nombre, ape, telefono, correo, rol, id];
    }

    // Si se ha subido una imagen, actualizamos la imagen en la base de datos
    if (req.file) {
      const imagenBuffer = req.file.buffer;
      const imagenContentType = req.file.mimetype;

      query = `
        UPDATE usuarios 
        SET nombre = $1, apellido = $2, telefono = $3, correo_electronico = $4, id_rol = $5, imagen_perfil = $6, imagen_content_type = $7
        WHERE id = $8
      `;
      values = [
        nombre,
        ape,
        telefono,
        correo,
        rol,
        imagenBuffer,
        imagenContentType,
        id,
      ];
    }

    // Ejecutar la consulta
    await conexion.query(query, values);

    return res.render("administrador/usuarios/actualizar_usuarios", {
      user: { id, nombre, ape, telefono, correo },
      roles,
      alert: true,
      alertTitle: "Éxito",
      alertMessage: "Usuario actualizado correctamente.",
      alertIcon: "success",
      showConfirmButton: true,
      ruta: "/ver_usuarios",
    });
  } catch (error) {
    console.error("Error al actualizar el usuario:", error);

    const queryRoles = "SELECT id, tipo_de_rol FROM roles";
    const rolesResult = await conexion.query(queryRoles);
    const roles = rolesResult.rows;

    return res.render("administrador/usuarios/actualizar_usuarios", {
      user: {
        id: req.body.id,
        nombre: req.body.nombre,
        ape: req.body.apellido,
        telefono: req.body.telefono,
        correo: req.body.correo_electronico,
      },
      roles,
      alert: true,
      alertTitle: "Error",
      alertMessage: "Error en la operación.",
      alertIcon: "error",
      showConfirmButton: true,
      ruta: `/actualizar_usuarios/${req.body.id}`,
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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

  const query = `
    UPDATE tallas 
    SET medida_pecho = $1, medida_brazo = $2, medida_cintura = $3, medida_abdomen = $4, 
        medida_cadera = $5, medida_pierna = $6, medida_pantorrilla = $7, peso = $9, altura = $10 
    WHERE id = $8`;

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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      const queryUser = "SELECT * FROM tallas WHERE id = $1";
      conexion.query(queryUser, [id], (errorUser, resultsUser) => {
        if (errorUser) {
          console.log(errorUser);
          return res.status(500).sendFile(__dirname + ".././views/500.html");
        }

        const queryCliente = "SELECT * FROM clientes WHERE id = $1";
        conexion.query(
          queryCliente,
          [id_cliente],
          (errorCliente, resultsCliente) => {
            if (errorCliente) {
              console.log(errorCliente);
              return res
                .status(500)
                .sendFile(__dirname + ".././views/500.html");
            }

            // Asegúrate de pasar userData al renderizado de la vista
            res.redirect(
              `/actualizar_tallas/${id_cliente}?mensaje=${encodeURIComponent(
                "Tallas actualizadas con éxito."
              )}`
            );
          }
        );
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_convenio?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_convenio?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    }
    res.redirect("/ver_convenio");
  });
};

// crear mensualidad fija
exports.crearMensu = (req, res) => {
  const tipo = req.body.con;
  const tiempo = req.body.tiempo;
  const pagar = req.body.pagar;

  const mes = req.body.meses;
  const dia = req.body.dias;

  const query =
    "INSERT INTO mensualidades (total_pagar,id_mensualidad_convencional,tiempo_plan, mes, dias) VALUES ($1,$2,$3,$4,$5)";
  const values = [pagar, tipo, tiempo, mes, dia];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_mensualidad?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_mensualidad?message=success");
    }
  });
};

// REGISTRAR --------------------------------------------------------------------------
exports.register = async (req, res) => {
  const { id, nombre, apellido, correo, telefono, edad, sexo, pass } = req.body;

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
      INSERT INTO temp_registro (id_usuario, nombre, apellido, correo, telefono, contraseña, edad, sexo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_usuario;
    `;
    const values = [
      id,
      nombre,
      apellido,
      correo,
      telefono,
      hashedPassword,
      edad,
      sexo,
    ];

    conexion.query(query, values, (error, result) => {
      if (error) {
        console.error("Error en la base de datos:", error);
        return res.status(500).json({
          success: false,
          message: "Error en la base de datos",
        });
      }

      const tempRegistroId = result.rows[0].id_usuario;

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
      `SELECT u.id, u.contraseña, u.estado, u.id_rol, r.tipo_de_rol, u.nombre, u.imagen_perfil, u.imagen_content_type
       FROM usuarios as u
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
    console.log("ver el resultado en el login userData", userData);

    // Verificación de la contraseña
    const isPasswordValid = await bcrypt.compare(pass, userData.contraseña);
    if (!isPasswordValid) {
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

    // Guardar la información del usuario, incluyendo la imagen, en la sesión
    req.session.userData = {
      id: userData.id,
      nombre_usuario: userData.nombre,
      role: userData.id_rol,
      imagen_perfil: userData.imagen_perfil
        ? `/profile-image/${userData.id}`
        : "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png",
    };

    console.log(
      "Datos del usuario guardados en la sesión:",
      req.session.userData
    );

    req.session.userData;
    // Genera el token
    const token = generateToken(userData);
    setTokenCookie(res, token);

    const routeByRole = {
      1: "index_admin",
      2: "index_entrenador",
      3: "clientes/index_c",
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
      userData: req.session.userData, // Aquí pasas los datos del usuario a la vista
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
    role: userData.id_rol, // Incluye el ID del usuario y su rol en el payload
  };
  return jwt.sign(userPayload, SECRET_KEY, { expiresIn: "2h" });
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true, // Solo accesible a través del protocolo HTTP (no accesible desde JavaScript en el navegador)
    secure: process.env.NODE_ENV === "production", // Solo se envía a través de HTTPS en producción
    sameSite: "strict", // Protege contra ataques CSRF
    maxAge: 2 * 60 * 60 * 1000, // La cookie expira en 2 horas
  });
}

// GRUPOS MUSCULARES ---------------------------------------------------

//CREAR
exports.crear_gm = (req, res) => {
  const nombre = req.body.musculo;
  const seccion = req.body.seccion;

  const query = "INSERT INTO grupos_musculares (nombre,seccion) VALUES ($1,$2)";
  const values = [nombre, seccion];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_grupo_muscular?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_grupo_muscular?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_acti_fisica?message=success");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ver_acti_fisica?message=success");
    }
  });
};

// PLAN DE ENTRENAMIENTO --------------------------------------------------------------------------------------------------------------

exports.verPlanEnt = (req, res) => {
  const planEntrenamientoQuery = `
    SELECT 
      id_cliente,
      ARRAY_AGG(JSON_BUILD_OBJECT(
        'id', id,
        'dia', dia,
        'ejercicio', ejercicio,
        'series', series,
        'repeticiones', repeticiones
      )) AS planes
    FROM 
      plan_entrenamiento
    GROUP BY 
      id_cliente
    ORDER BY 
      id_cliente ASC;
  `;

  conexion.query(planEntrenamientoQuery, (error, planResults) => {
    if (error) {
      console.log("ver monda error ", error);
      return res.status(500).sendFile(__dirname + "../views/500.html");
    }

    if (planResults.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No se encontraron planes de entrenamiento" });
    }

    const clienteIds = planResults.rows.map((plan) => plan.id_cliente);

    const clienteQuery = `
      SELECT id, nombre 
      FROM clientes 
      WHERE id = ANY($1::int[])
    `;
    conexion.query(
      clienteQuery,
      [clienteIds],
      (clienteError, clienteResults) => {
        if (clienteError) {
          console.log("ver monda error 2 ", error);
          return res.status(500).sendFile(__dirname + ".././views/500.html");
        }

        const clientes = {};
        clienteResults.rows.forEach((cliente) => {
          clientes[cliente.id] = cliente.nombre;
        });

        const planesConNombreCliente = planResults.rows.map((plan) => ({
          id_cliente: plan.id_cliente,
          nombre_cliente: clientes[plan.id_cliente] || "Nombre no encontrado",
          planes: plan.planes,
        }));

        return res.status(200).json(planesConNombreCliente);
      }
    );
  });
};

//CREAR PLAN DE ENTRENAMIENTO CON FORMULARIOS DIFERENTES(DEJARLO TAL CUAL ESTA A MENOS QUE SE QUIERA MODIFICAR LA LOGICA)

exports.mostrarFormularioVacio = (req, res) => {
  conexion.query(
    "SELECT id, nombre_ejercicio FROM actividad_fisica",
    (error, actividadesResults) => {
      if (error) {
        return res.status(500).sendFile(__dirname + ".././views/500.html");
      }
      console.log("actividades fisicas: ", actividadesResults.rows);
      res.render("administrador/plan_de_entrenamiento/create_plan_ent", {
        id_cliente: null,
        actividades: actividadesResults.rows,
      });
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
        ultimosClientes: [],
        datosVentas: [],
        datosSumaPorMes: [],
        datosIngresosHoy: [],
        datosVentasVencidas: [],
        datosMensualidades: [],
      });
    }

    // Obtener el cliente y su estado
    const cliente = clienteResult.rows[0];

    // Verificar el estado del cliente
    if (cliente.estado === "Inactivo" || cliente.estado === "Vencida") {
      return res.render("administrador/index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Cliente inactivo, no se puede registrar el ingreso.",
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

    // Verificar si la mensualidad está vencida
    const mensualidadQuery = "SELECT * FROM mensualidades WHERE id = $1";
    const mensualidadResult = await conexion.query(mensualidadQuery, [
      cliente.id_mensualidad,
    ]);

    if (
      mensualidadResult.rowCount === 0 ||
      mensualidadResult.rows[0].estado === "Vencida"
    ) {
      return res.render("administrador/index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Mensualidad vencida, no se puede registrar el ingreso.",
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
    res.status(500).sendFile(__dirname + ".././views/500.html");
  }
};

exports.registrarIngresoentre = async (req, res) => {
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
      return res.render("entrenador/index_entrenador", {
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
      return res.render("entrenador/index_entrenador", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Error al registrar el ingreso.",
        alertIcon: "error",
        showConfirmButton: true,
        sonido:
          "https://raw.githubusercontent.com/JeanCardozo/audios/main/usb.mp3",
        ruta: "/index_entrenador",
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
    res.render("entrenador/index_entrenador", {
      alert: true,
      alertTitle: "Ingreso registrado",
      alertMessage: "Ingreso registrado correctamente.",
      alertIcon: "success",
      showConfirmButton: true,
      sonido:
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/inicio.mp3",
      ruta: "/index_entrenador",
      datosVentas: datosVentas,
      datosSumaPorMes: datosSumaArray,
      datosIngresosHoy: datosIngresosHoy,
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
      datosMensualidades: datosMensualidades,
    });
  } catch (error) {
    console.error("Error al registrar el ingreso:", error);
    res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    }

    return res.status(200).json(results.rows);
  });
};

exports.verUsuarios = (req, res) => {
  conexion.query(
    `SELECT u.id AS id_usuarios, u.nombre, u.apellido, u.telefono, u.correo_electronico , u.contraseña, u.id_rol, u.estado,
            r.id AS id_roles, r.tipo_de_rol AS rol 
     FROM usuarios AS u 
     INNER JOIN roles AS r ON u.id_rol = r.id 
     WHERE u.id_rol IN ($1, $2) ORDER BY u.id`,
    [1, 2],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
WHERE mc.estado IS NOT NULL
  AND mc.id_cliente IS NOT NULL
  AND mc.nombre IS NOT NULL
  AND mc.fecha_inicio IS NOT NULL
  AND mc.fecha_fin IS NOT NULL
  AND mc.id_mensualidad IS NOT NULL
  AND m.id IS NOT NULL
  AND m.tiempo_plan IS NOT NULL
  AND m.total_pagar IS NOT NULL
  AND m.id_mensualidad_convencional IS NOT NULL
  AND mensu.id IS NOT NULL
  AND mensu.tipo_de_mensualidad IS NOT NULL
ORDER BY mc.id;`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    }

    return res.status(200).json(results.rows);
  });
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
      return res.status(500).sendFile(__dirname + ".././views/500.html");
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
    "INSERT INTO pqrs (identificacion,nombre,correo_electronico,mensaje) VALUES ($1,$2,$3,$4)";
  const values = [id, nom, co, mensajeAyuda];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/ayuda?message=success");
    }
  });
};

exports.ventasDiarias = async (req, res) => {
  try {
    // Obtener la fecha actual en formato ISO 8601
    const fechaInicio = new Date().toISOString().split("T")[0]; // Formato YYYY-MM-DD

    await conexion.query(
      "INSERT INTO mensualidad_clientes (fecha_inicio, id_mensualidad) VALUES ($1, $2)",
      [fechaInicio, 5]
    );

    // Redirige al cliente a la ruta deseada
    res.redirect("/ver_ventas");
  } catch (error) {
    console.error("Error al insertar datos en ventas_diarias:", error);
    res.status(500).sendFile(__dirname + "../500.html");
  }
};

exports.update_info = (req, res) => {
  const id = req.body.id;
  const nom = req.body.nombre;
  const ape = req.body.apellido;
  const co = req.body.correo;
  const num = req.body.numero;

  const query =
    "UPDATE clientes SET nombre = $1, apellido = $2, correo_electronico = $3, numero_telefono=$4 WHERE id = $5";
  const values = [nom, ape, co, num, id];

  conexion.query(query, values, (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).sendFile(__dirname + ".././views/500.html");
    } else {
      res.redirect("/clientes/index_c");
    }
  });
};
