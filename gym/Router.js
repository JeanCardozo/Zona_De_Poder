const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");

//raiz de todo

router.get("/", (req, res) => {
  res.render("index");
});

//ver ROLES

router.get("/ver_roles", (req, res) => {
  conexion.query("SELECT * FROM roles", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.render("roles/ver_roles", { results: results.rows });
  });
});

// Crear ROLES

router.get("/create_rol", (req, res) => {
  res.render("roles/create_rol");
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
        res.render("roles/actualizar", { user: results.rows[0] });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

// Eliminar

router.get("/eliminar/:id", (req, res) => {
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
  conexion.query(
    "SELECT * FROM clientes AS c INNER JOIN mensualidades AS m ON m.id_cliente = c.id",

    // "SELECT * FROM clientes AS c INNER JOIN mensualidades AS m ON WHERE m.id_cliente = c.id",
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("clientes/ver_clientes", { results: results.rows });
    }
  );
});

// crear clientes
router.get("/create_clientes", (req, res) => {
  conexion.query(
    "SELECT id, total_pagar FROM mensualidades",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.render("clientes/create_clientes", { results: results.rows });
    }
  );
});

// para editar clientes
router.get("/actualizar_clientes/:id", (req, res) => {
  const id = req.params.id;

  conexion.query(
    "SELECT * FROM clientes AS c INNER JOIN mensualidades AS m ON m.id_cliente = c.id",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (results.rowCount > 0) {
        res.render("actualizar_clientes", { user: results.rows[0] });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});
//borrar cliente
router.get("/deletecliente/:id", (req, res) => {
  const id = req.params.id;

  conexion.query(
    "DELETE FROM cliente WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.redirect("/");
    }
  );
});

//usuarios

// /ver_usuarios
router.get("/ver_usuarios", (req, res) => {
  conexion.query(
    "SELECT u.id AS id_usuario ,u.nombre ,u.apellido,u.telefono,u.correo_electronico,u.contraseña, u.id_rol, u.estado,r.id AS id_roles, r.tipo_de_rol AS rol FROM usuarios AS u INNER JOIN roles AS r ON u.id_rol=r.id  ",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      res.render("usuarios/ver_usuarios", { results: results.rows });
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
      res.render("usuarios/create_usuarios", { results: results.rows });
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

      res.render("tallas/ver_talla", { results: results.rows });
    }
  );
});

//CREAR TALLA
router.get("/create_clientes", (req, res) => {
  conexion.query(
    "SELECT id, total_pagar FROM mensualidades",

    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.render("clientes/create_clientes", { results: results.rows });
    }
  );
});

//Enrutamiento al crud para roles
const crud = require("./controllers/crud");

router.post("/crear", crud.crear);
router.post("/update", crud.update);

//Enrutamiento al crud para Clientes
router.post("/crearclientes", crud.crearcliente);

router.post("/update_cliente", crud.update_cliente);

//crear usuarios
router.post("/crearusu", crud.crearusu);

//desactivar usuario
router.post("/desactivarusuario", crud.desactivarusuario);

module.exports = router;
