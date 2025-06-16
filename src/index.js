const express = require('express');
const path = require('path');
const cors = require('cors');
const sequelize = require('./database'); // Tu conexión a la DB

// --- NUEVO: Imports para el control físico ---
const { WebSocketServer } = require('ws'); // Servidor de WebSockets
const { SerialPort } = require('serialport'); // Para leer el puerto USB
const { ReadlineParser } = require('@serialport/parser-readline'); // Para leer líneas completas

const app = express();
const PORT = 3000;

// --- NUEVO: Configuración del puerto serial ---
// Búscalo en el IDE de Arduino (Herramientas > Puerto) o en el Administrador de dispositivos de tu SO.
// En Windows es 'COM3', 'COM4', etc. En macOS/Linux es '/dev/tty.usbserial-XXXX' o similar.
const SERIAL_PORT_NAME = 'COM4'; // ¡¡¡CAMBIA ESTO POR TU PUERTO!!!
app.use(cors()); 
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'assets')));
const gameRoutes = require('./routes/gameRoutes');
app.use('/', gameRoutes);
sequelize.sync()
    .then(() => {
        console.log('Base de datos y tablas sincronizadas correctamente.');
        
        
        const server = app.listen(PORT, () => {
            console.log(`¡Servidor Express corriendo en http://localhost:${PORT}!`);
            console.log(`Servidor WebSocket escuchando en el mismo puerto.`);
        });

        

        // 1. Crear el servidor de WebSockets (WSS) sin un puerto propio.
        // Se adjuntará al servidor de Express que ya creamos.
        const wss = new WebSocketServer({ noServer: true });
        const gameClients = new Set(); // Almacenará las conexiones del juego (navegadores)

       
        // Cuando un cliente intenta "actualizar" de HTTP a WebSocket, lo manejamos aquí.
        server.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });

        // 3. Definir qué hacer cuando un cliente (el juego) se conecta al WebSocket
        wss.on('connection', (ws) => {
            console.log('Cliente del juego conectado vía WebSocket.');
            gameClients.add(ws);

            ws.on('close', () => {
                console.log('Cliente del juego desconectado.');
                gameClients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('Error en WebSocket del cliente:', error);
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