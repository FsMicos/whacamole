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
    let score, moleInterval, totalMoles, successfulHits, reactionTimes, molePosition, consecutiveMisses, missedMoles, consecutiveHits, moleStartTime;
    let timerId = null;
    let moleTimerId = null;
    let gameInProgress = false;
    let juegoPausado = false;

    let currentDifficulty = 'Normal';

    const ageDifficultyConfig = {
        '3-5': {
            name: 'Muy Fácil',
            moleInterval: 4500,
            minInterval: 3000,
            maxInterval: 6000,
            adaptationRate: 0.15
        },
        '6-10': {
            name: 'Fácil',
            moleInterval: 3000,
            minInterval: 2000,
            maxInterval: 4500,
            adaptationRate: 0.25
        },
        '11+': {
            name: 'Normal',
            moleInterval: 2000,
            minInterval: 800,
            maxInterval: 3500,
            adaptationRate: 0.35
        }
    };

    function getAgeGroup(age) {
        if (age >= 3 && age <= 5) return '3-5';
        if (age >= 6 && age <= 10) return '6-10';
        return '11+';
    }

    function setupBaseDifficulty(age) {
        const group = getAgeGroup(age);
        const config = ageDifficultyConfig[group];
        moleInterval = config.moleInterval;
        currentDifficulty = config.name;
        console.log(`🎯 Dificultad inicial: ${currentDifficulty} (${group})`);
    }


    // --- INTENTAR CARGAR DATOS DEL JUGADOR (SIN VALIDACIÓN ESTRICTA) ---
    let playerData = null;

    try {
        const savedPlayerData = sessionStorage.getItem('playerData');
        if (savedPlayerData) {
            playerData = JSON.parse(savedPlayerData);
            console.log('Datos del jugador cargados:', playerData);
        }
    } catch (error) {
        console.log('Error al cargar datos del jugador:', error);
    }

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

        // Si tenemos datos del jugador, usarlos automáticamente
        if (playerData && playerData.name && playerData.age) {
            console.log('Usando datos del jugador registrado:', playerData);
            const gameData = {
                nickname: playerData.name,
                score: score,
                successfulHits: successfulHits,
                missedMoles: missedMoles,
                successRate: tasaFinal,
                avgReactionTime: promedioReaccion,
                playerAge: playerData.age
            };

            // Guardar directamente sin mostrar formulario
            saveScoreToServer(gameData);
            return;
        }

        // Si no hay datos del jugador, mostrar formulario como antes
        console.log('No hay datos del jugador, mostrando formulario de guardado');
        const overlay = document.getElementById('save-score-overlay');
        if (overlay) {
            overlay.style.display = 'flex';

            const saveButton = document.getElementById('save-score-button');
            const nicknameInput = document.getElementById('nickname-input');

            if (saveButton && nicknameInput) {
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
            }
        } else {
            // Si no existe el overlay, ir directo a la pantalla final
            console.log('No se encontró el overlay de guardado, mostrando pantalla final');
            showGameOverScreen();
        }
    }

    // los datos adquiridos los guarda en el servidor (database)
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

            // Mostrar la pantalla de final de partida en lugar del alert
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
        const finalPointsEl = document.getElementById('final-points');
        const finalHitsEl = document.getElementById('final-hits');
        const finalMissesEl = document.getElementById('final-misses');

        if (finalPointsEl) finalPointsEl.textContent = score;
        if (finalHitsEl) finalHitsEl.textContent = successfulHits;
        if (finalMissesEl) finalMissesEl.textContent = missedMoles;

        // Mostrar el overlay
        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) {
            gameOverOverlay.style.display = 'flex';
        }
    }

    // --- FUNCIONES DE PAUSA / REANUDAR (LÓGICA SIMPLIFICADA) ---
    function pausarJuego() {
        if (!gameInProgress || juegoPausado) return;
        juegoPausado = true;

        clearInterval(timerId);
        clearInterval(moleTimerId);
        backgroundMusic.pause();

        const pausedOverlay = document.getElementById("paused-overlay");
        if (pausedOverlay) {
            pausedOverlay.style.display = "flex";
        }
    }

    function reanudarJuego() {
        if (!juegoPausado) return;
        juegoPausado = false;

        backgroundMusic.play().catch(() => { });
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000); // Reanuda el contador principal

        const pausedOverlay = document.getElementById("paused-overlay");
        if (pausedOverlay) {
            pausedOverlay.style.display = "none";
        }
    }

    function reiniciarJuego() {
        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);
        backgroundMusic.pause();

        const pausedOverlay = document.getElementById("paused-overlay");
        if (pausedOverlay) {
            pausedOverlay.style.display = "none";
        }
        startGame(); // Reinicia el juego desde cero
    }

    function volverAlInicio() {
        window.location.href = '/'; // O la ruta correcta a tu index.html
    }

    // --- ASIGNAR EVENTO A BOTONES (CON VERIFICACIÓN DE EXISTENCIA) ---
    const pauseButton = document.querySelector(".pause-button");
    const resumeButton = document.querySelector(".resume-button");
    const restartButton = document.querySelector(".restart-button");
    const returnButton = document.querySelector(".return-button");

    if (pauseButton) pauseButton.addEventListener("click", pausarJuego);
    if (resumeButton) resumeButton.addEventListener("click", reanudarJuego);
    if (restartButton) restartButton.addEventListener("click", reiniciarJuego);
    if (returnButton) returnButton.addEventListener("click", volverAlInicio);

    // Botones de la pantalla de final de partida
    const gameOverRestartButton = document.querySelector(".game-over-restart-button");
    const gameOverHomeButton = document.querySelector(".game-over-home-button");

    if (gameOverRestartButton) {
        gameOverRestartButton.addEventListener("click", () => {
            const gameOverOverlay = document.getElementById("game-over-overlay");
            if (gameOverOverlay) {
                gameOverOverlay.style.display = "none";
            }
            reiniciarJuego();
        });
    }

    if (gameOverHomeButton) {
        gameOverHomeButton.addEventListener("click", volverAlInicio);
    }

    // --- LÓGICA DEL JUEGO ---
    function randomMole() {
        if (!gameInProgress || juegoPausado) return;

        if (molePosition && molePosition.classList.contains('up')) {
            molePosition.classList.remove('up');
            missedMoles++;
            consecutiveMisses++;
            consecutiveHits = 0;
        }

        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) {
                mole.classList.remove('hit');
            }
        });

        let randomHole = holes[Math.floor(Math.random() * holes.length)];
        randomHole.classList.add('up');

        molePosition = randomHole;
        moleStartTime = Date.now();
        totalMoles++;

        ajustarDificultad();
    }

    holes.forEach(hole => {
        hole.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!gameInProgress || !hole.classList.contains('up') || hole !== molePosition) {
                if (gameInProgress && molePosition && molePosition.classList.contains('up')) {
                    console.log(`❌ Clic fallido - clickeaste el agujero equivocado`);
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

            molePosition = null;
        });
    });

    function ajustarDificultad() {
        if (totalMoles < 3) return;

        const group = getAgeGroup(playerData?.age || 11);
        const config = ageDifficultyConfig[group];
        const tasaAciertos = successfulHits / totalMoles;
        const promedioReaccion = reactionTimes.length > 0
            ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
            : 1000;

        let adjustment = 0;

        if (tasaAciertos >= 0.8 && consecutiveHits >= 4) {
            adjustment = -800;
            currentDifficulty = 'Muy Difícil';
        } else if (tasaAciertos >= 0.7 && promedioReaccion < 600) {
            adjustment = -400;
            currentDifficulty = 'Difícil';
        } else if (tasaAciertos >= 0.5 && promedioReaccion < 1000) {
            adjustment = -200;
            currentDifficulty = 'Normal+';
        } else if (tasaAciertos <= 0.3 || consecutiveMisses >= 5) {
            adjustment = 600;
            currentDifficulty = 'Fácil';
        } else if (promedioReaccion > 1500) {
            adjustment = 800;
            currentDifficulty = 'Muy Fácil';
        }

        adjustment *= config.adaptationRate;
        const nuevoIntervalo = Math.max(config.minInterval, Math.min(config.maxInterval, moleInterval + adjustment));

        if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
            moleInterval = nuevoIntervalo;
            console.log(`🔁 Dificultad ajustada a "${currentDifficulty}" | Intervalo: ${moleInterval}ms`);
            clearInterval(moleTimerId);
            moleTimerId = setInterval(randomMole, moleInterval);
        }
    }

    function startGame() {
        if (gameInProgress && !juegoPausado) return;
        gameInProgress = true;
        juegoPausado = false;

        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(() => { });

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

        const playerData = JSON.parse(sessionStorage.getItem('playerData') || '{}');
        setupBaseDifficulty(playerData.age || 11);

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
    startGame();
});