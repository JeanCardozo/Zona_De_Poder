const pool = require("../config/zona_de_poder_db");

const createRole = async (role) => {
  const result = await pool.query(
    "INSERT INTO roles (tipo_de_rol) VALUES ($1) RETURNING *",
    [role.tipo_de_rol]
  );
  return result.rows[0];
};

const getRoles = async () => {
  const result = await pool.query("SELECT * FROM roles");
  return result.rows;
};

const getRoleById = async (id) => {
  const result = await pool.query("SELECT * FROM roles WHERE id = $1", [id]);
  return result.rows[0];
};

const updateRole = async (id, role) => {
  const result = await pool.query(
    "UPDATE roles SET tipo_de_rol = $1 WHERE id = $2 RETURNING *",
    [role.tipo_de_rol, id]
  );
  return result.rows[0];
};

const deleteRole = async (id) => {
  await pool.query("DELETE FROM roles WHERE id = $1", [id]);
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
