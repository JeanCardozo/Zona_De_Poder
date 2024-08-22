const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const paginationMiddleware = require("./middleware/paginationMiddleware");
const SECRET_KEY = "negrosdemierda";
const path = require("path");
const crud = require("./controllers/crud");

// andrey haga el diseño mejor

// Middleware para verificar el token JWT
function autenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).render("login_index", {
      alert: true,
      alertTitle: "Unauthorized",
      alertMessage: "Debes iniciar sesión para acceder a esta página",
      alertIcon: "error",
      showConfirmButton: true,
      timer: false,
      ruta: "login_index",
    });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).render("login_index", {
        alert: true,
        alertTitle: "Error",
        alertMessage: "Token inválido o expirado",
        alertIcon: "error",
        showConfirmButton: true,
        timer: false,
        ruta: "login_index",
      });
    }
    req.user = user; // Guarda la información del usuario en req.user
    next();
  });
}

// Raíz de todo
router.get("/", (req, res) => {
  res.render("index_p");
});

// Asegúrate de que también exista esta ruta
router.get("/index_p", (req, res) => {
  res.render("index_p");
});

// Login
router.get("/login_index", (req, res) => {
  res.render("login_index");
});

// Registrar
router.get("/registrar", (req, res) => {
  res.render("registrar");
});

// Función para limpiar la caché después del logout
router.use(function (req, res, next) {
  if (!req.user) {
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.header("Expires", "-1");
    res.header("Pragma", "no-cache");
  }
  next();
});

//Logout
router.get("/logout", (req, res) => {
  res.clearCookie("token"); // Elimina la cookie del token
  res.redirect("/?logout=success"); // Redirige a la página principal con el mensaje de éxito
});

// Administrador
router.get("/index_admin", autenticateToken, (req, res) => {
  res.render("administrador/index");
});

//ver ROLES

router.get("/ver_roles", autenticateToken, (req, res) => {
  conexion.query("SELECT * FROM roles ORDER BY id", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("administrador/roles/ver_roles", { results: results.rows });
  });
});

// Editar Roles

router.get("/actualizar/:id", (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM roles WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        // Enviar los datos del rol como JSON
        res.json(results.rows[0]);
      } else {
        res.status(404).json({ error: "Rol no encontrado" });
      }
    }
  );
});

// Eliminar roles

router.get("/eliminarRol/:id", (req, res) => {
  const id = parseInt(req.params.id, 10); // Usa 'id' en lugar de 'iden' y asegúrate de que se convierte a entero

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" }); // Manejo del caso donde 'id' no es un número válido
  }

  conexion.query("DELETE FROM roles WHERE id = $1", [id], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.redirect("/ver_roles");
  });
});

//-----------------------------------------------------------

//ruta para ver clientes

router.get("/ver_clientes", autenticateToken, (req, res) => {
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

    res.render("administrador/clientes/ver_clientes", {
      results: results.rows,
    });
  });
});

router.get("/tallas/:id", autenticateToken, (req, res) => {
  const clientId = req.params.id;

  // Consulta para obtener el nombre del cliente
  const clientQuery = `SELECT nombre FROM clientes WHERE id = $1`;

  // Consulta para obtener las tallas del cliente
  const sizesQuery = `
    SELECT medida_pecho, medida_brazo, medida_cintura, medida_abdomen, medida_cadera, medida_pierna, medida_pantorrilla, peso, altura
    FROM tallas_temporales
    WHERE id_cliente = $1`;

  // Ejecutar las dos consultas
  conexion.query(clientQuery, [clientId], (clientError, clientResults) => {
    if (clientError) {
      return res.status(500).json({ error: clientError.message });
    }

    const clientName = clientResults.rows[0]?.nombre;

    conexion.query(sizesQuery, [clientId], (sizesError, sizesResults) => {
      if (sizesError) {
        return res.status(500).json({ error: sizesError.message });
      }

      // Enviar tanto el nombre del cliente como las tallas
      res.json({
        clientName: clientName,
        sizes: sizesResults.rows,
      });
    });
  });
});

// crear clientes
router.get("/create_clientes", (req, res) => {
  const queryMensualidades =
    "SELECT id, total_pagar, tiempo_plan FROM mensualidades";
  const queryUsuarios = "SELECT id, nombre FROM usuarios";

  Promise.all([
    conexion.query(queryMensualidades),
    conexion.query(queryUsuarios),
  ])
    .then(([mensualidadesResult, usuariosResult]) => {
      const mensualidades = mensualidadesResult.rows;
      const usuarios = usuariosResult.rows;

      res.render("administrador/clientes/create_clientes", {
        mensualidades: mensualidades,
        usuarios: usuarios,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: error.message });
    });
});

// para editar clientes
router.get("/actualizar_clientes/:id", (req, res) => {
  const id = req.params.id;

  // Consulta para obtener la información del cliente
  const queryCliente = `
    SELECT id AS id_cliente, nombre, apellido, edad, sexo, fecha_de_inscripcion, 
           correo_electronico, numero_telefono, id_mensualidad, estado 
    FROM clientes 
    WHERE id = $1
  `;

  // Consulta para obtener todas las mensualidades
  const queryMensualidades = `
    SELECT id AS id_mensu, tiempo_plan, total_pagar 
    FROM mensualidades
  `;

  // Ejecutar ambas consultas
  conexion.query(queryCliente, [id], (errorCliente, resultsCliente) => {
    if (errorCliente) {
      return res.status(500).json({ error: errorCliente.message });
    }

    if (resultsCliente.rowCount > 0) {
      const user = resultsCliente.rows[0];

      // Ejecutar la consulta para obtener las mensualidades
      conexion.query(
        queryMensualidades,
        (errorMensualidades, resultsMensualidades) => {
          if (errorMensualidades) {
            return res.status(500).json({ error: errorMensualidades.message });
          }

          const mensualidades = resultsMensualidades.rows.map((row) => ({
            id_mensu: row.id_mensu,
            tiempo_plan: row.tiempo_plan,
            total_pagar: row.total_pagar,
          }));

          // Renderizar la página con la información del cliente y todas las mensualidades
          res.render("administrador/clientes/actualizar_clientes", {
            user,
            mensualidades,
          });
        }
      );
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
});

//usuarios

// /ver_usuarios
router.get("/ver_usuarios", (req, res) => {
  conexion.query(
    "SELECT u.id AS id_usuario ,u.nombre ,u.apellido,u.telefono,u.correo_electronico,u.contraseña, u.id_rol, u.estado,r.id AS id_roles, r.tipo_de_rol AS rol FROM usuarios AS u INNER JOIN roles AS r ON u.id_rol=r.id ORDER BY u.id ",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("administrador/usuarios/ver_usuarios", {
        results: results.rows,
      });
    }
  );
});

// CREAR USUARIOS

router.get("/create_usuarios", (req, res) => {
  conexion.query(
    "SELECT id, tipo_de_rol FROM roles",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.render("administrador/usuarios/create_usuarios", {
        results: results.rows,
      });
    }
  );
});

router.get("/actualizar_usuarios/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  conexion.query(
    "SELECT * FROM usuarios WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        res.render("administrador/usuarios/actualizar_usuarios", {
          user: results.rows[0],
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

// -------------------------------------------

//TALLAS

//VER TALLAS
router.get("/ver_talla", (req, res) => {
  conexion.query(
    "SELECT * FROM tallas ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("administrador/tallas/ver_talla", { results: results.rows });
    }
  );
});

//CREAR TALLA
router.get("/create_talla", (req, res) => {
  conexion.query(
    "SELECT id FROM tallas",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.render("administrador/tallas/create_talla", {
        results: results.rows,
      });
    }
  );
});

//ACTUALIZAR TALLAS

router.get("/actualizar_tallas/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);

  conexion.query(
    "SELECT * FROM tallas WHERE id_cliente = $1 ",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        res.render("administrador/tallas/actualizar_tallas", {
          user: results.rows[0],
          ide: req.params.ide,
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

// ver comvenios
router.get("/ver_convenio", (req, res) => {
  conexion.query(
    "SELECT * FROM mensualidad_convencional ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }
      res.render("administrador/convenio/ver_mensualidad", {
        results: results.rows,
      });
    }
  );
});

// crear convenio
router.get("/create_convenio", (req, res) => {
  res.render("administrador/convenio/create_convenio");
});

// actualizar convenio
router.get("/actualizar_convenio/:id", (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM mensualidad_convencional WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        // Enviar los datos del rol como JSON
        res.json(results.rows[0]);
      } else {
        res.status(404).json({ error: "mensualidad no encontrada" });
      }
    }
  );
});

/////////////////////////////////////////////////////////// Ver mensualidad

router.get("/ver_mensualidad", (req, res) => {
  // Corrige la consulta SQL
  const query =
    "SELECT  m.id AS id_mensualidad,m.total_pagar,mc.tipo_de_mensualidad,m.tiempo_plan FROM mensualidades AS m INNER JOIN mensualidad_convencional AS mc ON m.id_mensualidad_convencional =mc.id ORDER BY m.id";

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("administrador/mensualidades/ver_mensualidad", {
      results: results.rows || results,
    });
  });
});

router.get("/actualizar_mensualidad/:id", (req, res) => {
  const id = req.params.id;

  const queryMensualidad = `
    SELECT m.id AS id_mensualidad, m.total_pagar, m.tiempo_plan, mc.id AS id_mensu_convencional, mc.tipo_de_mensualidad
    FROM mensualidades AS m
    INNER JOIN mensualidad_convencional AS mc ON m.id_mensualidad_convencional = mc.id
    WHERE m.id = $1
  `;

  const queryMensualidadConvencional = `
    SELECT * FROM mensualidad_convencional
  `;

  // Ejecutar ambas consultas en paralelo
  Promise.all([
    conexion.query(queryMensualidad, [id]),
    conexion.query(queryMensualidadConvencional),
  ])
    .then(([mensualidadesResult, mensualidadConvencionalResult]) => {
      if (mensualidadesResult.rowCount > 0) {
        res.json({
          mensualidades: mensualidadesResult.rows,
          mensualidadConvencional: mensualidadConvencionalResult.rows,
        });
      } else {
        res.status(404).json({ error: "Mensualidad no encontrada" });
      }
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

router.get("/get_mensu_convenio", (req, res) => {
  conexion.query(
    "SELECT id, tipo_de_mensualidad FROM mensualidad_convencional",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(results.rows);
    }
  );
});

//eliminar mensualidades
router.get("/eliminarMensu/:id", (req, res) => {
  const id = parseInt(req.params.id, 10); // Usa 'id' en lugar de 'iden' y asegúrate de que se convierte a entero

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" }); // Manejo del caso donde 'id' no es un número válido
  }

  conexion.query(
    "DELETE FROM mensualidades WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.redirect("/ver_mensualidad");
    }
  );
});

// -------------------------------------------------------------------------------------

//GRUPOS MUSCULARES

// ver grupo muscular
router.get("/ver_grupo_muscular", (req, res) => {
  conexion.query(
    "SELECT * FROM grupos_musculares ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("administrador/grupo_muscular/ver_grupo_muscular", {
        results: results.rows,
      });
    }
  );
});

// editar grupo muscular
router.get("/actualizar_g/:id", (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM grupos_musculares WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        // Enviar los datos del rol como JSON
        res.json(results.rows[0]);
      } else {
        res.status(404).json({ error: "Grupo muscular no encontrado" });
      }
    }
  );
});

/////////////////////////////////////////////////////7

//VENTAS

router.get("/ver_ventas", async (req, res) => {
  try {
    // Consultar la base de datos para obtener los datos necesarios
    conexion.query(
      `SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
       m.id AS id_mensualidad, m.tiempo_plan, m.total_pagar, m.id_mensualidad_convencional, 
       mensu.id AS id_mensualidad_convencional, mensu.tipo_de_mensualidad 
       FROM mensualidad_clientes AS mc
       INNER JOIN mensualidades AS m ON mc.id_mensualidad = m.id
       INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id`,
      async (error, results) => {
        if (error) {
          return res.status(500).json({ error: error.message }); // Manejo de error
        }

        // Obtener la fecha actual sin la parte de tiempo
        const fechaActual = new Date();
        fechaActual.setHours(0, 0, 0, 0);

        // Iterar sobre los resultados y actualizar el estado si es necesario
        const resultadosActualizados = results.rows.map((talla) => {
          const fechaFin = new Date(talla.fecha_fin);
          fechaFin.setHours(0, 0, 0, 0);

          if (fechaFin <= fechaActual && talla.estado !== "Vencida") {
            talla.estado = "Vencida";
            // Opcional: Puedes actualizar el estado en la base de datos aquí
            // await actualizarEstadoEnLaBaseDeDatos(talla.id_cliente, 'Vencida');
          }
          return talla;
        });

        // Renderizar la vista con los datos actualizados
        res.render("administrador/ventas/ver_ventas", {
          results: resultadosActualizados,
        });
      }
    );
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).send("Error del servidor");
  }
});

/////////////////////////////////////////////////////////////////

//ACTIVIDAD FISICA

//VER
router.get("/ver_acti_fisica", autenticateToken, (req, res) => {
  const query = `
    SELECT 
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
      af.id
  `;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("administrador/actividad_fisica/ver_acti_fisica", {
      results: results.rows,
    });
  });
});

// // esta mondaquera no deberia servir pero por si acaso lo dejo ahi quietico
// router.get("/create_acti_fisica", (req, res) => {
//   // Realizamos la consulta para obtener los grupos musculares
//   conexion.query(
//     "SELECT id, nombre FROM grupos_musculares",
//     (error, results) => {
//       if (error) {
//         return res.status(500).json({ error: error.message });
//       }

//       // Verifica el contenido de results.rows
//       console.log(results.rows);

//       // Pasamos los resultados a la vista
//       res.render("administrador/actividad_fisica/create_acti_fisica", {
//         grupos_musculares: results.rows, // results.rows contiene los datos de la consulta
//       });
//     }
//   );
// });

router.get("/get_grupos_musculares", (req, res) => {
  conexion.query(
    "SELECT id, nombre FROM grupos_musculares",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(results.rows);
    }
  );
});

//ACTUALIZAR
router.get("/actualizar_f/:id", (req, res) => {
  const id = req.params.id;

  const queryActividadFisica = `
    SELECT af.*,af.nombre_ejercicio AS nombre, gm.nombre AS grupo_muscular_nombre 
    FROM actividad_fisica AS af 
    INNER JOIN grupos_musculares AS gm ON af.id_grupo_muscular = gm.id 
    WHERE af.id = $1
  `;

  const queryGruposMusculares = `
    SELECT * FROM grupos_musculares
  `;

  // Ejecutamos ambas consultas en paralelo
  Promise.all([
    conexion.query(queryActividadFisica, [id]),
    conexion.query(queryGruposMusculares),
  ])
    .then(([actividadFisicaResult, gruposMuscularesResult]) => {
      if (actividadFisicaResult.rowCount > 0) {
        res.json({
          actividad_fisica: actividadFisicaResult.rows[0],
          grupos_musculares: gruposMuscularesResult.rows,
        });
      } else {
        res.status(404).json({ error: "Actividad física no encontrada" });
      }
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

/////////////////////////////////////////////////////////////////////////////////////////

//PLAN DE ENTRENAMIENTO

// Ruta para "Ver Plan Entrenamiento"
router.get("/ver_plan_ent", autenticateToken, (req, res) => {
  const query = `
      SELECT pe.id AS id_plan_entrenamiento, pe.dia, pe.id_cliente, pe.id_actividad_fisica, pe.series, pe.repeticiones,
      c.id AS id_del_cliente, c.nombre,
      ac.id AS id_actividad, ac.nombre_ejercicio, ac.id_grupo_muscular,
      gm.id AS id_grupo, gm.nombre AS nombre_musculo, gm.seccion
      FROM plan_entrenamiento AS pe
      INNER JOIN clientes AS c ON pe.id_cliente = c.id
      LEFT JOIN actividad_fisica AS ac ON pe.id_actividad_fisica = ac.id
      LEFT JOIN grupos_musculares AS gm ON ac.id_grupo_muscular = gm.id
      ORDER BY pe.id;
  `;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log(results.rows.length); // Debería mostrar cuántas filas se han devuelto
    console.log(results.rows); // Para ver el contenido de las filas

    res.render("administrador/plan_de_entrenamiento/ver_plan_ent", {
      results: results.rows,
    });
  });
});

// nose si sirve esa cochinada
router.get("/actualizar_pe/:id", autenticateToken, (req, res) => {
  const id = req.params.id;

  console.log(`ID recibido en la ruta: ${id}`);

  conexion.query(
    `SELECT pe.id AS id_plan_entrenamiento, pe.dia, pe.id_cliente, pe.id_actividad_fisica, pe.series, pe.repeticiones,
            c.nombre AS nombre_cliente,
            af.nombre_ejercicio
     FROM plan_entrenamiento AS pe
     INNER JOIN clientes AS c ON pe.id_cliente = c.id
     LEFT JOIN actividad_fisica AS af ON pe.id_actividad_fisica = af.id
     WHERE pe.id = $1`,
    [id],
    (error, results) => {
      if (error) {
        console.error("Error en la consulta:", error);
        return res
          .status(500)
          .json({ error: "Error en la base de datos", details: error.message });
      }

      if (results.rowCount === 0) {
        console.log(`No se encontró plan de entrenamiento con ID: ${id}`);
        return res
          .status(404)
          .json({ error: "Plan de entrenamiento no encontrado", id: id });
      }

      // Obtener la lista de actividades físicas
      conexion.query("SELECT * FROM actividad_fisica", (errorAf, afResults) => {
        if (errorAf) {
          console.error("Error al obtener actividades físicas:", errorAf);
          return res.status(500).json({
            error: "Error al obtener actividades físicas",
            details: errorAf.message,
          });
        }

        res.render("administrador/plan_de_entrenamiento/actualizar_pe", {
          plan: results.rows[0],
          actividades: afResults.rows,
        });
      });
    }
  );
});

// Ruta para obtener actividades físicas por grupo muscular
router.get("/getActividades/:groupId", (req, res) => {
  const groupId = req.params.groupId;

  conexion.query(
    `SELECT id AS id_actividad, nombre_ejercicio AS nombre
     FROM actividad_fisica
     WHERE id_grupo_muscular = $1`,
    [groupId],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ actividades: results.rows });
    }
  );
});

//Ruta para Crear Plan de Entrenamiento
router.get("/create_plan_ent", (req, res) => {
  const id_cliente = req.query.id_cliente;

  if (id_cliente) {
    // Caso 1: Acceso desde la página de actualizar tallas
    crud.mostrarFormularioConCliente(req, res, id_cliente);
  } else {
    // Caso 2: Acceso directo a la ruta
    crud.mostrarFormularioVacio(req, res);
  }
});

//roles
router.post("/crearRoles", crud.crearRoles);
router.post("/updateRoles", crud.updateRoles);
//Clientes
router.post("/verClientess", crud.verClientes);
router.post("/crearclienteS", crud.crearclienteS);
router.post("/update_cliente", crud.update_cliente);
router.post("/desactivarcliente", crud.desactivarcliente);
router.post("/activarcliente", crud.activarcliente);

//crear usuarios
router.post("/verUsuarioss", crud.verUsuarios);
router.post("/crearusu", crud.crearusu);
router.post("/update_usuarios", crud.update_usuarios);
router.post("/desactivarusuario", crud.desactivarusuario);
router.post("/activarusuario", crud.activarusuario);

//crear convenio
router.post("/crearConvenio", crud.crearConvenio);
router.post("/update_convenio", crud.update_convenio);
router.post("/desactivarconvenio", crud.desactivarconvenio);
router.post("/activarconvenio", crud.activarconvenio);

//INCIO DE SESION
router.post("/register", crud.register);
router.post("/login", crud.login);

//mensualidades fijas
router.post("/verMensualidades", crud.verMensualidades);
router.post("/crear_mensualidad", crud.crearMensu);
router.post("/update_mensualidad", crud.update_mensualidad);

//mensualidades_compradas

//Ver ventas
router.post("/verVentass", crud.verVentas);

//tallas
router.post("/verTallass", crud.verTallas);
router.post("/update_tallas", crud.update_tallas);

//GRUPO MUSCULAR
router.post("/crear_gm", crud.crear_gm);
router.post("/update_gm", crud.update_gm);

//ACTIVIDAD FISICA
router.post("/crear_af", crud.crear_af);
router.post("/update_af", crud.update_af);

//PLAN DE ENTRENAMIENTO
router.post("/update_pe", crud.update_pe);
router.post("/crearPlanEntrenamiento", crud.crearPlanEntrenamiento);

//INGRESO AL GIMNASIO:

router.post("/registrarIngreso", crud.registrarIngreso);
module.exports = router;
