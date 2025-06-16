document.addEventListener('DOMContentLoaded', () => {

    const gameContainer = document.querySelector('#game-container');
    const holes = document.querySelectorAll('.hole');
    const scoreBoard = document.querySelector('#score');
    const timeLeft = document.querySelector('#time-left');
    const progressFill = document.getElementById('progress-fill');
    const totalTime = 60;

    // Se conecta al mismo host y puerto que el servidor Express (http://localhost:3000)
    const socket = new WebSocket(`ws://${window.location.host}`);

    socket.onopen = () => {
        console.log('✅ Conectado al servidor del juego vía WebSocket. ¡Control físico activado!');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Si el mensaje tiene una propiedad "button", es un golpe del control físico
            if (data.hasOwnProperty('button')) {
                console.log(` Golpe recibido del control físico en el agujero #${data.button}`);
                // Llama a la función principal de golpeo con el índice del botón
                attemptHitOnHole(data.button);
            }
        } catch (e) {
            console.error('Error al procesar el mensaje del control:', e);
        }
    };

    socket.onclose = () => {
        console.warn('❌ Desconectado del servidor WebSocket. El control físico no funcionará.');
    };

    socket.onerror = (error) => {
        console.error('Error en la conexión WebSocket:', error);
    };


    // --- CONFIGURACIÓN DE AUDIO (sin cambios) ---
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

    // Esta función maneja un intento de golpe, ya sea por clic o por botón físico.
    function attemptHitOnHole(holeIndex) {
        const hole = holes[holeIndex];

        // Comprobaciones: ¿el juego está en curso? ¿hay un topo ahí?
        if (!gameInProgress || !hole.classList.contains('up') || hole !== molePosition) {
            // Si fallas, no haces nada (o podrías añadir una penalización aquí)
            return;
        }

        // --- Lógica de un golpe exitoso ---
        hole.classList.remove('up');
        
        const reactionTime = Date.now() - moleStartTime;
        reactionTimes.push(reactionTime);

        const puntosGanados = Math.max(1, Math.round(1000 / reactionTime));
        score += puntosGanados;
        successfulHits++;
        consecutiveHits++;
        consecutiveMisses = 0;
        scoreBoard.textContent = score;

        console.log(`✅ ¡Acierto en agujero #${holeIndex}! Tiempo: ${reactionTime}ms`);

        hitSound.currentTime = 0;
        hitSound.play().catch(e => console.log('Error reproduciendo sonido:', e));

        const mole = hole.querySelector('.mole');
        if (mole) {
            mole.classList.add('hit');
            setTimeout(() => mole.classList.remove('hit'), 600);
        }
        
        molePosition = null; // Marca el topo como golpeado
    }
    
    // --- MODIFICADO: Asignación de clics del ratón ---
    // Ahora, el evento 'click' simplemente llama a nuestra nueva función centralizada.
    holes.forEach((hole, index) => {
        hole.addEventListener('click', () => {
            attemptHitOnHole(index);
        });
    });
  
    function updateTimer() {
        timeLeft.textContent = currentTime;
        const progressPercent = (currentTime / totalTime) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

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

    function showSaveScoreForm() {
        const tasaFinal = totalMoles > 0 ? parseFloat((successfulHits / totalMoles * 100).toFixed(1)) : 0;
        const promedioReaccion = reactionTimes.length > 0 ? parseInt((reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0)) : 0;
        const overlay = document.getElementById('save-score-overlay');
        overlay.style.display = 'flex';
        const saveButton = document.getElementById('save-score-button');
        const nicknameInput = document.getElementById('nickname-input');
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
                saveScoreToServer(gameData);
                overlay.style.display = 'none';
            } else {
                alert('¡Tu nick debe tener exactamente 4 caracteres!');
            }
        };
    }

    async function saveScoreToServer(data) {
        try {
            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
            const result = await response.json();
            console.log('Puntuación guardada:', result);
            alert(`¡Puntuación guardada para ${data.nickname}!\n\n🎯 Puntuación: ${data.score}\n🔥 Aciertos: ${data.successfulHits}\n💀 Fallos: ${data.missedMoles}`);
            volverAlInicio();
        } catch (error) {
            console.error('Error al enviar la puntuación:', error);
            alert('No se pudo guardar la puntuación. Revisa la consola del servidor.');
            volverAlInicio();
        }
    }   

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
        timerId = setInterval(gameTick, 1000);
        document.getElementById("paused-overlay").style.display = "none";
    }

    function reiniciarJuego() {
        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);
        backgroundMusic.pause();
        document.getElementById("paused-overlay").style.display = "none";
        startGame();
    }

    function volverAlInicio() {
        window.location.href = '/';
    }

    document.querySelector(".pause-button").addEventListener("click", pausarJuego);
    document.querySelector(".resume-button").addEventListener("click", reanudarJuego);
    document.querySelector(".restart-button").addEventListener("click", reiniciarJuego);
    document.querySelector(".return-button").addEventListener("click", volverAlInicio);

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

    function ajustarDificultad() {
        if (totalMoles < 1) return;
        const tasaAciertos = successfulHits / totalMoles;
        let nuevoIntervalo = moleInterval;
        if (consecutiveHits >= 5) {
            nuevoIntervalo = Math.max(400, moleInterval - 600);
        } else if (tasaAciertos >= 0.7) {
            nuevoIntervalo = Math.max(800, moleInterval - 300);
        } else if (tasaAciertos < 0.4) {
            nuevoIntervalo = Math.min(4000, moleInterval + 500);
        }
        if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
            moleInterval = nuevoIntervalo;
            clearInterval(moleTimerId);
            moleTimerId = setInterval(randomMole, moleInterval);
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
        scoreBoard.textContent = score;
        updateTimer();
        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) mole.classList.remove('hit');
        });
        randomMole();
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000);
    }git checkout -b Controles_Botones
    
    startGame();
});
