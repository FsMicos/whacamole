const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./database'); // Tu conexión a la DB

// --- NUEVO: Imports para el control físico ---
const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const PORT = 3000;

// --- Configuración del puerto serial (CAMBIA según tu equipo) ---
const SERIAL_PORT_NAME = 'COM10';

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'assets')));

// --- Rutas ---
const gameRoutes = require('./routes/gameRoutes');
app.use('/', gameRoutes);

// --- Base de datos ---
sequelize.sync()
    .then(() => {
        console.log('Base de datos y tablas sincronizadas correctamente.');

        // Iniciar servidor Express
        const server = app.listen(PORT, () => {
            console.log(`¡Servidor corriendo en http://localhost:${PORT}!`);
            console.log(`Servidor WebSocket listo.`);
        });

        // --- WebSocket Server ---
        const wss = new WebSocketServer({ noServer: true });
        const gameClients = new Set();

        server.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });

        wss.on('connection', (ws) => {
            console.log('Cliente conectado vía WebSocket.');
            gameClients.add(ws);

            ws.on('close', () => {
                console.log('Cliente desconectado.');
                gameClients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('Error en WebSocket:', error);
            });
        });

        // 4. Configurar la lectura del puerto serial del ESP32
        const port = new SerialPort({ path: SERIAL_PORT_NAME, baudRate: 115200 });
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

        console.log(`Intentando leer datos del puerto serial: ${SERIAL_PORT_NAME}...`);

        // 5. Escuchar los datos que llegan del ESP32
        parser.on('data', (data) => {
            console.log(`Dato del control recibido: ${data}`);

            // Retransmitir el dato a TODOS los clientes del juego conectados
            gameClients.forEach(client => {
                if (client.readyState === 1) { // 1 === WebSocket.OPEN
                    client.send(data);
                }
            });
        });

        port.on('error', (err) => {
            console.error('Error en el puerto serial:', err.message);
            console.log('Asegúrate de que el nombre del puerto sea correcto y no esté en uso (cierra el Monitor Serie del IDE).');
        });

    })
    .catch(error => {
        console.error('Error: No se pudo conectar a la base de datos:', error);
    });