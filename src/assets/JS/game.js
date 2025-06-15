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

            const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
            const promedioReaccion = reactionTimes.length > 0 ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0) : 0;

            alert(`¡Juego Terminado! 🎉\n\n🎯 Puntuación: ${score}\n🔥Aciertos ${successfulHits}\n🔥fallas ${missedMoles} \n📊 Tasa de éxito: ${tasaFinal}%\n⏱️ Tiempo promedio: ${promedioReaccion}ms`);
            volverAlInicio();
        }
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
    }

    // --- ASIGNAR EVENTO A BOTONES ---
    document.querySelector(".pause-button").addEventListener("click", pausarJuego);
    document.querySelector(".resume-button").addEventListener("click", reanudarJuego);
    document.querySelector(".restart-button").addEventListener("click", reiniciarJuego);
    document.querySelector(".return-button").addEventListener("click", volverAlInicio);

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
        if (totalMoles < 1) return;

        const tasaAciertos = successfulHits / totalMoles;
        let nuevoIntervalo = moleInterval;

        if (consecutiveHits >= 5) {
            nuevoIntervalo = Math.max(400, moleInterval - 600);
            console.log(`🔥 5+ aciertos consecutivos! Aumentando velocidad a ${nuevoIntervalo}ms`);
        } else if (tasaAciertos >= 0.7) {
            nuevoIntervalo = Math.max(800, moleInterval - 300);
            console.log(`🚀 Buen rendimiento! Acelerando a ${nuevoIntervalo}ms`);
        } else if (tasaAciertos < 0.4) {
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