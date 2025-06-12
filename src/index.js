
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000; // El puerto donde correrá tu servidor

// 1. Servir archivos estáticos (CSS, JS del cliente, imágenes)
// Le decimos a Express que la carpeta 'assets' contiene archivos públicos.
app.use(express.static(path.join(__dirname, 'assets')));

// 2. Definir las rutas de la aplicación
// (Este código es un borrador, lo crearemos en el siguiente paso)
const gameRoutes = require('./routes/gameRoutes');
app.use('/', gameRoutes);


// 3. Iniciar el servidor
app.listen(PORT, () => {
  console.log(`¡Servidor corriendo en http://localhost:${PORT}!`);
});