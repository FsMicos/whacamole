const path = require('path');

// Nueva función para servir la pantalla de inicio
exports.serveHome = (req, res) => {
  res.sendFile(path.resolve(__dirname, '../views/index.html'));
};

// Función para servir la pantalla del juego
exports.serveGame = (req, res) => {
  res.sendFile(path.resolve(__dirname, '../views/game.html'));
};
exports.serveLeaderboard = (req, res) => {
  res.sendFile(path.resolve(__dirname, '../views/leaderboard.html'));
};
