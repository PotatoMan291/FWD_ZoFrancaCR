const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pages", "dashboard.html"));
});

// El frontend usa un puerto distinto al backend json-server.
// json-server queda en 3001, como esperan los servicios de public/js/config.js.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Frontend ZoFranca CR: http://localhost:${PORT}`);
  console.log("Backend esperado: http://localhost:3001");
});
