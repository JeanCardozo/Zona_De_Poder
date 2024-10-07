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
const PDFDocument = require("pdfkit");
const { log } = require("console");
const { descargarPDF } = require("./controllers/crud");
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const fs = require("fs");
const axios = require("axios");
const mercadopago = require("mercadopago");
const { title } = require("process");

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

    // Verificar si el token e  stá a punto de expirar y renovarlo si es necesario
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
  const now = Date.now() / 1000; // Fecha actual en segundos
  const timeLeft = decoded.exp - now;
  const bufferTime = 5 * 60; // 5 minutos de margen

  return timeLeft < bufferTime;
}

function generateToken(userData) {
  const userPayload = {
    id: userData.id, // Asegúrate de incluir el ID del usuario
    role: userData.id_rol,
    // Otros campos si es necesario
  };
  return jwt.sign(userPayload, SECRET_KEY, { expiresIn: "2h" });
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

// Ruta para obtener la imagen de perfil de un usuario
router.get("/profile-image/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Solicitud de imagen para el usuario ID: ${userId}`);

    const query =
      "SELECT imagen_perfil, imagen_content_type FROM usuarios WHERE id = $1";
    const result = await conexion.query(query, [userId]);

    if (result.rows.length > 0 && result.rows[0].imagen_perfil) {
      const { imagen_perfil, imagen_content_type } = result.rows[0];
      console.log(
        `Imagen encontrada para el usuario ID ${userId}. Tipo de contenido: ${imagen_content_type}`
      );
      res.contentType(imagen_content_type);
      res.send(imagen_perfil);
    } else {
      console.log(
        `No se encontró imagen para el usuario ID ${userId}. Redirigiendo a imagen por defecto.`
      );
      res.redirect(
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png"
      );
    }
  } catch (error) {
    console.error("Error al obtener la imagen de perfil:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

// Ruta para el navbar del administrador
router.get("/navbar", authenticateToken, verifyAdmin, async (req, res) => {
  const loggedUserId = req.user.id;

  try {
    const query = `
      SELECT u.id as id_usuario, u.nombre AS nombre_usuario, r.tipo_de_rol AS rol, 
      CASE WHEN u.imagen_perfil IS NOT NULL THEN true ELSE false END AS tiene_imagen
      FROM usuarios AS u   
      INNER JOIN roles AS r ON u.id_rol = r.id 
      WHERE u.id = $1
    `;

    const result = await conexion.query(query, [loggedUserId]);

    if (result.rows && result.rows.length > 0) {
      const userData = result.rows[0];
      console.log(`Datos del usuario obtenidos:`, userData);

      userData.imagen_perfil = userData.tiene_imagen
        ? `/profile-image/user/${userData.id_usuario}`
        : "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png";

      req.session.userData = userData;
      console.log(
        `Datos del usuario guardados en sesión:`,
        req.session.userData
      );

      res.render("administrador/plantillas/navbar", { userData: userData });
    } else {
      console.log(`No se encontraron datos para el usuario ID ${loggedUserId}`);
      req.session.userData = null;
      res.render("administrador/plantillas/navbar", { userData: null });
    }
  } catch (error) {
    console.error("Error al obtener datos del usuario:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/profile-image/client/:clientId", async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const query =
      "SELECT imagen_perfil, imagen_content_type FROM clientes WHERE id = $1";
    const result = await conexion.query(query, [clientId]);

    if (result.rows.length > 0 && result.rows[0].imagen_perfil) {
      const { imagen_perfil, imagen_content_type } = result.rows[0];
      res.contentType(imagen_content_type);
      res.send(imagen_perfil);
    } else {
      res.status(404).send("Imagen no encontrada");
    }
  } catch (error) {
    console.error("Error al obtener la imagen de perfil del cliente:", error);
    res.status(500).send("Error al obtener la imagen de perfil del cliente");
  }
});

// Ruta para el navbar del cliente
router.get(
  "/navbar_clientes",
  authenticateToken,
  verifyClient,
  async (req, res) => {
    const loggedClientId = req.user.id;

    try {
      const clientQuery = `
      SELECT id, nombre, imagen_perfil 
      FROM clientes 
      WHERE id = $1
    `;
      const clientResult = await conexion.query(clientQuery, [loggedClientId]);

      if (clientResult.rows.length === 0) {
        req.session.userData = null;
        return res.render("cliente/plantillas/navbar_clientes", {
          userData: null,
        });
      }

      const clientData = clientResult.rows[0];

      clientData.imagen_perfil = clientData.imagen_perfil
        ? `/profile-image/client/${clientData.id}`
        : "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png";

      req.session.userData = {
        id: clientData.id,
        nombre_cliente: clientData.nombre,
        imagen_perfil: clientData.imagen_perfil,
      };

      console.log("imagen cargada: ", clientData.imagen_perfil);
      res.render("administrador/plantillas/navbar_clientes", {
        userData: req.session.userData,
      });
    } catch (error) {
      console.error("Error al obtener los datos del cliente:", error);
      res.status(500).sendFile(__dirname + "/500.html");
    }
  }
);

router.get("/", async (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "cancel_success" || message === "success") {
    alertMessage = {
      type: "success",
      text: "Acccion Ejecutada Con Exito",
    };
  }
  const queryEventos = `SELECT nombre, fecha, estado FROM eventos ORDER BY fecha`;
  const resultEventos = await conexion.query(queryEventos);
  const datosEventos = resultEventos.rows;

  // Pasamos los datos reales a la vista
  res.render("index_p", {
    alertMessage: alertMessage, // Cambiamos 'message' por 'alertMessage'
    datosEventos: datosEventos,
  });
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
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al destruir la sesión:", err);
    }
    res.redirect("/?message=success"); // Redirige a la página principal con el mensaje de éxito
  });
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
      SELECT * FROM mensualidad_clientes WHERE estado = 'Vencida' ORDER BY fecha_fin DESC LIMIT 7;`;

    const resultVentasVencidas = await conexion.query(queryVentasVencidas);
    const datosVentasVencidas = resultVentasVencidas.rows;

    const querymensualidades = `
      SELECT * FROM mensualidades`;

    const resultMensualidades = await conexion.query(querymensualidades);
    const datosMensualidades = resultMensualidades.rows;

    // Renderizar la vista con los datos de todas las consultas
    res.render("administrador/index", {
      datosVentas: datosVentas,
      datosSumaPorMes: datosSumaArray,
      datosIngresosHoy: datosIngresosHoy,
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
      datosMensualidades: datosMensualidades,
    });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/events", async (req, res) => {
  try {
    const result = await conexion.query("SELECT * FROM eventos");
    const eventos = result.rows.map((evento) => ({
      title: evento.nombre,
      start: evento.fecha,
    }));

    res.json(eventos);
  } catch (error) {
    console.error("Error al obtener eventos", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

////////////////////////////////////////////////////////////////// ver pqrs///////////////////////////////////////////////////////////////////////////////////////////////////
router.get("/ver_pqrs", authenticateToken, verifyAdmin, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }
  conexion.query("SELECT * FROM pqrs ORDER BY id", (error, results) => {
    if (error) {
      res.status(500).sendFile(__dirname + "/500.html");
    }
    console.log("moda", results.rows);

    res.render("administrador/pqrs/ver_pqrs", {
      alertMessage: alertMessage,
      results: results.rows,
    });
  });
});
//ver ROLES

router.get("/ver_roles", authenticateToken, verifyAdmin, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }

  conexion.query("SELECT * FROM roles ORDER BY id", (error, results) => {
    if (error) {
      res.status(500).sendFile(__dirname + "/500.html");
    }

    res.render("administrador/roles/ver_roles", {
      alertMessage: alertMessage,
      results: results.rows,
    });
  });
});

// Editar Roles

router.get("/actualizar/:id", authenticateToken, (req, res) => {
  const id = req.params.id;
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }

  conexion.query(
    "SELECT * FROM roles WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        res.status(500).sendFile(__dirname + "/500.html");
      }

      if (results.rowCount > 0) {
        // Enviar los datos del rol como JSON
        res.json(results.rows[0]);
      } else {
        res.status(404).json({ error: "Rol no encontrado" });
      }
      res.render("administrador/roles/ver_roles", {
        results: results.rows,
        alertMessage: alertMessage,
      });
    }
  );
});

// Eliminar roles

router.get("/eliminarRol/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: "Invalid ID" });
  }

  conexion.query("DELETE FROM roles WHERE id = $1", [id], (error, results) => {
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Enviar respuesta JSON en lugar de redireccionar
    res.json({ success: true, message: "Rol eliminado correctamente" });
  });
});

//-----------------------------------------------------------
// crear clientes
router.get("/create_clientes", authenticateToken, (req, res) => {
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
      res.status(500).sendFile(__dirname + "/500.html");
    });
});

//ruta para ver clientes

router.get("/ver_clientes", authenticateToken, (req, res) => {
  const query = `
    SELECT c.id,c.nombre,c.apellido,c.edad,c.sexo,c.fecha_de_inscripcion,c.correo_electronico,c.numero_telefono,
    c.id_mensualidad,c.estado,
    m.id AS id_mensual,m.total_pagar,m.tiempo_plan, c.imagen_perfil, c.imagen_content_type
    FROM clientes AS c 
    LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
     ORDER BY c.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    res.render("administrador/clientes/ver_clientes", {
      results: results.rows,
    });
  });
});

router.get("/ver_mas_cliente/:id", authenticateToken, (req, res) => {
  const clientId = req.params.id;

  const clientQuery = `
    SELECT c.id, c.nombre, c.apellido, c.edad, c.sexo, c.fecha_de_inscripcion, 
           c.correo_electronico, c.numero_telefono, c.id_mensualidad, c.estado,
           m.id AS id_mensual, m.total_pagar, m.tiempo_plan, c.imagen_perfil, c.imagen_content_type
    FROM clientes AS c
    LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
    WHERE c.id = $1`;

  conexion.query(clientQuery, [clientId], (clientError, clientResults) => {
    if (clientError) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    // Verificar si se encontraron resultados
    if (clientResults.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({
      datosCliente: clientResults.rows,
    });
  });
});

router.get("/tallas/:id", authenticateToken, (req, res) => {
  const clientId = req.params.id;

  // Consulta para obtener el nombre del cliente
  const clientQuery = `SELECT nombre FROM clientes WHERE id = $1`;

  // Consulta para obtener las tallas del cliente
  const sizesQuery = `
    SELECT medida_pecho, medida_brazo, medida_cintura, medida_abdomen, medida_cadera, medida_pierna, medida_pantorrilla, peso, altura,fecha_modificacion
    FROM tallas_temporales
    WHERE id_cliente = $1`;

  // Ejecutar las dos consultas
  conexion.query(clientQuery, [clientId], (clientError, clientResults) => {
    if (clientError) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    const clientName = clientResults.rows[0]?.nombre;

    conexion.query(sizesQuery, [clientId], (sizesError, sizesResults) => {
      if (sizesError) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      // Enviar tanto el nombre del cliente como las tallas
      res.json({
        clientName: clientName,
        sizes: sizesResults.rows,
      });
    });
  });
});

router.get("/cliente/pdf/:id_cliente", authenticateToken, async (req, res) => {
  const { id_cliente } = req.params;

  try {
    const result = await conexion.query(
      `SELECT c.nombre, c.apellido, c.fecha_de_inscripcion, c.estado, m.total_pagar, v.id AS numero_transaccion
      FROM clientes AS c
      LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
      LEFT JOIN mensualidad_clientes AS v ON c.id = v.id_cliente
      WHERE c.id = $1`,
      [id_cliente]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Cliente no encontrado");
    }

    const cliente = result.rows[0];
    const doc = new PDFDocument({ size: "A5", margin: 40 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factura_${cliente.nombre}_${cliente.apellido}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80; // 40px margen a cada lado

    // Añadir marca de agua

    // Encabezado
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("ZONA DE PODER GYM", { align: "center" });
    doc.fontSize(10).text("Teléfono: 3209316797", { align: "center" });
    doc.text("Dirección: Calle 6ta - 7-20 centro", { align: "center" });

    doc
      .moveTo(40, 100)
      .lineTo(pageWidth - 40, 100)
      .stroke();

    // Información del cliente
    const clienteInfo = [
      { label: "Contacto:", value: `${cliente.nombre} ${cliente.apellido}` },
      {
        label: "Fecha de transacción:",
        value: new Date(cliente.fecha_de_inscripcion).toLocaleDateString(
          "es-CO"
        ),
      },
      { label: "Vendedor:", value: "Laura del Sol Hdez" },
      { label: "Método de pago:", value: "Efectivo" },
      { label: "Estado:", value: cliente.estado },
      { label: "Número de transacción:", value: cliente.numero_transaccion },
    ];

    doc.fontSize(10);
    let y = 120;
    clienteInfo.forEach((item) => {
      doc.text(item.label, 40, y);
      doc.text(item.value, -450, y, { align: "right" });
      y += 15;
    });

    doc
      .moveTo(40, y + 10)
      .lineTo(pageWidth - 40, y + 10)
      .stroke();

    // Detalles de los productos
    y += 30;
    const headers = ["Producto", "Cant.", "Precio U.", "Valor"];
    const headerPositions = [40, pageWidth - 240, pageWidth - 160, -450];

    doc.font("Helvetica-Bold");
    headers.forEach((header, index) => {
      doc.text(header, headerPositions[index], y, {
        width: index === 0 ? 200 : 80,
        align: index === 0 ? "left" : "right",
      });
    });

    y += 20;
    doc.font("Helvetica");
    doc.text("Mensualidad servicio de entrenamiento físico", 40, y, {
      width: 200,
    });
    doc.text("1", headerPositions[1], y, { width: 80, align: "right" });
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      headerPositions[2],
      y,
      {
        width: 80,
        align: "right",
      }
    );
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      headerPositions[3],
      y,
      {
        width: 80,
        align: "right",
      }
    );

    // Total
    y += 30;
    doc
      .moveTo(40, y)
      .lineTo(pageWidth - 40, y)
      .stroke();
    y += 10;
    doc.font("Helvetica-Bold");
    doc.text("TOTAL:", 40, y);
    doc.text(`$ ${cliente.total_pagar.toLocaleString()}`, -450, y, {
      align: "right",
    });

    doc.end();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});
// Función para cargar la imagen desde una URL
function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    request({ url, encoding: null }, (error, response, body) => {
      if (error) reject(error);
      else resolve(body);
    });
  });
}

router.get("/clientes/pdf/:id_cliente", authenticateToken, async (req, res) => {
  const { id_cliente } = req.params;

  try {
    const result = await conexion.query(
      `SELECT c.nombre, c.apellido, c.fecha_de_inscripcion, c.estado, m.total_pagar, v.id AS numero_transaccion
      FROM clientes AS c
      LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
      LEFT JOIN mensualidad_clientes AS v ON c.id = v.id_cliente
      WHERE c.id = $1`,
      [id_cliente]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Cliente no encontrado");
    }

    const cliente = result.rows[0];
    const doc = new PDFDocument({ size: "A5", margin: 40 });

    res.setHeader(
      "Content-Disposition",
      `inline; filename="factura_${cliente.nombre}_${cliente.apellido}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80; // 40px margen a cada lado

    // Añadir marca de agua

    // Encabezado
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("ZONA DE PODER GYM", { align: "center" });
    doc.fontSize(10).text("Teléfono: 3209316797", { align: "center" });
    doc.text("Dirección: Calle 6ta - 7-20 centro", { align: "center" });

    doc
      .moveTo(40, 100)
      .lineTo(pageWidth - 40, 100)
      .stroke();

    // Información del cliente
    const clienteInfo = [
      { label: "Contacto:", value: `${cliente.nombre} ${cliente.apellido}` },
      {
        label: "Fecha de transacción:",
        value: new Date(cliente.fecha_de_inscripcion).toLocaleDateString(
          "es-CO"
        ),
      },
      { label: "Vendedor:", value: "Laura del Sol Hdez" },
      { label: "Método de pago:", value: "Efectivo" },
      { label: "Estado:", value: cliente.estado },
      { label: "Número de transacción:", value: cliente.numero_transaccion },
    ];

    doc.fontSize(10);
    let y = 120;
    clienteInfo.forEach((item) => {
      doc.text(item.label, 40, y);
      doc.text(item.value, -450, y, { align: "right" });
      y += 15;
    });

    doc
      .moveTo(40, y + 10)
      .lineTo(pageWidth - 40, y + 10)
      .stroke();

    // Detalles de los productos
    y += 30;
    const headers = ["Producto", "Cant.", "Precio U.", "Valor"];
    const headerPositions = [40, pageWidth - 240, pageWidth - 160, -450];

    doc.font("Helvetica-Bold");
    headers.forEach((header, index) => {
      doc.text(header, headerPositions[index], y, {
        width: index === 0 ? 200 : 80,
        align: index === 0 ? "left" : "right",
      });
    });

    y += 20;
    doc.font("Helvetica");
    doc.text("Mensualidad servicio de entrenamiento físico", 40, y, {
      width: 200,
    });
    doc.text("1", headerPositions[1], y, { width: 80, align: "right" });
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      headerPositions[2],
      y,
      {
        width: 80,
        align: "right",
      }
    );
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      headerPositions[3],
      y,
      {
        width: 80,
        align: "right",
      }
    );

    // Total
    y += 30;
    doc
      .moveTo(40, y)
      .lineTo(pageWidth - 40, y)
      .stroke();
    y += 10;
    doc.font("Helvetica-Bold");
    doc.text("TOTAL:", 40, y);
    doc.text(`$ ${cliente.total_pagar.toLocaleString()}`, -450, y, {
      align: "right",
    });

    doc.end();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});
// Función para cargar la imagen desde una URL
function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    request({ url, encoding: null }, (error, response, body) => {
      if (error) reject(error);
      else resolve(body);
    });
  });
}

/////////////////////////////////////////////////////////////////

// para editar clientes
router.get("/actualizar_clientes/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const queryCliente = `
      SELECT id AS id_cliente, nombre, apellido, edad, sexo, fecha_de_inscripcion, 
             correo_electronico, numero_telefono, id_mensualidad, estado, imagen_perfil, imagen_content_type 
      FROM clientes 
      WHERE id = $1
    `;

    const queryMensualidades = `
      SELECT id AS id_mensu, tiempo_plan, total_pagar 
      FROM mensualidades
    `;

    const clienteResult = await conexion.query(queryCliente, [id]);
    if (clienteResult.rowCount === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const cliente = clienteResult.rows[0];

    const mensualidadesResult = await conexion.query(queryMensualidades);
    const mensualidades = mensualidadesResult.rows.map((row) => ({
      id_mensu: row.id_mensu,
      tiempo_plan: row.tiempo_plan,
      total_pagar: row.total_pagar,
    }));

    if (cliente.imagen_perfil) {
      cliente.imagen_perfil = `data:${
        cliente.imagen_content_type
      };base64,${cliente.imagen_perfil.toString("base64")}`;
    }

    res.render("administrador/clientes/actualizar_clientes", {
      cliente,
      mensualidades,
    });
  } catch (error) {
    console.error("Error al recuperar los datos del cliente:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

//usuarios

// /ver_usuarios
// Router para ver usuarios
router.get("/ver_usuarios", authenticateToken, verifyAdmin, (req, res) => {
  conexion.query(
    `SELECT u.id AS id_usuarios, u.nombre, u.apellido, u.telefono, u.correo_electronico AS correo, u.id_rol, u.estado,
            r.id AS id_roles, r.tipo_de_rol AS rol
     FROM usuarios AS u
     INNER JOIN roles AS r ON u.id_rol = r.id
     WHERE u.id_rol IN ($1, $2)`,

    [1, 2],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.render("administrador/usuarios/ver_usuarios", {
        results: results.rows,
        loggedUserId: req.user.id,
      });
    }
  );
});

// CREAR USUARIOS

router.get("/create_usuarios", authenticateToken, (req, res) => {
  conexion.query(
    "SELECT id, tipo_de_rol FROM roles ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.render("administrador/usuarios/create_usuarios", {
        roles: results.rows,
      });
    }
  );
});

router.get("/actualizar_usuarios/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // Primera consulta: Obtener usuario por ID
  conexion.query(
    "SELECT * FROM usuarios WHERE id = $1",
    [id],
    (error, userResults) => {
      if (error) {
        returnres.status(500).sendFile(__dirname + "/500.html");
      }

      if (userResults.rowCount > 0) {
        // Segunda consulta: Obtener todos los roles
        conexion.query("SELECT * FROM roles", (roleError, roleResults) => {
          if (roleError) {
            return res.status(500).sendFile(__dirname + "/500.html");
          }

          // Asegurarse de que las variables 'user' y 'roles' no estén vacías
          if (roleResults.rowCount > 0) {
            // Renderizar la vista con los datos del usuario y los roles
            res.render("administrador/usuarios/actualizar_usuarios", {
              user: userResults.rows[0],
              roles: roleResults.rows, // Pasar los roles obtenidos
            });
          } else {
            res.status(404).json({ error: "No roles found" });
          }
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
router.get("/ver_talla", authenticateToken, (req, res) => {
  conexion.query(
    "SELECT * FROM tallas ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
      }

      res.render("administrador/tallas/ver_talla", { results: results.rows });
    }
  );
});

//CREAR TALLA
router.get("/create_talla", authenticateToken, (req, res) => {
  conexion.query(
    "SELECT id FROM tallas",

    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.render("administrador/tallas/create_talla", {
        results: results.rows,
      });
    }
  );
});

//ACTUALIZAR TALLAS
router.get("/actualizar_tallas/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);

  // Ejecutar ambas consultas en paralelo
  Promise.all([
    // Consulta para obtener las tallas
    new Promise((resolve, reject) => {
      conexion.query(
        "SELECT * FROM tallas WHERE id_cliente = $1",
        [id],
        (error, results) => {
          if (error) return reject(error);
          resolve(results.rows[0]);
        }
      );
    }),
    // Consulta para obtener el cliente
    new Promise((resolve, reject) => {
      conexion.query(
        "SELECT * FROM clientes WHERE id = $1",
        [id],
        (error, results) => {
          if (error) return reject(error);
          resolve(results.rows[0]);
        }
      );
    }),
  ])
    .then(([tallas, cliente]) => {
      if (tallas && cliente) {
        res.render("administrador/tallas/actualizar_tallas", {
          user: tallas,
          cliente: cliente,
        });
      } else {
        res.status(404).json({ error: "Data not found" });
      }
    })
    .catch((error) => {
      res.status(500).sendFile(__dirname + "/500.html");
    });
});

// router.get("/descargar_pdf/:id", (req, res) => {
//   const id = parseInt(req.params.id, 10);
//   crud.descargarPDF(req, res, id); // Descarga el PDF
// });

// ver comvenios
router.get("/ver_convenio", authenticateToken, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }
  conexion.query(
    "SELECT * FROM mensualidad_convencional ORDER BY id",

    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
      }
      res.render("administrador/convenio/ver_mensualidad", {
        alertMessage: alertMessage,
        results: results.rows,
      });
    }
  );
});

// crear convenio
router.get("/create_convenio", authenticateToken, (req, res) => {
  res.render("administrador/convenio/create_convenio");
});

// actualizar convenio
router.get("/actualizar_convenio/:id", authenticateToken, (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM mensualidad_convencional WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
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

router.get("/ver_mensualidad", authenticateToken, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }
  // Corrige la consulta SQL
  const query =
    "SELECT  m.id AS id_mensualidad,m.total_pagar,mc.tipo_de_mensualidad,m.tiempo_plan FROM mensualidades AS m INNER JOIN mensualidad_convencional AS mc ON m.id_mensualidad_convencional =mc.id ORDER BY m.id";

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    res.render("administrador/mensualidades/ver_mensualidad", {
      alertMessage: alertMessage,
      results: results.rows || results,
    });
  });
});

router.get("/actualizar_mensualidad/:id", authenticateToken, (req, res) => {
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
      res.status(500).sendFile(__dirname + "/500.html");
    });
});

router.get("/get_mensu_convenio", authenticateToken, (req, res) => {
  conexion.query(
    "SELECT id, tipo_de_mensualidad FROM mensualidad_convencional",
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.json(results.rows);
    }
  );
});

//eliminar mensualidades
router.get("/eliminarMensu/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10); // Usa 'id' en lugar de 'iden' y asegúrate de que se convierte a entero

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" }); // Manejo del caso donde 'id' no es un número válido
  }

  conexion.query(
    "DELETE FROM mensualidades WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.redirect("/ver_mensualidad");
    }
  );
});

// -------------------------------------------------------------------------------------

//GRUPOS MUSCULARES

// ver grupo muscular
router.get("/ver_grupo_muscular", authenticateToken, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }
  conexion.query(
    "SELECT * FROM grupos_musculares ORDER BY id",

    (error, results) => {
      if (error) {
        res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
      }

      res.render("administrador/grupo_muscular/ver_grupo_muscular", {
        alertMessage: alertMessage,
        results: results.rows,
      });
    }
  );
});

// editar grupo muscular
router.get("/actualizar_g/:id", authenticateToken, (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM grupos_musculares WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
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

router.get("/ver_ventas", authenticateToken, async (req, res) => {
  try {
    // Consultar la base de datos para obtener los datos necesarios
    conexion.query(
      `SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
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
ORDER BY mc.id;

`,
      async (error, results) => {
        if (error) {
          return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
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
                return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
              }

              // Actualizar el estado a 'Inactivo' en 'clientes'
              conexion.query(
                `UPDATE clientes
                 SET estado = 'Inactivo'
                 WHERE id = ANY($1)`,
                [clientesActualizar],
                (error) => {
                  if (error) {
                    return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
                  }

                  // Consultar nuevamente los datos actualizados para la vista
                  conexion.query(
                    `SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
                     m.id AS id_mensualidad, m.tiempo_plan, m.total_pagar, m.id_mensualidad_convencional, 
                     mensu.id AS id_mensualidad_convencional, mensu.tipo_de_mensualidad 
                     FROM mensualidad_clientes AS mc
                     INNER JOIN mensualidades AS m ON mc.id_mensualidad = m.id
                     INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id
                     WHERE mc.estado IS NOT NULL

                     ORDER BY mc.id_mensu_cliente`,
                    (error, updatedResults) => {
                      if (error) {
                        return res
                          .status(500)
                          .sendFile(__dirname + "/500.html"); // Manejo de error
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
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

/////////////////////////////////////////////////////////////////

//ACTIVIDAD FISICA

//VER
router.get("/ver_acti_fisica", authenticateToken, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
    };
  }
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
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    res.render("administrador/actividad_fisica/ver_acti_fisica", {
      alertMessage: alertMessage,
      results: results.rows,
    });
  });
});

router.get("/get_grupos_musculares", authenticateToken, (req, res) => {
  conexion.query(
    "SELECT id, nombre FROM grupos_musculares",
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.json(results.rows);
    }
  );
});

//ACTUALIZAR
router.get("/actualizar_f/:id", authenticateToken, (req, res) => {
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
      res.status(500).sendFile(__dirname + "/500.html");
    });
});

/////////////////////////////////////////////////////////////////////////////////////////

//PLAN DE ENTRENAMIENTO

// Ruta para "Ver Plan Entrenamiento"
router.get("/ver_plan_ent", authenticateToken, (req, res) => {
  // Primera consulta: obtener el plan de entrenamiento
  conexion.query(
    "SELECT pe.id AS id_plan_entrenamiento, pe.id_cliente FROM plan_entrenamiento pe ORDER BY pe.id ASC",
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      // Si no hay resultados en el plan de entrenamiento
      if (results.rows.length === 0) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      const clienteId = results.rows[0].id_cliente; // Se usa id_cliente, no id

      // Segunda consulta: obtener el nombre del cliente
      conexion.query(
        "SELECT nombre FROM clientes WHERE id = $1",
        [clienteId],
        (error, clienteNameResults) => {
          if (error) {
            return res.status(500).sendFile(__dirname + "/500.html");
          }

          const clienteNombre =
            clienteNameResults.rows[0]?.nombre || "Cliente no encontrado";

          // Renderizar la vista con los resultados del plan de entrenamiento y el nombre del cliente
          res.render("administrador/plan_de_entrenamiento/ver_plan_ent", {
            planEntrenamiento: results.rows,
            nombreCliente: clienteNombre,
          });
        }
      );
    }
  );
});

router.get("/info_plan/:id", authenticateToken, (req, res) => {
  const clienteId = req.params.id;

  const planQuery = `
    SELECT pe.dia, pe.tipo_tren, pe.musculo, pe.ejercicio, pe.series, pe.repeticiones, c.nombre
    FROM plan_entrenamiento AS pe
    JOIN clientes AS c ON pe.id_cliente = c.id
    WHERE pe.id_cliente = $1`;

  conexion.query(planQuery, [clienteId], (planError, planResults) => {
    if (planError) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    if (planResults.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Plan de entrenamiento no encontrado" });
    }

    // Agrupar los resultados por cliente
    const planesDeEntrenamiento = planResults.rows;
    const nombreCliente = planesDeEntrenamiento[0].nombre;

    console.log("planes", planesDeEntrenamiento);

    // Responder con los datos del plan agrupados
    res.json({
      nombreCliente,
      planesDeEntrenamiento,
    });
  });
});

router.get("/get_actividad_fisica", authenticateToken, (req, res) => {
  conexion.query(
    `SELECT id, nombre_ejercicio FROM actividad_fisica`,
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.json({ ejercicios: results.rows });
    }
  );
});

// nose si sirve esa cochinada
router.get("/actualizar_pe/:id", authenticateToken, (req, res) => {
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
        return res.status(500).sendFile(__dirname + "/500.html");
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
          return res.status(500).sendFile(__dirname + "/500.html");
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
router.get(
  "/get_actividades/:id_grupo_muscular",
  authenticateToken,
  async (req, res) => {
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
      res.status(500).sendFile(__dirname + "/500.html");
    }
  }
);

//Ruta para Crear Plan de Entrenamiento

// CODIGO PARA ACTUALIZAR ESTADO DE MENSUALIDAD_CLIENTES-----
cron.schedule("0 0 * * *", () => {
  console.log("Ejecutando actualización de estados de mensualidades...");
  crud.actualizarEstadosMensualidades();
});

// // MERCADO PAGO

// Función para obtener mensualidades
async function getMensualidades() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM mensualidades";
    conexion.query(query, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.rows);
      }
    });
  });
}

// Ruta para mostrar la página de mensualidades
router.get("/mensualidades", async (req, res) => {
  const { tempRegistroId } = req.query;

  if (!tempRegistroId) {
    return res.status(400).json({
      success: false,
      message: "Registro temporal no encontrado",
    });
  }

  try {
    const mensualidades = await getMensualidades();
    res.render("administrador/mensualidades/mensualidades", {
      mensualidades,
      tempRegistroId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al cargar las mensualidades",
    });
  }
});

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN_V, // Asegúrate de que esta variable de entorno esté configurada
  options: {
    timeout: 5000, // Configuración de timeout
  },
});

// Ruta para crear una orden de Mercado Pago
router.post("/create-preference", async (req, res) => {
  try {
    const body = {
      items: [
        {
          title: req.body.title,
          unit_price: Number(req.body.unit_price),
          currency_id: "COP",
          quantity: 1, // Asegúrate de incluir la cantidad
        },
      ],
      back_urls: {
        success: "http://localhost:5000/pago-exitoso",
        failure: "http://localhost:5000/pago-fallido",
        pending: "http://localhost:5000/pago-pendiente",
      },
    };

    const preference = new Preference(client);
    const result = await preference.create({ body });

    res.json({
      id: result.id,
    });
  } catch (error) {
    const mensualidades = await getMensualidades();
    res.render("administrador/mensualidades/mensualidades", {
      alertTitle: "Error",
      alertMessage: "Hubo un problema al crear la orden de pago.",
      alertIcon: "error",
      showConfirmButton: true,
      tempRegistroId: req.body.tempRegistroId,
      mensualidades,
    });
  }
});

// Rutas de redirección después del pago
router.get("/success", async (req, res) => {
  try {
    const mensualidades = await getMensualidades();
    res.render("administrador/mensualidades/mensualidades", {
      alertTitle: "Pago Exitoso",
      alertMessage: "Tu pago ha sido realizado con éxito.",
      alertIcon: "success",
      showConfirmButton: true,
      tempRegistroId: req.query.tempRegistroId,
      mensualidades,
    });
  } catch (error) {
    console.error("Error en la ruta de éxito:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/failure", async (req, res) => {
  try {
    const mensualidades = await getMensualidades();
    res.render("administrador/mensualidades/mensualidades", {
      alertTitle: "Pago Fallido",
      alertMessage: "Hubo un problema al procesar tu pago.",
      alertIcon: "error",
      showConfirmButton: true,
      tempRegistroId: req.query.tempRegistroId,
      mensualidades,
    });
  } catch (error) {
    console.error("Error en la ruta de fallo:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/pending", async (req, res) => {
  try {
    const mensualidades = await getMensualidades();
    res.render("administrador/mensualidades/mensualidades", {
      alertTitle: "Pago Pendiente",
      alertMessage: "Tu pago está en proceso. Espera la confirmación.",
      alertIcon: "info",
      showConfirmButton: true,
      tempRegistroId: req.query.tempRegistroId,
      mensualidades,
    });
  } catch (error) {
    console.error("Error en la ruta de pendiente:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

// Ruta para recibir webhooks de Mercado Pago
router.post("/webhook", async (req, res) => {
  try {
    await receiveWebhook(req, res);
    res.sendStatus(204); // No hay contenido que devolver
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).sendFile(__dirname + "/500.html"); // Enviar un estado de error si falla el webhook
    }
  }
});

// Ruta para cancelar el registro temporal
router.get("/cancelar", (req, res) => {
  const { tempRegistroId } = req.query;

  const query = `DELETE FROM temp_registro WHERE id_usuario = $1`;
  conexion.query(query, [tempRegistroId], (error) => {
    if (error) {
      console.error("Error al eliminar el registro temporal:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error al cancelar el registro" });
    }

    res.redirect("/?message=cancel_success");
  });
});

//////////////////////////////////////////pdf

///////////////////////////////////////////////

router.get("/create_plan_ent", authenticateToken, (req, res) => {
  crud.mostrarFormularioVacio(req, res);
});

router.post("/entrenamiento/guardar", authenticateToken, async (req, res) => {
  const {
    id_cliente,
    dia,
    tipo_tren,
    musculo,
    ejercicio,
    series,
    repeticiones,
  } = req.body;

  console.log("Datos recibidos:", req.body);

  // Verifica si las variables son undefined o vacías
  if (
    !id_cliente ||
    !dia ||
    !tipo_tren ||
    !musculo ||
    !ejercicio ||
    !series ||
    !repeticiones
  ) {
    return res.status(400).send("Todos los campos son obligatorios");
  }

  // Convierte a entero el id_cliente
  const id_cliente_int = parseInt(id_cliente, 10);

  if (
    isNaN(id_cliente_int) ||
    !Array.isArray(series) ||
    !Array.isArray(repeticiones) ||
    series.some(isNaN) ||
    repeticiones.some(isNaN)
  ) {
    return res
      .status(400)
      .send(
        "Los valores de ID deben ser números enteros, y series y repeticiones deben ser arrays de números enteros"
      );
  }

  try {
    const query = `
      INSERT INTO plan_entrenamiento
      (id_cliente, dia, tipo_tren, musculo, ejercicio, series, repeticiones)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [
      id_cliente_int,
      dia,
      tipo_tren,
      musculo,
      ejercicio,
      series,
      repeticiones,
    ];

    await conexion.query(query, values);

    console.log("Entrenamiento guardado");
    res.send("Entrenamiento guardado");
  } catch (err) {
    console.error("Error al guardar el entrenamiento:", err);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

// Ruta para obtener entrenamientos

/////////////////////////////////////////////////

router.get("/whatsapito", (req, res) => {
  res.render("administrador/wasap/seccion");
});

//roles
router.post("/crearRoles", crud.crearRoles);
router.post("/updateRoles", crud.updateRoles);

//Clientes
router.post("/verClientess", crud.verClientes);
router.post("/crearclienteS", crud.crearclienteS);
router.post("/update_cliente", crud.update_cliente);

router.post("/renovar_cliente", crud.renovar_cliente);

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
router.get("/ventasDiarias", crud.ventasDiarias);

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

//index ahi melo para el calendario
router.post("/crear_evento", crud.crear_evento);

//INGRESO AL GIMNASIO:

router.post("/registrarIngreso", crud.registrarIngreso);
router.post("/registrarIngresoentre", crud.registrarIngresoentre);

//INFORMACION DE LOS CLIENTES
router.post("/actualizar_informacion", crud.update_info);
router.post("/ver_pqrs", crud.verPqrss);

///////////////////////////////////////////////////////////////////////////////////////////  CLIENTES CODGIO

// Define la función clasificarIMC fuera del callback
// Define la función clasificarIMC fuera del callback
// Define la función clasificarIMC fuera del callback
function clasificarIMC(imc) {
  if (imc < 18.5) return "Bajo peso";
  if (imc >= 18.5 && imc < 25) return "Normal";
  if (imc >= 25 && imc < 30) return "Sobrepeso";
  if (imc >= 30) return "Obesidad";
  return "No clasificado";
}

router.get("/clientes/index_c", authenticateToken, (req, res) => {
  if (!res.locals.userData) {
    return res
      .status(401)
      .json({ error: "No autorizado: datos del usuario no encontrados" });
  }

  let identificacion = res.locals.userData.id;

  if (!Number.isInteger(identificacion)) {
    return res.status(400).json({ error: "ID de cliente inválido" });
  }

  // Consulta para obtener la talla más reciente
  conexion.query(
    `SELECT * FROM tallas 
      WHERE id_cliente = $1
      ORDER BY fecha DESC
      LIMIT 1`,
    [identificacion],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      const tallaReciente = results.rows.length > 0 ? results.rows[0] : null;

      // Calcular el IMC
      let imc = null;
      let resultadoIMC = "No clasificado";
      if (tallaReciente && tallaReciente.peso && tallaReciente.altura) {
        const peso = parseFloat(tallaReciente.peso);
        const altura = parseFloat(tallaReciente.altura);
        const alturaEnMetros = altura / 100;
        imc = (peso / (alturaEnMetros * alturaEnMetros)).toFixed(2);
        console.log(`Peso: ${peso}, Altura: ${altura}, IMC: ${imc}`); // Verifica los valores
        resultadoIMC = clasificarIMC(parseFloat(imc));
        console.log(`Resultado IMC clasificado: ${resultadoIMC}`); // Verifica el resultado
      }

      // Consulta para obtener el peso, altura y fecha_modificacion de tallas temporales
      conexion.query(
        `SELECT peso, altura, fecha_modificacion FROM tallas_temporales 
          WHERE id_cliente = $1
          AND peso IS NOT NULL
          AND altura IS NOT NULL
          AND fecha_modificacion IS NOT NULL
          ORDER BY fecha_modificacion ASC`,
        [identificacion],
        (errorTemp, resultsTemp) => {
          if (errorTemp) {
            return res.status(500).sendFile(__dirname + "/500.html");
          }

          // Extrae los pesos, alturas y fechas para el gráfico
          const pesos = resultsTemp.rows.map((row) => row.peso);
          const alturas = resultsTemp.rows.map((row) => row.altura);
          const fechas = resultsTemp.rows.map((row) => {
            const fecha = new Date(row.fecha_modificacion);
            return fecha.toLocaleDateString("es-ES", {
              timeZone: "America/Bogota",
              year: "numeric",
              month: "2-digit",
              hour12: false,
            });
          });

          res.render("clientes/index_c", {
            tallaReciente: tallaReciente,
            imc: imc, // Asegúrate de pasar imc a la vista
            resultadoIMC: resultadoIMC, // Pasa el resultado del IMC a la vista
            pesos: pesos,
            alturas: alturas,
            fechas: fechas,
          });
        }
      );
    }
  );
});

//informacion personal

router.get("/info_personal", authenticateToken, (req, res) => {
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
    "SELECT * FROM clientes WHERE id = $1",
    [identificacion], // Pasar solo el 'id' como parámetro
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
      }

      res.render("clientes/informacion_personal/ver_info", {
        results: results.rows,
      });
    }
  );
});

router.get("/info_cliente/:id", authenticateToken, (req, res) => {
  const clientId = req.params.id;

  const clientQuery = `
    SELECT c.id, c.nombre, c.apellido, c.edad, c.sexo, c.fecha_de_inscripcion, 
           c.correo_electronico, c.numero_telefono, c.id_mensualidad, c.estado,
           m.id AS id_mensual, m.total_pagar, m.tiempo_plan
    FROM clientes AS c
    LEFT JOIN mensualidades AS m ON c.id_mensualidad = m.id
    WHERE c.id = $1`;

  conexion.query(clientQuery, [clientId], (clientError, clientResults) => {
    if (clientError) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    // Verificar si se encontraron resultados
    if (clientResults.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({
      datosCliente: clientResults.rows,
    });
  });
});

router.get("/mis_planes", authenticateToken, (req, res) => {
  let identificacion = res.locals.userData.id;

  conexion.query(
    ` SELECT mc.id AS id_mensu_cliente, mc.id_cliente, mc.nombre, mc.fecha_inicio, mc.fecha_fin, mc.id_mensualidad, mc.estado,
       m.id AS id_mensualidad, m.tiempo_plan, m.total_pagar, m.id_mensualidad_convencional, 
       mensu.id AS id_mensualidad_convencional, mensu.tipo_de_mensualidad 
       FROM mensualidad_clientes AS mc
       INNER JOIN mensualidades AS m ON mc.id_mensualidad = m.id
       INNER JOIN mensualidad_convencional AS mensu ON m.id_mensualidad_convencional = mensu.id
       WHERE mc.id_cliente = $1
       ORDER BY mc.id`,
    [identificacion],
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      res.render("clientes/informacion_personal/mis_planes", {
        results: results.rows,
      });
      console.log("mondades", results.rows);
    }
  );
});

router.get("/ayuda", authenticateToken, (req, res) => {
  let identificacion = res.locals.userData.id;

  conexion.query(
    "SELECT * FROM clientes WHERE id = $1",
    [identificacion], // Pasar solo el 'id' como parámetro
    (error, results) => {
      if (error) {
        return res.status(500).sendFile(__dirname + "/500.html"); // Manejo de error
      }

      res.render("clientes/informacion_personal/ayuda", {
        results: results.rows,
      });
    }
  );
});

router.post("/mensaje_ayuda", crud.mensaje_ayuda);

////////////////

router.get("/index_entrenador", authenticateToken, async (req, res) => {
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
      SELECT * FROM mensualidad_clientes WHERE estado = 'Vencida' ORDER BY fecha_fin DESC LIMIT 7;`;

    const resultVentasVencidas = await conexion.query(queryVentasVencidas);
    const datosVentasVencidas = resultVentasVencidas.rows;

    const querymensualidades = `
      SELECT * FROM mensualidades`;

    const resultMensualidades = await conexion.query(querymensualidades);
    const datosMensualidades = resultMensualidades.rows;

    // Renderizar la vista con los datos de todas las consultas
    res.render("entrenador/index_entrenador", {
      datosVentas: datosVentas,
      datosSumaPorMes: datosSumaArray,
      datosIngresosHoy: datosIngresosHoy,
      ultimosClientes: ultimosClientes,
      datosVentasVencidas: datosVentasVencidas,
      datosMensualidades: datosMensualidades,
    });
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});
router.get("/terminos", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/terminos.html"));
});
router.get("/politicas", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/politicas.html"));
});
router.get("/sobre_nosotros", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/sobre_nosotros.html"));
});

router.get("/mi_plan", authenticateToken, (req, res) => {
  let identificacion = res.locals.userData.id;

  const planQuery = `
    SELECT pe.dia, pe.tipo_tren, pe.musculo, pe.ejercicio, pe.series, pe.repeticiones, c.nombre
    FROM plan_entrenamiento AS pe
    JOIN clientes AS c ON pe.id_cliente = c.id
    WHERE pe.id_cliente = $1 `;

  conexion.query(planQuery, [identificacion], (planError, planResults) => {
    if (planError) {
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    if (planResults.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Plan de entrenamiento no encontrado" });
    }

    // Agrupar los resultados por cliente
    const planesDeEntrenamiento = planResults.rows;
    const nombreCliente = planesDeEntrenamiento[0].nombre;
    console.log("melos", planesDeEntrenamiento);
    // Responder con los datos del plan agrupados
    res.render("clientes/informacion_personal/mi_plan_ent", {
      nombreCliente,
      planesDeEntrenamiento, // Fíjate que estamos pasando 'planesDeEntrenamiento'
    });
  });
});

router.use((req, res) => {
  res.status(404).render("error", {
    title: "Página no encontrada",
    message: "Lo sentimos, la página que estás buscando no existe.",
  });
});

module.exports = router;
