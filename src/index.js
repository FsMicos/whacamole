const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./database'); // Tu conexión a la DB
const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'assets')));
const gameRoutes = require('./routes/gameRoutes');
app.use('/', gameRoutes);
// El servidor SOLO se inicia DESPUÉS de conectar a la base de datos.
sequelize.sync()
    .then(() => {
        console.log('Base de datos y tablas sincronizadas correctamente.');
        
        // El app.listen() va DENTRO del .then()
        app.listen(PORT, () => {
            console.log(`¡Servidor corriendo en http://localhost:${PORT}!`);
        });
    })
    .catch(error => {
        console.error('Error: No se pudo conectar a la base de datos:', error);
    });