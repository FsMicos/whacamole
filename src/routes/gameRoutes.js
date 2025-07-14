// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios'); // ✅ Importación única y correcta
const Score = require('../models/score'); 
const gameController = require('../controllers/gameController');

// --- Vistas del juego ---
router.get('/', gameController.serveHome);
router.get('/game', gameController.serveGame);
router.get('/leaderboard', gameController.serveLeaderboard);
router.get('/help', gameController.serveHelp);

// --- Función auxiliar para predecir velocidad usando Flask ---
async function predecirVelocidad(data) {
    try {
        const response = await axios.post('http://127.0.0.1:5000/predecir', data);
        return response.data.velocidad_clasificada;
    } catch (error) {
        console.error("Error al conectar con Flask:", error.message);
        return 'media'; // Valor por defecto si algo sale mal
    }
}

// --- Ruta POST para guardar puntuaciones ---
router.post('/api/scores', async (req, res) => {
    try {
        const { nickname, score, successfulHits, missedMoles, successRate, avgReactionTime } = req.body;

        if (!nickname || score === undefined) {
            return res.status(400).json({ error: 'Faltan datos requeridos (nickname y score).' });
        }

        const newScore = await Score.create({
            nickname,
            score,
            successfulHits,
            missedMoles,
            successRate,
            avgReactionTime
        });

        res.status(201).json(newScore);
    } catch (error) {
        console.error("Error al guardar la puntuación:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- Ruta GET para mostrar leaderboard ---
router.get('/api/scores', async (req, res) => {
    try {
        const topScores = await Score.findAll({
            order: [['score', 'DESC']],
            limit: 10
        });
        res.status(200).json(topScores);
    } catch (error) {
        console.error("Error al obtener las puntuaciones:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// 🚀 NUEVA RUTA para usar el modelo de IA y predecir la dificultad
router.post('/api/evaluar', async (req, res) => {
    try {
        const data = req.body;

        const velocidad = await predecirVelocidad(data); // 👉 Llamada a Flask

        res.status(200).json({ velocidad_sugerida: velocidad });
    } catch (error) {
        console.error("Error al evaluar al jugador:", error);
        res.status(500).json({ error: 'Error al predecir con el modelo.' });
    }
});


module.exports = router;
