const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "negrosdemierda";

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
  conexion.query("SELECT * FROM roles", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("administrador/roles/ver_roles", { results: results.rows });
  });
});

// Crear ROLES

router.get("/create_rol", (req, res) => {
  res.render("administrador/roles/create_rol");
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
        res.render("administrador/roles/actualizar", { user: results.rows[0] });
      } else {
        res.status(404).json({ error: "User not found" });
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
    SELECT c.id,c.nombre,c.apellido,c.edad,c.sexo,c.fecha_de_inscripcion,c.correo_electronico,c.numero_telefono,c.id_mensualidad,c.id_usuario,c.estado,m.id AS id_mensual,m.total_pagar,m.tiempo_plan,u.nombre AS nom_usu
    FROM clientes AS c 
    INNER JOIN mensualidades AS m ON c.id_mensualidad = m.id
    INNER JOIN usuarios AS u ON c.id_usuario= u.id ORDER BY c.id`;

  conexion.query(query, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("administrador/clientes/ver_clientes", {
      results: results.rows,
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
    "SELECT * FROM tallas",

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
    "SELECT * FROM tallas WHERE id_cliente = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        res.render("administrador/tallas/actualizar_tallas", {
          user: results.rows[0],
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
  const id = parseInt(req.params.id, 10);

  conexion.query(
    "SELECT * FROM mensualidad_convencional WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        res.render("administrador/convenio/actualizar_convenio", {
          user: results.rows[0],
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

// Ver mensualidad
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

router.get("/crear_mensualidad", (req, res) => {
  conexion.query(
    "SELECT * FROM roles",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.render("administrador/mensualidades/crear_mensualidad", {
        results: results.rows,
      });
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

// crear grupo muscular
router.get("/create_grupo_muscular", (req, res) => {
  res.render("administrador/grupo_muscular/create_grupo_muscular");
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
        res.render("administrador/grupo_muscular/actualizar_g", {
          user: results.rows[0],
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

/////////////////////////////////////////////////////7

//VENTAS

router.get("/ver_ventas", (req, res) => {
  conexion.query(
    "SELECT * FROM mensualidad_clientes ORDER BY id",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }
      res.render("administrador/ventas/ver_ventas", {
        results: results.rows,
      });
    }
  );
});

/////////////////////////////////////////////////////////////////

//ACTIVIDAD FISICA

//VER
router.get("/ver_acti_fisica", autenticateToken, (req, res) => {
  const query = `
    SELECT 
      af.id AS af_id, 
      af.nombre_ejercicio AS af_nombre, 
      af.series AS af_series, 
      af.repeticiones AS af_reps, 
      af.video_ejemplo AS af_video,
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

//CREAR
router.get("/create_acti_fisica", (req, res) => {
  // Realizamos la consulta para obtener los grupos musculares
  conexion.query(
    "SELECT id, nombre FROM grupos_musculares",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Pasamos los resultados a la vista
      res.render("administrador/actividad_fisica/create_acti_fisica", {
        grupos_musculares: results.rows, // results.rows contiene los datos de la consulta
      });
    }
  );
});

//ACTUALIZAR
router.get("/actualizar_f/:id", (req, res) => {
  const id = req.params.id;

  const queryActividadFisica = `
  SELECT af.*, gm.nombre AS grupo_muscular_nombre 
  FROM actividad_fisica af 
  INNER JOIN grupos_musculares gm ON af.id_grupo_muscular = gm.id 
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
        res.render("administrador/actividad_fisica/actualizar_f", {
          user: actividadFisicaResult.rows[0],
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

//VER
router.get("/ver_plan_ent", autenticateToken, (req, res) => {
  const query = `
    SELECT 
      pe.id AS pe_id, 
      pe.dia AS pe_dia_de_la_semana, 
      c.id AS c_id_cliente, 
      c.nombre AS c_nombre,
      af.id AS af_id_acti_fisica,
      af.nombre_ejercicio AS af_nombre,
      af.series AS af_series,
      af.repeticiones AS af_reps

    FROM 
      plan_entrenamiento pe 
    INNER JOIN 
      clientes c
    ON 
      pe.id_cliente = c.id 
    INNER JOIN
      actividad_fisica af
    ON
      pe.id_actividad_fisica = af.id
    ORDER BY 
      pe.id
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

//CREAR
router.get("/create_plan_ent", (req, res) => {
  // Realizamos la consulta para obtener los grupos musculares
  conexion.query(
    "SELECT id, nombre FROM grupos_musculares",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Pasamos los resultados a la vista
      res.render("administrador/actividad_fisica/create_acti_fisica", {
        grupos_musculares: results.rows, // results.rows contiene los datos de la consulta
      });
    }
  );
});

//Enrutamiento al crud
const crud = require("./controllers/crud");

//roles
router.post("/crear", crud.crear);
router.post("/update", crud.update);

//Clientes
router.post("/crearclienteS", crud.crearclienteS);
router.post("/update_cliente", crud.update_cliente);
router.post("/desactivarcliente", crud.desactivarcliente);
router.post("/activarcliente", crud.activarcliente);

//crear usuarios
router.post("/crearusu", crud.crearusu);
router.post("/update_cliente", crud.update_cliente);
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
// router.post("/crear_mensu", crud.crearMensu);

//mensualidades_compradas

//tallas
router.post("/update_tallas", crud.update_tallas);

//GRUPO MUSCULAR
router.post("/crear_gm", crud.crear_gm);
router.post("/update_gm", crud.update_gm);

//ACTIVIDAD FISICA
router.post("/crear_af", crud.crear_af);
router.post("/update_af", crud.update_af);

//PLAN DE ENTRENAMIENTO
router.post("/crear_af", crud.crear_af);

module.exports = router;
