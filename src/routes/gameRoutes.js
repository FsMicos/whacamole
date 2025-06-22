// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const Score = require('../models/score'); 
const MLData = require('../models/mldata');
const gameController = require('../controllers/gameController');
const path = require('path');
const fs = require('fs');

// La ruta raíz '/' ahora muestra la pantalla de inicio
router.get('/', gameController.serveHome);
// La nueva ruta '/game' muestra la pantalla del juego
router.get('/game', gameController.serveGame);
router.get('/leaderboard', gameController.serveLeaderboard);
router.get('/help', gameController.serveHelp);

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

// Ruta para guardar datos de ML en la base de datos
router.post('/api/ml-data', async (req, res) => {
    try {
        const { datos, nickname } = req.body;
        
        if (!datos || !Array.isArray(datos) || datos.length === 0) {
            return res.status(400).json({ error: 'No hay datos para guardar' });
        }

        // Generamos un ID de partida único basado en timestamp
        const partidaId = Date.now();
        
        // Procesamos los datos para adaptarlos al nuevo modelo
        const ultimoDato = datos[datos.length - 1];
        
        console.log("Último dato recibido:", ultimoDato); // Depuración
          const mlDataToSave = {
            nickname: nickname || 'ANON',
            puntuacion: ultimoDato?.puntuacion || 0,
            aciertos: ultimoDato?.aciertos || 0,
            fallos: ultimoDato?.fallos || 0,
            tasa_exito: ultimoDato?.tasa_exito || 0,
            tiempo_reaccion_promedio: ultimoDato?.tiempo_reaccion_promedio || 0,
            partida_id: partidaId,
            // Añadir las columnas para el modelo ML
            agujero_sugerido: ultimoDato?.agujero_sugerido || 0,
            velocidad_sugerida: ultimoDato?.velocidad_sugerida || ultimoDato?.dificultad_actual || 1500
        };
        
        console.log("Datos a guardar:", mlDataToSave); // Depuración
        
        // Añadimos las estadísticas por agujero del último dato
        for (let i = 0; i < 8; i++) {
            mlDataToSave[`aciertos_agujero_${i}`] = ultimoDato[`aciertos_agujero_${i}`] || 0;
            mlDataToSave[`fallos_agujero_${i}`] = ultimoDato[`fallos_agujero_${i}`] || 0;
            mlDataToSave[`tiempo_reaccion_agujero_${i}`] = ultimoDato[`tiempo_reaccion_agujero_${i}`] || 0;
        }
        
        // Guardamos los datos en el nuevo formato
        const savedData = await MLData.create(mlDataToSave);
        
        // Automáticamente exportamos a CSV después de guardar los datos
        try {
            await exportarDatosExcel();
            console.log("Datos exportados automáticamente a CSV");
        } catch (error) {
            console.error("Error en exportación automática a CSV:", error.message);
        }
        
        res.status(201).json({ 
            success: true, 
            mensaje: 'Datos de ML guardados exitosamente', 
            datos: savedData,
            partida_id: partidaId
        });
    } catch (error) {
        console.error("Error al guardar datos de ML:", error);
        res.status(500).json({ error: 'Error interno del servidor al guardar datos de ML.' });
    }
});

// Ruta para obtener todos los datos de ML para entrenamiento
router.get('/api/ml-data', async (req, res) => {
    try {
        const allData = await MLData.findAll({
            order: [
                ['timestamp', 'ASC']
            ]
        });
        
        res.status(200).json(allData);
    } catch (error) {
        console.error("Error al obtener datos de ML:", error);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos de ML.' });
    }
});

// Ruta para exportar datos de ML a Excel (ahora solo para uso administrativo)
router.get('/api/exportar-excel', async (req, res) => {
    try {
        const result = await exportarDatosExcel();
        res.status(200).json({ 
            success: true, 
            mensaje: 'Datos exportados exitosamente desde la base de datos', 
            archivo: result.archivo,
            rutaCompleta: result.rutaCompleta,
            totalRegistros: result.totalRegistros
        });
    } catch (error) {
        console.error("Error al exportar datos a Excel:", error);
        res.status(500).json({ error: 'Error interno del servidor al exportar a Excel.' });
    }
});

module.exports = router;

// Función auxiliar para exportar datos a CSV (usada automáticamente)
async function exportarDatosExcel() {
    try {
        // Obtenemos los datos de la base de datos
        const allData = await MLData.findAll({
            order: [['createdAt', 'ASC']]
        });
        
        if (allData.length === 0) {
            throw new Error('No hay datos para exportar');
        }
        
        // Convertimos los datos del modelo a objetos planos
        const datos = allData.map(record => record.get({ plain: true }));
        
        // Crear el contenido CSV
        const fs = require('fs');
        
        // Obtener las cabeceras (nombres de las columnas)
        const columnas = Object.keys(datos[0]);
        
        // Crear la primera línea con los nombres de las columnas
        let csvContent = columnas.join(',') + '\n';
        
        // Añadir filas de datos
        datos.forEach(fila => {
            const valores = columnas.map(col => {
                // Escapar comillas en cadenas de texto y envolver en comillas si contiene comas
                if (typeof fila[col] === 'string') {
                    const valor = fila[col].replace(/"/g, '""');
                    return valor.includes(',') ? `"${valor}"` : valor;
                }
                return fila[col];
            });
            csvContent += valores.join(',') + '\n';
        });
        
        // Guardar el archivo en la raíz del proyecto con nombre fijo
        const path = require('path');
        const directorioRaiz = path.join(__dirname, '../../');
        const nombreArchivo = 'datos_whacamole.csv'; // Ahora es CSV
        const rutaArchivo = path.join(directorioRaiz, nombreArchivo);
        
        // Guardar el archivo
        fs.writeFileSync(rutaArchivo, csvContent);
        
        console.log(`Archivo CSV exportado exitosamente: ${rutaArchivo}`);
        
        return {
            success: true,
            archivo: nombreArchivo,
            rutaCompleta: rutaArchivo,
            totalRegistros: datos.length
        };
    } catch (error) {
        console.error("Error al exportar datos a CSV:", error);
        throw error;
    }
}