const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Habilitar CORS para todas las rutas
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});