const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "negrosdemierda";
const path = require("path");
const crud = require("./controllers/crud");
const cron = require("node-cron");
const { log } = require("console");
const axios = require("axios");
// que tas hachendo???, se me jodio el index de clientes jajaja
// Middleware global para asegurar que userData esté disponible en todas las vistas
router.use((req, res, next) => {
  if (req.session.userData) {
    res.locals.userData = req.session.userData;
    console.log(
      "Middleware global: userData en res.locals",
      res.locals.userData
    );
  } else {
    res.locals.userData = null;
  }
  next();
});

// Ruta que obtiene los datos del usuario y los guarda en la sesión
router.get("/navbar", authenticateToken, verifyAdmin, (req, res) => {
  const loggedUserId = req.user.id;
  console.log("xd: ", loggedUserId);

  conexion.query(
    `SELECT u.id as id_usuario, u.nombre AS nombre_usuario, r.tipo_de_rol AS rol 
     FROM usuarios AS u   
     INNER JOIN roles AS r ON u.id_rol = r.id 
     WHERE u.id = $1`,
    [loggedUserId],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rows && results.rows.length > 0) {
        const userData = results.rows[0];

        // Guarda los datos del usuario en la sesión
        req.session.userData = userData;

        console.log(
          "Datos del usuario almacenados en la sesión:",
          req.session.userData
        );

        // No es necesario pasar results a la vista, res.locals.userData ya lo contiene
        res.render("administrador/plantillas/navbar");
      } else {
        req.session.userData = undefined;
        res.render("administrador/plantillas/navbar");
      }
    }
  );
});

// Middleware para verificar el token JWT
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return renderLoginPage(res, {
      status: 401,
      alertTitle: "Acceso Denegado",
      alertMessage: "Debes iniciar sesión para acceder a esta página",
      alertIcon: "error",
    });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;

    // Verificar si el token está a punto de expirar y renovarlo si es necesario
    if (isTokenAboutToExpire(decoded)) {
      const newToken = generateToken(decoded);
      setTokenCookie(res, newToken);
    }

    next();
  } catch (error) {
    res.clearCookie("token");
    return renderLoginPage(res, {
      status: 403,
      alertTitle: "Error",
      alertMessage: "Token inválido o expirado",
      alertIcon: "error",
    });
  }
}

function renderLoginPage(res, options) {
  return res.status(options.status).render("login_index", {
    alert: true,
    alertTitle: options.alertTitle,
    alertMessage: options.alertMessage,
    alertIcon: options.alertIcon,
    showConfirmButton: true,
    timer: 3500,
    ruta: "login_index",
  });
}

function isTokenAboutToExpire(decoded) {
  // Renovar si el token expira en menos de 5 minutos
  const fiveMinutes = 5 * 60;
  return decoded.exp - Date.now() / 1000 < fiveMinutes;
}

function generateToken(userData) {
  const userPayload = {
    id: userData.id, // Asegúrate de incluir el ID del usuario
    role: userData.id_rol,
    // Otros campos si es necesario
  };
  return jwt.sign(userPayload, SECRET_KEY, { expiresIn: "1h" });
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3600000, // 1 hora en milisegundos
  });
}

// Middleware para verificar el rol de administrador
function verifyAdmin(req, res, next) {
  if (req.user.role !== 1) {
    return renderLoginPage(res, {
      status: 403,
      alertTitle: "Acceso Denegado",
      alertMessage: "No tienes permisos de administrador",
      alertIcon: "error",
    });
  }
  next();
}

// Middleware para verificar el rol de cliente
function verifyClient(req, res, next) {
  if (req.user.role !== 3) {
    return renderLoginPage(res, {
      status: 403,
      alertTitle: "Acceso Denegado",
      alertMessage: "Acceso no autorizado",
      alertIcon: "error",
    });
  }
  next();
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
router.get("/index_admin", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    // Obtener la fecha actual en formato 'YYYY-MM-DD'
    const fechaHoy = new Date().toISOString();

    // Configuración de opciones para la zona horaria de Bogotá
    const opciones = {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    };

    // Convertir la fecha actual a la zona horaria de Bogotá y formatear solo la fecha
    const fechaHoyBogota = new Date().toLocaleDateString("en-CA", opciones); // Formato 'YYYY-MM-DD' para la consulta SQL

    // Consulta SQL para obtener el total de ventas por mes y otros datos
    const queryVentas = `
      SELECT 
        mc.id AS id_ventas, 
        mc.fecha_inicio, 
        m.id AS id_mensualidad, 
        m.total_pagar,
        TO_CHAR(mc.fecha_inicio, 'Mon YYYY') AS mes_anio -- Formato de mes y año
      FROM 
        mensualidad_clientes AS mc 
      INNER JOIN 
        mensualidades AS m ON mc.id_mensualidad = m.id
      ORDER BY 
        mc.fecha_inicio DESC;
    `;

    const resultVentas = await conexion.query(queryVentas);
    const datosVentas = resultVentas.rows;

    // Calcular la suma total por mes para ventas
    const datosSumaPorMes = datosVentas.reduce((acc, curr) => {
      const mes = curr.mes_anio;
      if (!acc[mes]) {
        acc[mes] = 0;
      }
      acc[mes] += parseFloat(curr.total_pagar);
      return acc;
    }, {});

    // Convertir el objeto de suma a un arreglo para que sea más fácil de usar en el frontend
    const datosSumaArray = Object.keys(datosSumaPorMes).map((mes) => ({
      mes: mes,
      total: datosSumaPorMes[mes],
    }));

    // Consulta SQL para obtener datos de ingresos de clientes ingresados hoy
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

    // Nueva consulta SQL para obtener los últimos 5 registros de la tabla 'clientes'
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

    // Nueva consulta SQL para obtener solo los datos de ventas con estado 'Vencida'
    const queryVentasVencidas = `
      SELECT * FROM mensualidad_clientes WHERE estado = 'Vencida' ORDER BY fecha_fin DESC LIMIT 5;`;

    const resultVentasVencidas = await conexion.query(queryVentasVencidas);
    const datosVentasVencidas = resultVentasVencidas.rows;

    // Renderizar la vista con los datos de todas las consultas
    res.render("administrador/index", {
      datosVentas: datosVentas,
      datosSumaPorMes: datosSumaArray,
      datosIngresosHoy: datosIngresosHoy,
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
    });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).send("Error en el servidor");
  }
});

// Cliente

//ver ROLES

router.get("/ver_roles", authenticateToken, verifyAdmin, (req, res) => {
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

router.get("/ver_clientes", (req, res) => {
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

router.get("/tallas/:id", (req, res) => {
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
router.get("/ver_usuarios", authenticateToken, verifyAdmin, (req, res) => {
  conexion.query(
    `SELECT u.id AS id_usuario, u.nombre, u.apellido, u.telefono, u.correo_electronico, u.contraseña, u.id_rol, u.estado,
            r.id AS id_roles, r.tipo_de_rol AS rol
     FROM usuarios AS u
     INNER JOIN roles AS r ON u.id_rol = r.id
     WHERE u.id_rol IN ($1, $2)`,
    [1, 2],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }
      res.render("administrador/usuarios/ver_usuarios", {
        results: results.rows,
        loggedUserId: req.user.id,
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
        roles: results.rows,
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

        // Filtrar los IDs de clientes que necesitan actualizarse
        const clientesActualizar = results.rows
          .filter((talla) => {
            const fechaFin = new Date(talla.fecha_fin);
            fechaFin.setHours(0, 0, 0, 0);
            return fechaFin <= fechaActual && talla.estado !== "Vencida";
          })
          .map((talla) => talla.id_cliente);

        // Actualizar el estado a 'Vencida' en 'mensualidad_clientes'
        if (clientesActualizar.length > 0) {
          // Actualizar estado en mensualidad_clientes
          conexion.query(
            `UPDATE mensualidad_clientes
             SET estado = 'Vencida'
             WHERE id_cliente = ANY($1)`,
            [clientesActualizar],
            (error) => {
              if (error) {
                return res.status(500).json({ error: error.message }); // Manejo de error
              }

              // Actualizar el estado a 'Inactivo' en 'clientes'
              conexion.query(
                `UPDATE clientes
                 SET estado = 'Inactivo'
                 WHERE id = ANY($1)`,
                [clientesActualizar],
                (error) => {
                  if (error) {
                    return res.status(500).json({ error: error.message }); // Manejo de error
                  }

                  // Consultar nuevamente los datos actualizados para la vista
                  conexion.query(
                    `SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
                     m.id AS id_mensualidad, m.tiempo_plan, m.total_pagar, m.id_mensualidad_convencional, 
                     mensu.id AS id_mensualidad_convencional, mensu.tipo_de_mensualidad 
                     FROM mensualidad_clientes AS mc
                     INNER JOIN mensualidades AS m ON mc.id_mensualidad = m.id
                     INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id`,
                    (error, updatedResults) => {
                      if (error) {
                        return res.status(500).json({ error: error.message }); // Manejo de error
                      }

                      // Renderizar la vista con los datos actualizados
                      res.render("administrador/ventas/ver_ventas", {
                        results: updatedResults.rows,
                      });
                    }
                  );
                }
              );
            }
          );
        } else {
          // Renderizar la vista si no hay actualizaciones necesarias
          res.render("administrador/ventas/ver_ventas", {
            results: results.rows,
          });
        }
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
router.get("/ver_acti_fisica", (req, res) => {
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
router.get("/ver_plan_ent", (req, res) => {
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

    res.render("administrador/plan_de_entrenamiento/ver_plan_ent", {
      results: results.rows,
    });
  });
});

router.get("/get_actividad_fisica", (req, res) => {
  conexion.query(
    `SELECT id, nombre_ejercicio FROM actividad_fisica`,
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ ejercicios: results.rows });
    }
  );
});

// nose si sirve esa cochinada
router.get("/actualizar_pe/:id", (req, res) => {
  const id = req.params.id;

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
router.get("/get_actividades/:id_grupo_muscular", async (req, res) => {
  const idGrupoMuscular = req.params.id_grupo_muscular;
  try {
    const grupoMuscular = await db.query(
      "SELECT * FROM grupos_musculares WHERE id = $1",
      [idGrupoMuscular]
    );
    const actividades = await db.query(
      "SELECT * FROM actividades_fisicas WHERE id_grupo_muscular = $1",
      [idGrupoMuscular]
    );

    res.json({
      grupoMuscular: grupoMuscular.rows[0],
      actividades: actividades.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener actividades físicas");
  }
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

// CODIGO PARA ACTUALIZAR ESTADO DE MENSUALIDAD_CLIENTES-----
cron.schedule("0 0 * * *", () => {
  console.log("Ejecutando actualización de estados de mensualidades...");
  crud.actualizarEstadosMensualidades();
});

// PAYU
router.get("/mensualidades", (req, res) => {
  const { tempRegistroId } = req.query;

  if (!tempRegistroId) {
    return res.status(400).json({
      success: false,
      message: "Registro temporal no encontrado",
    });
  }

  const query = `SELECT * FROM mensualidades`; // Obtener las mensualidades desde la base de datos
  conexion.query(query, (error, result) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Error al cargar las mensualidades",
      });
    }

    // Renderizar la vista con las mensualidades y el ID del registro temporal
    res.render("administrador/mensualidades/mensualidades", {
      mensualidades: result.rows, // Pasa las mensualidades a la vista
      tempRegistroId: tempRegistroId, // Pasa el ID del registro temporal a la vista
    });
  });
});

router.get("/pago", async (req, res) => {
  const { mensualidadId, tempRegistroId } = req.query;

  if (!mensualidadId || !tempRegistroId) {
    return res.status(400).json({
      success: false,
      message: "Mensualidad o registro no definidos",
    });
  }

  try {
    // Recuperar la información de la mensualidad seleccionada
    const queryMensualidad = `SELECT * FROM mensualidades WHERE id = $1`;
    const mensualidadResult = await conexion.query(queryMensualidad, [
      mensualidadId,
    ]);

    if (mensualidadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mensualidad no encontrada",
      });
    }

    const mensualidad = mensualidadResult.rows[0];

    // Recuperar la información del usuario desde el registro temporal
    const queryUsuario = `SELECT * FROM temp_registro WHERE id = $1`;
    const usuarioResult = await conexion.query(queryUsuario, [tempRegistroId]);

    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Registro no encontrado",
      });
    }

    const usuario = usuarioResult.rows[0];

    // Generar firma
    const referenceCode = `pedido_${tempRegistroId}`;
    const signature = crypto
      .createHash("md5")
      .update(
        `${process.env.PAYU_API_KEY}~${process.env.PAYU_MERCHANT_ID}~${referenceCode}~${mensualidad.total_pagar}~USD`
      )
      .digest("hex");

    // Configurar los detalles del pago para PayU
    const paymentDetails = {
      language: "es",
      command: "SUBMIT_TRANSACTION",
      merchant: {
        apiKey: process.env.PAYU_API_KEY,
        apiLogin: process.env.PAYU_API_LOGIN,
      },
      transaction: {
        order: {
          accountId: process.env.PAYU_ACCOUNT_ID,
          referenceCode: referenceCode,
          description: `Pago de mensualidad: ${mensualidad.tiempo_plan}`,
          language: "es",
          signature: signature,
          notifyUrl: process.env.PAYU_RETURN_URL,
          additionalValues: {
            TX_VALUE: {
              value: mensualidad.total_pagar,
              currency: "USD",
            },
          },
          buyer: {
            emailAddress: usuario.correo,
            contactPhone: usuario.telefono,
            fullName: `${usuario.nombre} ${usuario.apellido}`,
          },
        },
        payer: {
          emailAddress: usuario.correo,
          contactPhone: usuario.telefono,
          fullName: `${usuario.nombre} ${usuario.apellido}`,
        },
        creditCard: {
          number: "4111111111111111",
          securityCode: "123",
          expirationDate: "2025/12",
          name: "APPROVED",
        },
        type: "AUTHORIZATION_AND_CAPTURE",
        paymentMethod: "VISA",
        paymentCountry: "CO",
      },
      test: true,
    };

    console.log("PayU Request:", JSON.stringify(paymentDetails, null, 2));

    // Enviar la solicitud a PayU y obtener la URL de redirección
    const response = await axios.post(process.env.PAYU_API_URL, paymentDetails);

    console.log("PayU Response:", JSON.stringify(response.data, null, 2));

    if (
      response.data.transactionResponse &&
      response.data.transactionResponse.extraParameters &&
      response.data.transactionResponse.extraParameters.BANK_URL
    ) {
      // Redirige al usuario a la URL de pago de PayU
      res.redirect(response.data.transactionResponse.extraParameters.BANK_URL);
    } else {
      res.status(500).json({
        success: false,
        message: "No se pudo obtener la URL de pago de PayU",
        payuResponse: response.data,
      });
    }
  } catch (error) {
    console.error(
      "Error al procesar el pago:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      success: false,
      message: "Error al procesar el pago",
      error: error.response ? error.response.data : error.message,
    });
  }
});

router.post("/confirmacion-pago", async (req, res) => {
  const { transactionId, state, order } = req.body;

  if (state === "APPROVED") {
    const tempRegistroId = order.referenceCode.split("_")[1]; // Extraer el ID del registro temporal

    // Actualizar el estado del registro temporal a "Activo"
    const queryTemp = `UPDATE temp_registro SET estado = 'Activo' WHERE id = $1 RETURNING *`;
    conexion.query(queryTemp, [tempRegistroId], async (error, result) => {
      if (error || result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Error al actualizar el registro",
        });
      }

      const usuario = result.rows[0];

      // Mover los datos a las tablas definitivas (usuarios y clientes)
      const queryUsuario = `
        INSERT INTO usuarios (id, nombre, apellido, correo_electronico, telefono, contraseña, id_rol, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 3, 'Activo')
      `;
      const queryCliente = `
        INSERT INTO clientes (id_usuario, estado_cliente)
        VALUES ($1, 'Activo')
      `;

      try {
        await conexion.query(queryUsuario, [
          usuario.id_usuario,
          usuario.nombre,
          usuario.apellido,
          usuario.correo,
          usuario.telefono,
          usuario.contraseña,
        ]);

        await conexion.query(queryCliente, [usuario.id_usuario]);

        // Eliminar el registro temporal
        await conexion.query(`DELETE FROM temp_registro WHERE id = $1`, [
          usuario.id,
        ]);

        // Redirigir al usuario al login_index después del pago exitoso
        res.render("confirmacion-exito", {
          alert: true,
          alertTitle: "Pago exitoso",
          alertMessage: "Tu registro ha sido completado con éxito.",
          alertIcon: "success",
          showConfirmButton: false,
          timer: 1500,
          ruta: "/login_index",
        });
      } catch (error) {
        console.error("Error al confirmar el registro:", error);
        res.status(500).json({
          success: false,
          message: "Error al confirmar el registro",
        });
      }
    });
  } else {
    res.render("confirmacion-fallo", {
      alert: true,
      alertTitle: "Pago fallido",
      alertMessage: "El pago no se completó correctamente.",
      alertIcon: "error",
      showConfirmButton: true,
    });
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
router.post("/verGrupoMuscularess", crud.verGm);
router.post("/crear_gm", crud.crear_gm);
router.post("/update_gm", crud.update_gm);

//ACTIVIDAD FISICA
router.post("/verActividadFisica", crud.verActividadFisica);
router.post("/crear_af", crud.crear_af);
router.post("/update_af", crud.update_af);

//PLAN DE ENTRENAMIENTO
router.post("/verPlanEntrenamiento", crud.verPlanEntrenamiento);
router.post("/update_pe", crud.update_pe);
router.post("/guardarPlanentrenamiento", crud.guardarPlanentrenamiento);

//INGRESO AL GIMNASIO:

router.post("/registrarIngreso", crud.registrarIngreso);
module.exports = router;

///////////////////////////////////////////////////////////////////////////////////////////  CLIENTES CODGIO

router.get("/clientes/index_c", (req, res) => {
  // Verifica si 'userData' está configurado correctamente
  if (!res.locals.userData) {
    return res
      .status(401)
      .json({ error: "No autorizado: datos del usuario no encontrados" });
  }

  // Extrae el campo 'id' del objeto 'userData'
  let identificacion = res.locals.userData.id;

  // Verifica si 'identificacion' es un número entero válido
  if (!Number.isInteger(identificacion)) {
    return res.status(400).json({ error: "ID de cliente inválido" });
  }

  // Usar consultas parametrizadas para prevenir inyecciones SQL
  conexion.query(
    "SELECT * FROM tallas WHERE id_cliente = $1",
    [identificacion], // Pasar solo el 'id' como parámetro
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("clientes/index_c", {
        results: results.rows,
      });
    }
  );
});
