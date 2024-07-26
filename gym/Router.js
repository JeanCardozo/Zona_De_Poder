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

// Eliminar Roles

router.get("/eliminar/:id", (req, res) => {
  const id = parseInt(req.params.id);

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
router.get("/editarcliente/:id", (req, res) => {
  const id = req.params.id;

  // Uso de parametrización en la consulta
  conexion.query(
    "SELECT * FROM cliente WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      if (results.rowCount > 0) {
        res.render("editarcliente", { user: results.rows[0] });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

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

//Enrutamiento al crud para roles
const crud = require("./controllers/crud");

router.post("/crear", crud.crear);
router.post("/update", crud.update);

//Enrutamiento al crud para Clientes
router.post("/crearclientes", crud.crearcliente);

// router.post("/savecliente", crud.savecliente);
module.exports = router;
