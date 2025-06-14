// src/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// La ruta raíz '/' ahora muestra la pantalla de inicio
router.get('/', gameController.serveHome);

// La nueva ruta '/game' muestra la pantalla del juego
router.get('/game', gameController.serveGame);

module.exports = router;