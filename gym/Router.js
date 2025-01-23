const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "Zonadpr";
const path = require("path");
const crud = require("./controllers/crud");
const cron = require("node-cron");
const PDFDocument = require("pdfkit");
const { log, error } = require("console");
const { descargarPDF } = require("./controllers/crud");
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const fs = require("fs");
const axios = require("axios");
const mercadopago = require("mercadopago");
const { title } = require("process");
const format = require("pg-format");
const moment = require("moment");
const {
  InstalledAddOnContextImpl,
} = require("twilio/lib/rest/marketplace/v1/installedAddOn");

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

async function authenticateToken(req, res, next) {
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
    res.locals.userData = decoded;

    // Si no hay datos en la sesión, cargarlos desde la base de datos
    if (!req.session.userData) {
      const query = `
        SELECT u.id AS id_usuario, u.nombre AS nombre_usuario, 
               r.tipo_de_rol AS rol,
               CASE WHEN u.imagen_perfil IS NOT NULL THEN true ELSE false END AS tiene_imagen
        FROM usuarios AS u
        INNER JOIN roles AS r ON u.id_rol = r.id
        WHERE u.id = $1
      `;
      const result = await conexion.query(query, [decoded.id]);

      if (result.rows.length === 0) {
        return renderLoginPage(res, {
          status: 401,
          alertTitle: "Acceso Denegado",
          alertMessage: "Usuario no autorizado",
          alertIcon: "error",
        });
      }

      const userData = result.rows[0];
      userData.imagen_perfil = userData.tiene_imagen
        ? `/profile-image/${userData.id_usuario}`
        : "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png";

      req.session.userData = userData;
    }

    res.locals.userData = { ...res.locals.userData, ...req.session.userData };

    // Renovar el token si está por expirar
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
    showConfirmButton: false,
    timer: 1500,
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
    id: userData.id, // Incluir el ID del usuario
    role: userData.id_rol,
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
    const query =
      "SELECT imagen_perfil, imagen_content_type FROM usuarios WHERE id = $1";
    const result = await conexion.query(query, [userId]);

    if (result.rows.length > 0 && result.rows[0].imagen_perfil) {
      const { imagen_perfil, imagen_content_type } = result.rows[0];
      res.contentType(imagen_content_type);
      res.send(imagen_perfil);
    } else {
      res.redirect(
        "https://raw.githubusercontent.com/JeanCardozo/audios/main/acceso.png"
      );
    }
  } catch (error) {
    console.error("Error al obtener la imagen de perfil:", error);
    res.status(500).send("Error al obtener la imagen de perfil");
  }
});
router.get("/", async (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "cancel_success" || message === "success") {
    alertMessage = {
      type: "success",
      text: "Acccion Ejecutada Con Exito",
      timer: 1000,
      showConfirmButton: false,
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
    console.log(
      "para el renovarcliente a ver que es la informaicon que esta mandando",
      datosVentasVencidas
    );

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
      text: "Creacion del rol realizada",
      showConfirmButton: false,
      timer: 1200,
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

router.get("/actualizar/:id", authenticateToken, verifyAdmin, (req, res) => {
  const id = req.params.id;
  const message = req.query.message;

  conexion.query(
    "SELECT * FROM roles WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        res.status(500).sendFile(__dirname + "/500.html");
      }

      if (results.rowCount > 0) {
        res.json(results.rows[0]);
      } else {
        res.status(404).json({ error: "Rol no encontrado" });
      }
    }
  );
});

// Eliminar roles

router.get("/eliminarRol/:id", authenticateToken, verifyAdmin, (req, res) => {
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
    m.id AS id_mensual,m.total_pagar,m.tiempo_plan
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

//Factura del pedido
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
    // Configurar el documento con márgenes específicos para usar 80% del ancho
    const doc = new PDFDocument({
      size: "A4",
      margin: {
        top: 30, // Margen superior reducido para maximizar espacio
        bottom: 30, // Margen inferior reducido
        left: 50, // Aproximadamente 10% del ancho (595.28 × 0.10)
        right: 50, // Aproximadamente 10% del ancho
      },
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factura_${cliente.nombre}_${cliente.apellido}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Calcular dimensiones útiles
    const pageWidth = doc.page.width; // 595.28 puntos para A4
    const pageHeight = doc.page.height; // 841.89 puntos para A4
    const contentWidth = pageWidth * 0.8; // 80% del ancho
    const contentHeight = pageHeight * 0.9; // 90% del alto
    const marginX = (pageWidth - contentWidth) / 2;
    const marginY = (pageHeight - contentHeight) / 2;

    // Fondo gris claro que cubra toda la página
    doc.rect(0, 0, pageWidth, pageHeight).fill("#f8f9fa");

    // Logo centrado en la parte superior
    const logoWidth = 120;
    const logoHeight = 60;
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = marginY;

    try {
      doc.image("./public/images/logo.png", logoX, logoY, {
        width: logoWidth,
        height: logoHeight,
        align: "center",
      });
    } catch (err) {
      console.error("Error al cargar el logo:", err);
    }

    // Encabezado debajo del logo
    const headerY = logoY + logoHeight + 20;
    doc
      .fillColor("#000000")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("ZONA DE PODER GYM", marginX, headerY, {
        width: contentWidth,
        align: "center",
      });

    // Información de contacto
    doc
      .fontSize(11)
      .font("Helvetica")
      .moveDown(0.5)
      .text("Teléfono: 3209316797", {
        width: contentWidth,
        align: "center",
      })
      .text("Dirección: Calle 6ta - 7-20 centro, Chaparral", {
        width: contentWidth,
        align: "center",
      });

    // Línea divisoria
    const lineY1 = doc.y + 20;
    doc
      .moveTo(marginX, lineY1)
      .lineTo(pageWidth - marginX, lineY1)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    // Información del cliente en formato de tabla
    const clienteInfo = [
      { label: "Contacto ", value: `${cliente.nombre} ${cliente.apellido}` },
      {
        label: "Fecha de transacción ",
        value: new Date(cliente.fecha_de_inscripcion).toLocaleDateString(
          "es-CO"
        ),
      },
      { label: "Vendedor ", value: "Laura del Sol Hernandez" },
      { label: "Método de pago ", value: "Efectivo" },
      { label: "Estado ", value: cliente.estado },
      { label: "Número de transacción ", value: cliente.numero_transaccion },
    ];

    // Configurar la tabla de información del cliente
    doc.fontSize(11).fillColor("#333333");
    let yPos = lineY1 + 30;
    const labelWidth = contentWidth * 0.5;
    const valueWidth = contentWidth * 0.7;

    clienteInfo.forEach((item) => {
      doc
        .font("Helvetica-Bold")
        .text(item.label, marginX, yPos, {
          width: labelWidth,
          continued: true,
        })
        .font("Helvetica")
        .text(`: ${item.value}`, {
          width: valueWidth,
        });
      yPos += 25;
    });

    // Segunda línea divisoria
    const lineY2 = yPos + 20;
    doc
      .moveTo(marginX, lineY2)
      .lineTo(pageWidth - marginX, lineY2)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    // Tabla de productos
    const headerY2 = lineY2 + 30;
    const headers = ["Producto", "Cant.", "Precio U.", "Total"];
    const columnWidths = [
      contentWidth * 0.4, // Producto
      contentWidth * 0.2, // Cantidad
      contentWidth * 0.2, // Precio Unitario
      contentWidth * 0.2, // Total
    ];

    // Encabezados de la tabla
    let xPos = marginX;
    doc.font("Helvetica-Bold").fontSize(11);
    headers.forEach((header, i) => {
      doc.text(header, xPos, headerY2, {
        width: columnWidths[i],
        align: i === 0 ? "left" : "right",
      });
      xPos += columnWidths[i];
    });

    // Datos de la tabla
    const rowY = headerY2 + 30;
    xPos = marginX;
    doc.font("Helvetica").fontSize(11);

    // Producto
    doc.text("Mensualidad servicio de entrenamiento físico", xPos, rowY, {
      width: columnWidths[0],
    });

    // Cantidad
    doc.text("1", xPos + columnWidths[0], rowY, {
      width: columnWidths[1],
      align: "right",
    });

    // Precio Unitario
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      xPos + columnWidths[0] + columnWidths[1],
      rowY,
      {
        width: columnWidths[2],
        align: "right",
      }
    );

    // Total
    doc.text(
      `$ ${cliente.total_pagar.toLocaleString()}`,
      xPos + columnWidths[0] + columnWidths[1] + columnWidths[2],
      rowY,
      {
        width: columnWidths[3],
        align: "right",
      }
    );

    // Línea final antes del total
    const lineY3 = rowY + 40;
    doc
      .moveTo(marginX, lineY3)
      .lineTo(pageWidth - marginX, lineY3)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    // Total final
    const totalY = lineY3 + 20;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(
        "TOTAL:",
        marginX + contentWidth - columnWidths[2] - columnWidths[3],
        totalY,
        {
          width: columnWidths[2],
          align: "right",
        }
      )
      .text(
        `$ ${cliente.total_pagar.toLocaleString()}`,
        marginX + contentWidth - columnWidths[3],
        totalY,
        {
          width: columnWidths[3],
          align: "right",
        }
      );

    doc.end();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

/////////////////////////////////////////////////////////////////

// para editar clientes
router.get("/actualizar_clientes/:id", authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const queryCliente = `
      SELECT 
        c.id AS id_cliente, 
        c.nombre, 
        c.apellido, 
        c.edad, 
        c.sexo, 
        c.fecha_de_inscripcion, 
        c.correo_electronico,
        c.numero_telefono,
        c.id_mensualidad, 
        c.estado,
        c.contraseña,
        u.imagen_perfil,
        u.imagen_content_type
      FROM clientes c
      LEFT JOIN usuarios u ON LOWER(c.correo_electronico) = LOWER(u.correo_electronico)
      WHERE c.id = $1
    `;

    const queryMensualidades = `
      SELECT id AS id_mensu, tiempo_plan, total_pagar 
      FROM mensualidades
    `;

    const [clienteResult, mensualidadesResult] = await Promise.all([
      conexion.query(queryCliente, [id]),
      conexion.query(queryMensualidades),
    ]);

    if (clienteResult.rowCount === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const cliente = clienteResult.rows[0];
    const mensualidades = mensualidadesResult.rows.map((row) => ({
      id_mensu: row.id_mensu,
      tiempo_plan: row.tiempo_plan,
      total_pagar: row.total_pagar,
    }));

    if (cliente.imagen_perfil) {
      cliente.imagen_perfil = `data:${
        cliente.imagen_content_type || "image/jpeg"
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

router.get("/create_usuarios", authenticateToken, verifyAdmin, (req, res) => {
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

router.get(
  "/actualizar_usuarios/:id",
  authenticateToken,
  verifyAdmin,
  (req, res) => {
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
  }
);

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
  const mensaje = req.query.mensaje;

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
          mensaje: mensaje,
        });
      } else {
        res.status(404).json({ error: "Data not found" });
      }
    })
    .catch((error) => {
      res.status(500).sendFile(__dirname + "/500.html");
    });
});

// ver comvenios
router.get("/ver_convenio", authenticateToken, verifyAdmin, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
      timer: 1200,
      showConfirmButton: false,
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
router.get("/create_convenio", authenticateToken, verifyAdmin, (req, res) => {
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

router.get("/ver_mensualidad", authenticateToken, verifyAdmin, (req, res) => {
  const message = req.query.message;
  let alertMessage = null;
  if (message === "success") {
    alertMessage = {
      type: "success",
      text: "Cambios Realizados Con Exito.",
      timer: 1200,
      showConfirmButton: false,
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

router.get(
  "/actualizar_mensualidad/:id",
  authenticateToken,
  verifyAdmin,
  (req, res) => {
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
  }
);

router.get(
  "/get_mensu_convenio",
  authenticateToken,
  verifyAdmin,
  (req, res) => {
    conexion.query(
      "SELECT id, tipo_de_mensualidad FROM mensualidad_convencional",
      (error, results) => {
        if (error) {
          return res.status(500).sendFile(__dirname + "/500.html");
        }
        res.json(results.rows);
      }
    );
  }
);

//eliminar mensualidades
router.get("/eliminarMensu/:id", authenticateToken, verifyAdmin, (req, res) => {
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
router.get(
  "/ver_grupo_muscular",
  authenticateToken,
  verifyAdmin,
  (req, res) => {
    const message = req.query.message;
    let alertMessage = null;
    if (message === "success") {
      alertMessage = {
        type: "success",
        text: "Cambios Realizados Con Exito.",
        showConfirmButton: false,
        timer: 1200,
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
  }
);

// editar grupo muscular
router.get("/actualizar_g/:id", authenticateToken, verifyAdmin, (req, res) => {
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

router.get("/ver_ventas", authenticateToken, verifyAdmin, async (req, res) => {
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
router.get("/ver_acti_fisica", authenticateToken, verifyAdmin, (req, res) => {
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

router.get(
  "/get_grupos_musculares",
  authenticateToken,
  verifyAdmin,
  (req, res) => {
    conexion.query(
      "SELECT id, nombre FROM grupos_musculares",
      (error, results) => {
        if (error) {
          return res.status(500).sendFile(__dirname + "/500.html");
        }
        res.json(results.rows);
      }
    );
  }
);

//ACTUALIZAR
router.get("/actualizar_f/:id", authenticateToken, verifyAdmin, (req, res) => {
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
  conexion.query(
    "SELECT id, dia, ejercicio, series, repeticiones, id_cliente FROM plan_entrenamiento ORDER BY id ASC",
    (error, results) => {
      if (error) {
        console.log("Error al obtener los planes de entrenamiento: ", error);
        return res.status(500).sendFile(__dirname + "/500.html");
      }

      if (results.rows.length === 0) {
        // Renderiza la página con un mensaje indicando que no hay planes de entrenamiento
        return res.render("administrador/plan_de_entrenamiento/ver_plan_ent", {
          planEntrenamiento: [],
          nombreCliente: null,
          mensaje: "No hay planes de entrenamiento creados.",
        });
      }
      const clienteId = results.rows[0].id_cliente;

      conexion.query(
        "SELECT nombre FROM clientes WHERE id = $1",
        [clienteId],
        (error, clienteNameResults) => {
          if (error) {
            console.log("Error al obtener el nombre del cliente: ", error);
            return res.status(500).sendFile(__dirname + "/500.html");
          }

          const clienteNombre =
            clienteNameResults.rows[0]?.nombre || "Cliente no encontrado";

          // Renderizar la vista con los resultados del plan de entrenamiento y el nombre del cliente
          res.render("administrador/plan_de_entrenamiento/ver_plan_ent", {
            planEntrenamiento: results.rows,
            nombreCliente: clienteNombre,
            mensaje: null, // No hay mensaje cuando hay resultados
            alert: null,
          });
        }
      );
    }
  );
});

router.get("/info_plan/:id", authenticateToken, (req, res) => {
  const clienteId = req.params.id;

  const planQuery = `
    SELECT pe.dia, pe.id_cliente, pe.ejercicio, pe.series, pe.repeticiones, c.nombre
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

// Ruta para obtener actividades físicas por grupo muscular

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

// Función para procesar el registro temporal
async function procesarRegistroTemporal(tempRegistroId) {
  const client = await conexion.connect(); // Obtener un cliente del pool
  try {
    await client.query("BEGIN"); // Iniciar la transacción

    // Obtener datos de temp_registro
    const queryTemp =
      "SELECT * FROM temp_registro WHERE id_usuario = $1 FOR UPDATE";
    const resTemp = await client.query(queryTemp, [tempRegistroId]);

    if (resTemp.rows.length === 0) {
      throw new Error("Registro temporal no encontrado");
    }

    const tempData = resTemp.rows[0];

    // Insertar en usuarios
    const queryUsuario = `
      INSERT INTO usuarios (id, nombre, apellido, correo_electronico, telefono, contraseña, id_rol, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const resUsuario = await client.query(queryUsuario, [
      tempData.id_usuario,
      tempData.nombre,
      tempData.apellido,
      tempData.correo,
      tempData.telefono,
      tempData.contraseña,
      3, // id_rol
      "Activo", // estado
    ]);

    const usuarioId = resUsuario.rows[0].id;

    // Insertar en clientes
    const queryCliente = `
      INSERT INTO clientes (id, nombre, apellido, edad, sexo, fecha_de_inscripcion, correo_electronico, numero_telefono, id_mensualidad, estado)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota', $6, $7, $8, $9)
    `;
    await client.query(queryCliente, [
      usuarioId,
      tempData.nombre,
      tempData.apellido,
      tempData.edad,
      tempData.sexo,
      tempData.correo,
      tempData.telefono,
      tempData.id_mensu,
      "Activo", // estado
    ]);

    // Eliminar el registro temporal
    const queryDeleteTemp = "DELETE FROM temp_registro WHERE id_usuario = $1";
    await client.query(queryDeleteTemp, [tempRegistroId]);

    await client.query("COMMIT"); // Confirmar la transacción
  } catch (error) {
    await client.query("ROLLBACK"); // Revertir la transacción en caso de error
    throw error; // Propagar el error
  } finally {
    client.release(); // Liberar el cliente de vuelta al pool
  }
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
    const { title, unit_price, tempRegistroId, id_mensualidad } = req.body;

    const body = {
      items: [
        {
          title: title,
          unit_price: Number(unit_price),
          currency_id: "COP",
          quantity: 1,
        },
      ],
      back_urls: {
        success: `http://localhost:5000/success?tempRegistroId=${tempRegistroId}&id_mensualidad=${id_mensualidad}`,
        failure: `http://localhost:5000/failure?tempRegistroId=${tempRegistroId}`,
        pending: `http://localhost:5000/pending?tempRegistroId=${tempRegistroId}`,
      },
      auto_return: "approved",
      default_installments: 1,
    };

    const preference = new Preference(client);
    const result = await preference.create({ body });

    res.json({
      id: result.id,
    });
  } catch (error) {
    console.error("Error al crear la preferencia de pago:", error);
    // Aquí devolvemos JSON en lugar de renderizar una vista HTML
    res.status(500).json({
      success: false,
      message: "Hubo un problema al crear la orden de pago.",
    });
  }
});

// Ruta de éxito de pago
router.get("/success", async (req, res) => {
  const { tempRegistroId, id_mensualidad } = req.query;

  if (!tempRegistroId || !id_mensualidad) {
    return res.status(400).json({
      success: false,
      message: "Registro temporal no encontrado o mensualidad no proporcionada",
    });
  }

  try {
    console.log("xd:", tempRegistroId, "xd2:", id_mensualidad);
    // Actualizar el registro temporal con el id de mensualidad pagada
    const queryUpdateMensualidad =
      "UPDATE temp_registro SET id_mensu = $1 WHERE id_usuario = $2";
    await conexion.query(queryUpdateMensualidad, [
      id_mensualidad,
      tempRegistroId,
    ]);

    // Procesar el registro temporal
    await procesarRegistroTemporal(tempRegistroId);

    // Redirigir al login con alertas
    res.redirect(
      `/login_index?alert=success&message=Registro exitoso. Ahora puedes iniciar sesión.`
    );
  } catch (error) {
    console.error("Error al procesar el registro temporal:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/failure", async (req, res) => {
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
      alertTitle: "Pago Fallido",
      alertMessage: "Hubo un problema al procesar tu pago.",
      alertIcon: "error",
      showConfirmButton: true,
      tempRegistroId: tempRegistroId,
      mensualidades,
    });
  } catch (error) {
    console.error("Error en la ruta de fallo:", error);
    res.status(500).sendFile(__dirname + "/500.html");
  }
});

router.get("/pending", async (req, res) => {
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
      alertTitle: "Pago Pendiente",
      alertMessage: "Tu pago está en proceso. Espera la confirmación.",
      alertIcon: "info",
      showConfirmButton: true,
      tempRegistroId: tempRegistroId,
      mensualidades,
    });
  } catch (error) {
    console.error("Error en la ruta de pendiente:", error);
    res.status(500).sendFile(__dirname + "/500.html");
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

router.get("/create_plan_ent", authenticateToken, (req, res) => {
  crud.mostrarFormularioVacio(req, res);
});

router.post("/guardar_plan", async (req, res) => {
  const { id_cliente, plan: eventos } = req.body;
  const values = eventos.map((evento) => [
    id_cliente,
    moment(evento.start).format("DD/MM/YYYY"), // Formato de fecha
    evento.title,
    `{${evento.series}}`,
    `{${evento.repeticiones}}`,
  ]);

  try {
    const query = format(
      `
      INSERT INTO plan_entrenamiento (id_cliente, dia, ejercicio,series,repeticiones)
      VALUES %L RETURNING id
    `,
      values
    );

    const result = await conexion.query(query);
    res.json({ success: true, ids: result.rows.map((row) => row.id) });
  } catch (error) {
    console.error("Error al guardar el plan de entrenamiento:", error);
    res.status(500).json({ success: false });
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
router.post("/verPlanEnt", crud.verPlanEnt);
router.post("/update_pe", crud.update_pe);
router.get("/create_plan_ent", crud.mostrarFormularioVacio);

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
function clasificarIMC(imc) {
  if (imc < 18.5) return "Bajo peso";
  if (imc >= 18.5 && imc < 25) return "Normal";
  if (imc >= 25 && imc < 30) return "Sobrepeso";
  if (imc >= 30) return "Obesidad";
  return "No clasificado";
}

router.get(
  "/clientes/index_c",
  authenticateToken,
  verifyClient,
  async (req, res) => {
    console.log(
      "Datos de res.locals.userData en la ruta:",
      res.locals.userData
    );
    if (!res.locals.userData) {
      return res
        .status(401)
        .json({ error: "No autorizado. Datos de usuario no encontrados." });
    }

    const identificacion = res.locals.userData.id;
    const nombre_usuario = res.locals.userData.nombre_usuario; // Ahora puedes acceder a nombre_usuario
    const imagen_perfil = res.locals.userData.imagen_perfil;

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
            console.log("ver el peso a ver que llega", pesos);
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
  }
);

//informacion personal

router.get("/info_personal", authenticateToken, verifyClient, (req, res) => {
  // Verifica si 'userData' está configurado correctamente
  console.log("hpta: ", res.locals.userData.id);
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
      console.log("informacion del cliente", results.rows);
      res.render("clientes/informacion_personal/ver_info", {
        results: results.rows,
      });
    }
  );
});

router.get("/info_cliente/:id", authenticateToken, verifyClient, (req, res) => {
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

router.get("/mis_planes", authenticateToken, verifyClient, (req, res) => {
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

router.get("/ayuda", authenticateToken, verifyClient, (req, res) => {
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

router.get("/mi_plan", authenticateToken, verifyClient, (req, res) => {
  let identificacion = res.locals.userData.id;

  const planQuery = `
      SELECT pe.dia, pe.id_cliente, pe.ejercicio, pe.series, pe.repeticiones, c.nombre
      FROM plan_entrenamiento AS pe
      JOIN clientes AS c ON pe.id_cliente = c.id
      WHERE pe.id_cliente = $1 `;

  conexion.query(planQuery, [identificacion], (planError, planResults) => {
    if (planError) {
      console.log("ver error", planError);
      return res.status(500).sendFile(__dirname + "/500.html");
    }

    if (planResults.rows.length === 0) {
      return res.render("clientes/informacion_personal/mi_plan_ent", {
        nombreCliente: null,
        planesDeEntrenamiento: [],
      });
    }

    const planesDeEntrenamiento = planResults.rows;
    const nombreCliente = planesDeEntrenamiento[0].nombre;

    res.render("clientes/informacion_personal/mi_plan_ent", {
      nombreCliente,
      planesDeEntrenamiento,
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
