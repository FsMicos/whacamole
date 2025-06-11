// src/controllers/gameController.js

const path = require('path');

exports.serveGame = (req, res) => {
  // Envía el archivo 'game.html' que está en la carpeta 'views'.
  // path.resolve se asegura de construir la ruta correctamente.
  res.sendFile(path.resolve(__dirname, '../views/game.html'));
};