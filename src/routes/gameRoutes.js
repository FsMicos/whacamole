// src/routes/gameRoutes.js

const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Cuando alguien visita la página principal (ej: localhost:3000),
// se ejecuta la función 'serveGame' del controlador.
router.get('/', gameController.serveGame);

module.exports = router;