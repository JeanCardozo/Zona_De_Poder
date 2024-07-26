const express = require("express");
const router = express.Router();
const conexion = require("./database/zona_de_poder_db");

router.get("/", (req, res) => {
  conexion.query("SELECT * FROM roles", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message }); // Manejo de error
    }

    res.render("index", { results: results.rows });
  });
});

//ruta para ver todo

router.get("/ver_roles", (req, res) => {
  conexion.query("SELECT * FROM roles", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message }); // Manejo de error
    }

    res.render("roles/ver_roles", { results: results.rows });
  });
});

//ruta para crear registros

router.get("/create_rol", (req, res) => {
  res.render("roles/create_rol");
});

// Ruta para editar
router.get("/actualizar/:id", (req, res) => {
  const id = req.params.id;

  // Uso de parametrización en la consulta
  conexion.query(
    "SELECT * FROM roles WHERE id = $1",
    [id],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: error.message }); // Manejo de error
      }

      if (results.rowCount > 0) {
        res.render("roles/actualizar", { user: results.rows[0] });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    }
  );
});

// Ruta para eliminar
router.get("/delete/:id", (req, res) => {
  const id = req.params.id;

  conexion.query("DELETE FROM roles WHERE id = $1", [id], (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.redirect("roles/ver_roles");
  });
});

//-----------------------------------------------------------

//ruta para ver clientes

router.get("/vercliente", (req, res) => {
  conexion.query("SELECT * FROM cliente", (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message }); // Manejo de error
    }

    res.render("vercliente", { results: results.rows });
  });
});

// crear clientes
router.get("/crearcliente", (req, res) => {
  res.render("crearcliente");
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

//Enrutamiento de crud Roles
const crud = require("./controllers/crud");
router.post("/crear", crud.crear);
router.post("/savecliente", crud.savec);
router.post("/update", crud.update);
router.post("/updatecliente", crud.updatecliente);

module.exports = router;
