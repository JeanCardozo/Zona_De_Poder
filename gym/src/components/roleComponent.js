import React, { useEffect, useState } from "react";
import axios from "axios";

const RoleComponent = () => {
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/router/roleRoutes"
        );
        setRoles(response.data);
      } catch (error) {
        console.error("Error fetching roles", error);
      }
    };

    fetchRoles();
  }, []);

  const addRole = async () => {
    try {
      const response = await axios.post(
        "http://localhost:5000/router/roleRoutes",
        {
          tipo_de_rol: newRole,
        }
      );
      setRoles([...roles, response.data]);
      setNewRole("");
    } catch (error) {
      console.error("Error adding role", error);
    }
  };

  const updateRole = async (id) => {
    const updatedRole = prompt("Enter the new role name");
    if (updatedRole) {
      try {
        const response = await axios.put(
          `http://localhost:5000/router/roleRoutes/${id}`,
          {
            tipo_de_rol: updatedRole,
          }
        );
        setRoles(roles.map((role) => (role.id === id ? response.data : role)));
      } catch (error) {
        console.error("Error updating role", error);
      }
    }
  };

  const deleteRole = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/router/roleRoutes/${id}`);
      setRoles(roles.filter((role) => role.id !== id));
    } catch (error) {
      console.error("Error deleting role", error);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Roles</h2>
      <input
        type="text"
        value={newRole}
        onChange={(e) => setNewRole(e.target.value)}
        placeholder="New Role"
        className="border p-2 mb-4 w-full"
      />
      <button
        onClick={addRole}
        className="bg-blue-500 text-white p-2 rounded mb-4"
      >
        Add Role
      </button>
      <ul className="list-disc pl-5">
        {roles.map((role) => (
          <li key={role.id} className="mb-2 flex justify-between items-center">
            {role.tipo_de_rol}
            <div>
              <button
                onClick={() => updateRole(role.id)}
                className="bg-yellow-500 text-white p-1 rounded mr-2"
              >
                Edit
              </button>
              <button
                onClick={() => deleteRole(role.id)}
                className="bg-red-500 text-white p-1 rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RoleComponent;
