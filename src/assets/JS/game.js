document.addEventListener('DOMContentLoaded', () => {

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const gameContainer = document.querySelector('#game-container');
    const holes = document.querySelectorAll('.hole');
    const scoreBoard = document.querySelector('#score');
    const timeLeft = document.querySelector('#time-left'); // Elemento para el número del tiempo
    const progressFill = document.getElementById('progress-fill');
    const totalTime = 60;

    // --- CONFIGURACIÓN DE AUDIO ---
    const hitSound = new Audio('/media/Explosion.mp3');
    hitSound.preload = 'auto';
    hitSound.volume = 0.6;

    const backgroundMusic = new Audio('/media/Kubbi.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.preload = 'auto';
    backgroundMusic.volume = 0.3;
    
    // --- VARIABLES DE ESTADO DEL JUEGO ---
    let currentTime = totalTime;
    let score, moleInterval, totalMoles, successfulHits, reactionTimes, molePosition, consecutiveMisses, missedMoles,consecutiveHits, moleStartTime;
    let timerId = null;
    let moleTimerId = null;
    let gameInProgress = false;
    let juegoPausado = false;
    
    // --- VARIABLES PARA MACHINE LEARNING ---
    let mlData = {
        intentos: [],
        estadisticasAgujeros: Array(8).fill(0).map(() => ({  // 8 agujeros
            aciertos: 0,
            fallos: 0,
            tiemposReaccion: []
        })),
        sesionActual: {
            iniciada: false,
            datosEntrenamiento: []
        }
    };
    let modoML = true;  // Controla si el ML está activo - por defecto activado
    

    // --- FUNCIÓN CENTRALIZADA PARA ACTUALIZAR TIEMPO Y BARRA ---
    function updateTimer() {
        timeLeft.textContent = currentTime;
        const progressPercent = (currentTime / totalTime) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

    // --- FUNCIÓN DEL CICLO PRINCIPAL DEL JUEGO (CADA SEGUNDO) ---
    function gameTick() {
        if (juegoPausado) return;
        currentTime--;
        updateTimer();

        if (currentTime <= 0) {
            clearInterval(timerId);
            clearInterval(moleTimerId);
            backgroundMusic.pause();
            gameInProgress = false;

            
            showSaveScoreForm();
        }
    }
    //guardar 
    function showSaveScoreForm() {
        // Calcula las estadísticas finales una sola vez
        const tasaFinal = totalMoles > 0 ? parseFloat((successfulHits / totalMoles * 100).toFixed(1)) : 0;
        const promedioReaccion = reactionTimes.length > 0 ? parseInt((reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0)) : 0;

        // Muestra el formulario
        const overlay = document.getElementById('save-score-overlay');
        overlay.style.display = 'flex';

        const saveButton = document.getElementById('save-score-button');
        const nicknameInput = document.getElementById('nickname-input');

        // Usamos .onclick para asegurarnos de que solo haya un listener
        saveButton.onclick = () => {
            const nickname = nicknameInput.value.toUpperCase();
            if (nickname.length === 4) {
                const gameData = {
                    nickname: nickname,
                    score: score,
                    successfulHits: successfulHits,
                    missedMoles: missedMoles,
                    successRate: tasaFinal,
                    avgReactionTime: promedioReaccion
                };
                
                // Llama a la función que envía los datos al servidor
                saveScoreToServer(gameData);
                overlay.style.display = 'none'; // Oculta el formulario
            } else {
                alert('¡Tu nick debe tener exactamente 4 caracteres!');
            }
        };
    }    // los datos adquiridos los guarda en el servidor (database)
    async function saveScoreToServer(data) {
        try {
            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('La respuesta del servidor no fue OK');
            }

            const result = await response.json();
            console.log('Puntuación guardada:', result);
            
            // Guardar datos de ML en la base de datos
            if (modoML && mlData.sesionActual.datosEntrenamiento.length > 0) {
                // Guardar en la base de datos
                guardarDatosML(data.nickname);
                console.log("Datos de ML guardados en la base de datos");
            }
            
            // Mostrar la pantalla de final de partida
            showGameOverScreen();

        } catch (error) {
            console.error('Error al enviar la puntuación:', error);
            alert('No se pudo guardar la puntuación. Revisa la consola del servidor.');
            showGameOverScreen(); // Igualmente mostramos la pantalla final
        }
    }

    // Función para mostrar la pantalla final de partida
    function showGameOverScreen() {
        // Actualizar las estadísticas en la pantalla
        document.getElementById('final-points').textContent = score;
        document.getElementById('final-hits').textContent = successfulHits;
        document.getElementById('final-misses').textContent = missedMoles;
        
        // Mostrar el overlay
        const gameOverOverlay = document.getElementById('game-over-overlay');
        gameOverOverlay.style.display = 'flex';
    }


    // --- FUNCIONES DE PAUSA / REANUDAR (LÓGICA SIMPLIFICADA) ---
    function pausarJuego() {
        if (!gameInProgress || juegoPausado) return;
        juegoPausado = true;
        
        clearInterval(timerId);
        clearInterval(moleTimerId);
        backgroundMusic.pause();

        document.getElementById("paused-overlay").style.display = "flex";
    }

    function reanudarJuego() {
        if (!juegoPausado) return;
        juegoPausado = false;

        backgroundMusic.play().catch(() => {});
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000); // Reanuda el contador principal

        document.getElementById("paused-overlay").style.display = "none";
    }

    function reiniciarJuego() {
        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);
        backgroundMusic.pause();

        document.getElementById("paused-overlay").style.display = "none";
        startGame(); // Reinicia el juego desde cero
    }

    function volverAlInicio() {
        window.location.href = '/'; // O la ruta correcta a tu index.html
    }    // --- ASIGNAR EVENTO A BOTONES ---
    document.querySelector(".pause-button").addEventListener("click", pausarJuego);
    document.querySelector(".resume-button").addEventListener("click", reanudarJuego);
    document.querySelector(".restart-button").addEventListener("click", reiniciarJuego);
    document.querySelector(".return-button").addEventListener("click", volverAlInicio);
      // Botones de la pantalla de final de partida
    document.querySelector(".game-over-restart-button").addEventListener("click", () => {
        document.getElementById("game-over-overlay").style.display = "none";
        reiniciarJuego();
    });
    document.querySelector(".game-over-home-button").addEventListener("click", volverAlInicio);
      // --- LÓGICA DEL JUEGO ---    
    function randomMole() {
        if (!gameInProgress || juegoPausado) return;

        if (molePosition && molePosition.classList.contains('up')) {
            molePosition.classList.remove('up');
            missedMoles++;
            consecutiveMisses++;
            consecutiveHits = 0;
            
            // Registrar fallo para ML (el topo desapareció sin ser golpeado)
            if (modoML) {
                const holeIndex = Array.from(holes).indexOf(molePosition);
                mlData.estadisticasAgujeros[holeIndex].fallos++;
                
                mlData.intentos.push({
                    timestamp: Date.now(),
                    holeIndex: holeIndex,
                    resultado: 'fallado',
                    tiempoVisible: Date.now() - moleStartTime,
                    consecutiveHits: consecutiveHits,
                    consecutiveMisses: consecutiveMisses
                });
            }
        }

        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) {
                mole.classList.remove('hit');
            }
        });

        let holeIndex;
        let randomHole;
        let lastHoleIndex = -1;
        
        // Guardamos el índice del agujero anterior si existe
        if (molePosition) {
            lastHoleIndex = Array.from(holes).indexOf(molePosition);
        }
        
        // Usar ML para elegir el agujero si tenemos suficientes datos
        if (modoML && mlData.intentos.length >= 10) {
            // Evitamos repetir el mismo agujero
            do {
                holeIndex = predecirMejorAgujero();
            } while (holeIndex === lastHoleIndex && holes.length > 1);
            
            console.log(`🤖 ML sugiere agujero: ${holeIndex}`);
            randomHole = holes[holeIndex];
        } else {
            // Comportamiento aleatorio mejorado para evitar repeticiones
            do {
                holeIndex = Math.floor(Math.random() * holes.length);
                randomHole = holes[holeIndex];
            } while (holeIndex === lastHoleIndex && holes.length > 1);
        }
        
        randomHole.classList.add('up');
        molePosition = randomHole;
        moleStartTime = Date.now();
        totalMoles++;
        
        // Para aprendizaje, registrar donde apareció el topo
        if (modoML) {
            mlData.sesionActual.datosEntrenamiento.push({
                holeIndex: holeIndex,
                timestamp: Date.now(),
                dificultad_actual: moleInterval,
                puntuacion: score,
                totalTopos: totalMoles,
                aciertos: successfulHits,
                fallos: missedMoles
            });
        }        
        
        ajustarDificultad();
    }
      // Función para predecir el mejor agujero donde poner el topo
    function predecirMejorAgujero() {
        // Simple heurística inicial hasta que tengamos el modelo ML integrado
        // Buscamos el agujero con más fallos (donde el usuario tiene dificultades)
        const fallosPorAgujero = mlData.estadisticasAgujeros.map(est => est.fallos);
        
        // Aumentamos la aleatoriedad (30% elegir punto débil, 70% aleatorio entre todos)
        if (Math.random() < 0.7) {
            return Math.floor(Math.random() * holes.length);
        }
        
        // Encontrar los agujeros con más fallos
        const maxFallos = Math.max(...fallosPorAgujero);
        const candidatos = fallosPorAgujero
            .map((fallos, index) => ({ index, fallos }))
            .filter(item => item.fallos >= maxFallos * 0.6) // 60% del máximo de fallos
            .map(item => item.index);
            
        // Si no hay candidatos claros, elegir cualquier agujero
        if (candidatos.length === 0) {
            return Math.floor(Math.random() * holes.length);
        }
        
        // Elegir uno aleatoriamente entre los candidatos
        return candidatos[Math.floor(Math.random() * candidatos.length)];
    }
    
    holes.forEach(hole => {
        hole.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const currentHoleIndex = Array.from(holes).indexOf(hole);
            
            if (!gameInProgress || !hole.classList.contains('up') || hole !== molePosition) {
                if (gameInProgress && molePosition && molePosition.classList.contains('up')) {
                    console.log(`❌ Clic fallido - clickeaste el agujero equivocado`);
                    
                    // Registrar error para ML
                    if (modoML && molePosition) {
                        const correctHoleIndex = Array.from(holes).indexOf(molePosition);
                        mlData.intentos.push({
                            timestamp: Date.now(),
                            clickedHole: currentHoleIndex,
                            correctHole: correctHoleIndex,
                            resultado: 'error',
                            tiempoReaccion: Date.now() - moleStartTime,
                            consecutiveHits: consecutiveHits,
                            consecutiveMisses: consecutiveMisses
                        });
                    }
                }
                return;
            }
            
            hole.classList.remove('up');
            
            const reactionTime = Date.now() - moleStartTime;
            reactionTimes.push(reactionTime);

            //premiar la reaccion rapida
            const puntosGanados = Math.max(1, Math.round(1000 / reactionTime));
            score += puntosGanados;
            successfulHits++;
            consecutiveHits++;
            consecutiveMisses = 0;
            scoreBoard.textContent = score;
            
            console.log(`✅ ¡Acierto! Tiempo: ${reactionTime}ms, Aciertos consecutivos: ${consecutiveHits}`);

            hitSound.currentTime = 0;
            hitSound.play().catch(e => console.log('Error reproduciendo sonido:', e));

            const mole = hole.querySelector('.mole');
            if (mole) {
                mole.classList.add('hit');
                setTimeout(() => mole.classList.remove('hit'), 600);
            }
            
            // Registrar acierto para ML
            if (modoML) {
                const holeIndex = Array.from(holes).indexOf(hole);
                mlData.estadisticasAgujeros[holeIndex].aciertos++;
                mlData.estadisticasAgujeros[holeIndex].tiemposReaccion.push(reactionTime);
                
                mlData.intentos.push({
                    timestamp: Date.now(),
                    holeIndex: holeIndex,
                    resultado: 'acertado',
                    tiempoReaccion: reactionTime,
                    puntosGanados: puntosGanados,
                    consecutiveHits: consecutiveHits,
                    consecutiveMisses: consecutiveMisses
                });
            }
            
            molePosition = null;
        });
    });
    
    function ajustarDificultad() {
        if (totalMoles < 1) return;

        // Si tenemos suficientes datos de ML, podemos ajustar la dificultad de manera más inteligente
        if (modoML && mlData.intentos.length >= 15) {
            const ultimosIntentos = mlData.intentos.slice(-10);
            const tasaAciertoReciente = ultimosIntentos.filter(i => i.resultado === 'acertado').length / ultimosIntentos.length;
            const tiemposReaccionRecientes = ultimosIntentos
                .filter(i => i.resultado === 'acertado' && i.tiempoReaccion)
                .map(i => i.tiempoReaccion);
            
            const tiempoReaccionPromedio = tiemposReaccionRecientes.length > 0 
                ? tiemposReaccionRecientes.reduce((sum, t) => sum + t, 0) / tiemposReaccionRecientes.length
                : 1000; // valor por defecto
            
            let nuevoIntervalo = moleInterval;
            
            // Ajuste basado en tiempo de reacción y tasa de aciertos
            if (tasaAciertoReciente > 0.8 && tiempoReaccionPromedio < 800) {
                // Usuario rápido y preciso: aumentar dificultad significativamente
                nuevoIntervalo = Math.max(400, moleInterval - 500);
                console.log(`🔥 Usuario experto! Aumentando velocidad a ${nuevoIntervalo}ms`);
            } else if (tasaAciertoReciente > 0.6) {
                // Usuario con buena precisión: aumentar dificultad moderadamente
                nuevoIntervalo = Math.max(600, moleInterval - 300);
                console.log(`🚀 Buen rendimiento! Acelerando a ${nuevoIntervalo}ms`);
            } else if (tasaAciertoReciente < 0.3 || tiempoReaccionPromedio > 1500) {
                // Usuario con dificultades: reducir dificultad
                nuevoIntervalo = Math.min(3500, moleInterval + 500);
                console.log(`📉 Rendimiento bajo! Desacelerando a ${nuevoIntervalo}ms`);
            }
            
            if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
                moleInterval = nuevoIntervalo;
                console.log(`🤖 ML ajustó dificultad - Nuevo intervalo: ${moleInterval}ms`);
                clearInterval(moleTimerId);
                moleTimerId = setInterval(randomMole, moleInterval);
            }
        } else {
            // Algoritmo original si no hay suficientes datos
            const tasaAciertos = successfulHits / totalMoles;
            let nuevoIntervalo = moleInterval;

            if (consecutiveHits >= 3) {
                nuevoIntervalo = Math.max(400, moleInterval - 600);
                console.log(`🔥 3+ aciertos consecutivos! Aumentando velocidad a ${nuevoIntervalo}ms`);
            } else if (tasaAciertos >= 0.7) {
                nuevoIntervalo = Math.max(800, moleInterval - 300);
                console.log(`🚀 Buen rendimiento! Acelerando a ${nuevoIntervalo}ms`);
            } else if (tasaAciertos <= 0.4) {
                nuevoIntervalo = Math.min(4000, moleInterval + 500);
                console.log(`📉 Rendimiento bajo! Desacelerando a ${nuevoIntervalo}ms`);
            }

            if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
                moleInterval = nuevoIntervalo;
                console.log(`🔄 CAMBIO APLICADO - Nuevo intervalo: ${moleInterval}ms`);
                clearInterval(moleTimerId);
                moleTimerId = setInterval(randomMole, moleInterval);
            }
        }
    }    
    function startGame() {
        if (gameInProgress && !juegoPausado) return;
        gameInProgress = true;
        juegoPausado = false;

        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(() => {});

        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);

        // Reinicia todas las variables de estado
        score = 0;
        currentTime = totalTime;
        moleInterval = 3000;
        missedMoles = 0;
        totalMoles = 0;
        successfulHits = 0;
        reactionTimes = [];
        molePosition = null;
        consecutiveMisses = 0;
        consecutiveHits = 0;
        
        // Reiniciar variables de ML
        if (modoML) {
            // Conservamos las estadísticas entre partidas para aprender mejor
            mlData.intentos = [];
            mlData.sesionActual = {
                iniciada: true,
                datosEntrenamiento: []
            };
        }
        
        scoreBoard.textContent = score;
        updateTimer(); // CORREGIDO: Llamada inicial para establecer la UI (texto y barra) correctamente

        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) mole.classList.remove('hit');
        });

        // Inicia los ciclos del juego
        randomMole(); // Muestra el primer topo inmediatamente
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000); // CORREGIDO: Usa la función centralizada
    }
    
    // Inicia el juego cuando la página carga
    startGame();    // Función para guardar datos de ML en la base de datos
    function guardarDatosML(nickname) {
        // Prepara los datos de la partida para guardar
        const datosParaGuardar = [];        // Calculamos el tiempo de reacción promedio de todos los intentos
        const tiemposReaccion = mlData.intentos
            .filter(intento => intento.resultado === 'acertado')
            .map(intento => intento.tiempoReaccion);
        
        const tiempoReaccionPromedio = tiemposReaccion.length > 0
            ? parseInt((tiemposReaccion.reduce((sum, t) => sum + t, 0) / tiemposReaccion.length).toFixed(0))
            : 0;
        
        // Para cada punto de datos de entrenamiento, creamos una fila con todas las estadísticas
        mlData.sesionActual.datosEntrenamiento.forEach((dato, index) => {            // Crear objeto para esta fila
            const fila = {
                timestamp: dato.timestamp,
                tiempo_restante: Math.max(0, totalTime - Math.floor((dato.timestamp - mlData.sesionActual.datosEntrenamiento[0].timestamp) / 1000)),
                puntuacion: dato.puntuacion,
                aciertos: dato.aciertos || successfulHits,
                fallos: dato.fallos || missedMoles,
                tasa_exito: (dato.aciertos || successfulHits) / 
                    ((dato.aciertos || successfulHits) + (dato.fallos || missedMoles) || 1) * 100,
                tiempo_reaccion_promedio: tiempoReaccionPromedio,
                aciertos_consecutivos: mlData.intentos[index]?.consecutiveHits || 0,
                fallos_consecutivos: mlData.intentos[index]?.consecutiveMisses || 0,
                dificultad_actual: dato.dificultad_actual,
                // Asegurar que estas propiedades estén definidas para el modelo ML
                agujero_sugerido: dato.holeIndex !== undefined ? dato.holeIndex : predecirMejorAgujero(),
                velocidad_sugerida: dato.dificultad_actual || moleInterval
            };
            
            // Agregar estadísticas por agujero
            for (let i = 0; i < 8; i++) {
                fila[`aciertos_agujero_${i}`] = mlData.estadisticasAgujeros[i].aciertos || 0;
                fila[`fallos_agujero_${i}`] = mlData.estadisticasAgujeros[i].fallos || 0;
                
                // Tiempo de reacción promedio por agujero
                const tiemposAgujero = mlData.estadisticasAgujeros[i].tiemposReaccion || [];
                fila[`tiempo_reaccion_agujero_${i}`] = tiemposAgujero.length > 0 
                    ? tiemposAgujero.reduce((sum, t) => sum + t, 0) / tiemposAgujero.length 
                    : 0;
            }
            
            datosParaGuardar.push(fila);
        });
        
        // Enviar datos al servidor para guardar en la base de datos
        fetch('/api/ml-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                datos: datosParaGuardar,
                nickname: nickname || document.getElementById('nickname-input').value || 'ANON'
            }),
        })
        .then(response => {
            if (!response.ok) throw new Error('Error al guardar datos de ML');
            return response.json();
        })
        .then(data => {
            console.log('Datos de ML guardados exitosamente:', data);
        })
        .catch(error => {
            console.error('Error guardando datos de ML:', error);
        });
    }
    
    // Función para exportar datos a Excel (desde la base de datos)
    // Esta función se llama cuando el usuario presiona el botón "EXPORTAR DATOS" en la pantalla de fin de partida
    // Exporta TODOS los datos acumulados en la base de datos, no solo de la sesión actual
    function exportarDatosAExcel() {
        console.log("Solicitando exportación de datos a Excel desde la base de datos...");
        
        // Mostrar un indicador de carga
        const statusElement = document.createElement('div');
        statusElement.style.position = 'fixed';
        statusElement.style.top = '50%';
        statusElement.style.left = '50%';
        statusElement.style.transform = 'translate(-50%, -50%)';
        statusElement.style.padding = '15px 30px';
        statusElement.style.background = 'rgba(0,0,0,0.8)';
        statusElement.style.color = 'white';
        statusElement.style.borderRadius = '5px';
        statusElement.style.zIndex = '10000';
        statusElement.textContent = 'Exportando datos a Excel...';
        document.body.appendChild(statusElement);
        
        // Enviar solicitud al servidor para generar el archivo Excel
        fetch('/api/exportar-excel')
            .then(response => {
                if (!response.ok) throw new Error('Error al exportar datos a Excel');
                return response.json();
            })
            .then(data => {
                statusElement.textContent = `¡Datos exportados exitosamente! ${data.totalRegistros} registros guardados.`;
                statusElement.style.background = 'rgba(0,128,0,0.8)';
                
                // Ocultar después de 3 segundos
                setTimeout(() => {
                    document.body.removeChild(statusElement);
                }, 3000);
                
                console.log('Datos exportados a Excel exitosamente:', data);
            })            .catch(error => {
                // Mensaje especial para el error de ExcelJS no instalado
                if (error.message.includes('ExcelJS no está instalado')) {
                    statusElement.textContent = 'Error: ExcelJS no está instalado. Por favor contacte al administrador.';
                } else {
                    statusElement.textContent = `Error: ${error.message}`;
                }
                statusElement.style.background = 'rgba(220,0,0,0.8)';
                
                // Ocultar después de 5 segundos (más tiempo para que lean el error)
                setTimeout(() => {
                    document.body.removeChild(statusElement);
                }, 5000);
                
                console.error('Error exportando datos a Excel:', error);
            });
    }
});