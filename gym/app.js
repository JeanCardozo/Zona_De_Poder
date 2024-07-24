const express = require("express");
const cors = require("cors");
const roleRoutes = require("./router/roleRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/roles", roleRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
