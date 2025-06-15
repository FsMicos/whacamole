document.addEventListener('DOMContentLoaded', () => {
  const gameContainer = document.querySelector('#game-container');
  const holes = document.querySelectorAll('.hole');
  const scoreBoard = document.querySelector('#score');
  const timeLeft = document.querySelector('#time-left');
  

  // --- AUDIO ---
  const hitSound = new Audio('/media/Explosion.mp3');
  hitSound.preload = 'auto';
  hitSound.volume = 0.6;

  const backgroundMusic = new Audio('/media/Kubbi.mp3');
  backgroundMusic.loop = true;
  backgroundMusic.preload = 'auto';
  backgroundMusic.volume = 0.3;

  // --- VARIABLES DE ESTADO DEL JUEGO ---
  let score, currentTime, moleInterval, totalMoles, successfulHits, reactionTimes, molePosition, consecutiveMisses, consecutiveHits, moleStartTime;
  let timerId = null;
  let moleTimerId = null;
  let gameInProgress = false;
  let juegoPausado = false;
  let tiempoInicio = null;
  let tiempoAcumulado = 0;

  // --- FUNCIONES DE PAUSA / REANUDAR ---
  function pausarJuego() {
    if (!gameInProgress || juegoPausado) return;
    juegoPausado = true;
    tiempoAcumulado = new Date() - tiempoInicio;

    clearInterval(timerId);
    clearInterval(moleTimerId);
    backgroundMusic.pause();

    const alertOverlay = document.getElementById("paused-overlay");
    alertOverlay.style.display = "flex";
  }
    function reiniciarJuego() {
    if (timerId) clearInterval(timerId);
    if (moleTimerId) clearInterval(moleTimerId);
    backgroundMusic.pause();

    // Reinicia variables y estado visual
    gameInProgress = false;
    juegoPausado = false;
    document.getElementById("paused-overlay").style.display = "none";

    startGame(); // Reinicia el juego desde cero
  }

  function volverAlInicio() {
    window.location.href = '/'; // O la ruta correcta a tu index.html
  }

  function reanudarJuego() {
    if (!juegoPausado) return;
    juegoPausado = false;

    tiempoInicio = new Date() - tiempoAcumulado;
    tiempoInicio = new Date(tiempoInicio);

    moleTimerId = setInterval(randomMole, moleInterval);
    timerId = setInterval(() => {
      if (juegoPausado) return;

      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime <= 0) {
        clearInterval(timerId);
        clearInterval(moleTimerId);
        backgroundMusic.pause();
        gameInProgress = false;

        const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
        const promedioReaccion = reactionTimes.length > 0 ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0) : 0;

        alert(`¡Juego Terminado! 🎉\n\n🎯 Puntuación: ${score}\n📊 Tasa de éxito: ${tasaFinal}%\n⏱️ Tiempo promedio: ${promedioReaccion}ms`);
        window.location.href = '/';
      }
    }, 1000);

    backgroundMusic.play().catch(() => {});
    const alertOverlay = document.getElementById("paused-overlay");
    alertOverlay.style.display = "none";
  }

  // --- ASIGNAR EVENTO A BOTONES XD---
  document.querySelector(".pause-button").addEventListener("click", pausarJuego);
  document.querySelector(".resume-button").addEventListener("click", reanudarJuego);
  document.querySelector(".restart-button").addEventListener("click", reiniciarJuego);
  document.querySelector(".return-button").addEventListener("click", volverAlInicio);

  // --- LÓGICA DEL JUEGO ---
  function randomMole() {
    if (!gameInProgress || juegoPausado) return;

    if (molePosition && molePosition.classList.contains('up')) {
      molePosition.classList.remove('up');
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
      
      score++;
      successfulHits++;
      consecutiveHits++;
      consecutiveMisses = 0;
      scoreBoard.textContent = score;

      const reactionTime = Date.now() - moleStartTime;
      reactionTimes.push(reactionTime);

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
      console.log(`� 5+ aciertos consecutivos! Aumentando velocidad a ${nuevoIntervalo}ms`);
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
    if (gameInProgress) return;
    gameInProgress = true;

    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(() => {});

    if (timerId) clearInterval(timerId);
    if (moleTimerId) clearInterval(moleTimerId);

    score = 0;
    currentTime = 60;
    moleInterval = 3000;
    totalMoles = 0;
    successfulHits = 0;
    reactionTimes = [];
    molePosition = null;
    consecutiveMisses = 0;
    consecutiveHits = 0;
    tiempoAcumulado = 0;
    tiempoInicio = new Date();

    scoreBoard.textContent = score;
    timeLeft.textContent = currentTime;

    holes.forEach(hole => {
      hole.classList.remove('up');
      const mole = hole.querySelector('.mole');
      if (mole) mole.classList.remove('hit');
    });

    setTimeout(() => {
      randomMole();
      moleTimerId = setInterval(randomMole, moleInterval);
    }, 500);

    timerId = setInterval(() => {
      if (juegoPausado) return;

      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime <= 0) {
        clearInterval(timerId);
        clearInterval(moleTimerId);
        backgroundMusic.pause();
        gameInProgress = false;

        const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
        const promedioReaccion = reactionTimes.length > 0 ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0) : 0;

        alert(`¡Juego Terminado! 🎉\n\n🎯 Puntuación: ${score}\n📊 Tasa de éxito: ${tasaFinal}%\n⏱️ Tiempo promedio: ${promedioReaccion}ms`);
        window.location.href = '/';
      }
    }, 1000);
  }

  startGame();
});