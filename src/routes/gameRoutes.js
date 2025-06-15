// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const Score = require('../models/score'); 
const gameController = require('../controllers/gameController');

// La ruta raíz '/' ahora muestra la pantalla de inicio
router.get('/', gameController.serveHome);
// La nueva ruta '/game' muestra la pantalla del juego
router.get('/game', gameController.serveGame);
router.get('/leaderboard', gameController.serveLeaderboard);

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
        res.status(201).json(newScore); // 201 = Creado
    } catch (error) {
        console.error("Error al guardar la puntuación:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

router.get('/api/scores', async (req, res) => {
    try {
        const topScores = await Score.findAll({
            order: [
                ['score', 'DESC'] // Ordena por puntuación de mayor a menor
            ],
            limit: 10 // Limita los resultados a los 10 mejores
        });
        res.status(200).json(topScores);
    } catch (error) {
        console.error("Error al obtener las puntuaciones:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router; 