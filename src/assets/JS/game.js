// src/assets/JS/game.js

document.addEventListener('DOMContentLoaded', () => {
  const holes = document.querySelectorAll('.hole');
  const scoreBoard = document.querySelector('#score');
  const timeLeft = document.querySelector('#time-left');
  let score = 0;
  let currentTime = 60;
  let timerId = null;
  let moleTimerId = null;
  let molePosition = null;
  let gameActive = false;

  // Datos para adaptación
  let totalMoles = 0;
  let successfulHits = 0;
  let reactionTimes = [];
  let moleStartTime = 0;
  let moleInterval = 3000;
  let consecutiveMisses = 0;
  let consecutiveHits = 0;

  // Carga el efecto de sonido
  const hitSound = new Audio('/media/Explosion.mp3');
  hitSound.preload = 'auto';
  hitSound.volume = 0.6;

  // Música de fondo
  const backgroundMusic = new Audio('/media/Kubbi.mp3');
  backgroundMusic.loop = true;
  backgroundMusic.preload = 'auto';
  backgroundMusic.volume = 0.3;

  // 1. Hacer que un topo aparezca aleatoriamente
  function randomMole() {
    if (!gameActive) return;

    // Verificar si hay un topo activo y no fue golpeado
    if (molePosition && molePosition.classList.contains('up')) {
      molePosition.classList.remove('up');
      consecutiveMisses++;
      consecutiveHits = 0;
      console.log(`❌ Fallo! Fallos consecutivos: ${consecutiveMisses}`);
    }

    // Limpiar todos los agujeros
    holes.forEach(hole => {
      hole.classList.remove('up');
      // CORRECCIÓN: Limpiar el estado del topo también
      const mole = hole.querySelector('.mole');
      if (mole) {
        mole.classList.remove('hit');
        mole.classList.add('normal');
      }
    });

    let randomHole = holes[Math.floor(Math.random() * holes.length)];
    randomHole.classList.add('up');

    molePosition = randomHole;
    moleStartTime = Date.now();
    totalMoles++;

    console.log(`🐹 Topo #${totalMoles} apareció. Intervalo: ${moleInterval}ms`);

    ajustarDificultad();
  }

  // 2. Contar los golpes
  holes.forEach(hole => {
    hole.addEventListener('click', (event) => {
      // Prevenir múltiples eventos
      event.preventDefault();
      event.stopPropagation();
      
      if (!gameActive) return;

      // CORRECCIÓN PRINCIPAL: Verificar que el agujero clickeado sea el activo
      if (hole === molePosition && hole.classList.contains('up')) {
        // Inmediatamente marcar como inactivo para evitar doble clic
        hole.classList.remove('up');
        
        score++;
        successfulHits++;
        consecutiveHits++;
        consecutiveMisses = 0;
        scoreBoard.textContent = score;

        const reactionTime = Date.now() - moleStartTime;
        reactionTimes.push(reactionTime);

        console.log(`✅ ¡Acierto! Tiempo: ${reactionTime}ms, Aciertos consecutivos: ${consecutiveHits}`);

        // Reproducir sonido
        hitSound.currentTime = 0;
        hitSound.play().catch(e => console.log('Error reproduciendo sonido:', e));

        const mole = hole.querySelector('.mole');

        if (mole) {
          mole.classList.remove('normal', 'hit');
          // Forzar reflow para asegurar que la clase se aplique
          void mole.offsetWidth;
          mole.classList.add('hit');

          // Limpiar después de la animación
          setTimeout(() => {
            mole.classList.remove('hit');
            mole.classList.add('normal');
          }, 600);
        }

        // Limpiar la posición del topo
        molePosition = null;
        
      } else {
        // CORRECCIÓN: Registrar clics fallidos solo si hay un topo activo
        if (molePosition && molePosition.classList.contains('up')) {
          console.log(`❌ Clic fallido - clickeaste el agujero equivocado`);
        }
      }
    });

    // NUEVA ADICIÓN: Prevenir el evento de contexto (clic derecho)
    hole.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // NUEVA ADICIÓN: Mejorar la respuesta táctil para móviles
    hole.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
  });

  // 3. Ajustar la dificultad
  function ajustarDificultad() {
    if (totalMoles < 1) return;

    const tasaAciertos = successfulHits / totalMoles;
    let nuevoIntervalo = moleInterval;

    if (consecutiveMisses >= 3) {
      nuevoIntervalo = Math.min(5000, moleInterval + 1000);
      console.log(`🚨 3+ fallos consecutivos! Reduciendo velocidad drásticamente a ${nuevoIntervalo}ms`);
    } else if (consecutiveHits >= 8) {
      nuevoIntervalo = Math.max(300, moleInterval - 800);
      console.log(`🔥 8+ aciertos consecutivos! Aumentando velocidad EXTREMA a ${nuevoIntervalo}ms`);
    } else if (consecutiveHits >= 5) {
      nuevoIntervalo = Math.max(400, moleInterval - 600);
      console.log(`🔥 5+ aciertos consecutivos! Aumentando velocidad drásticamente a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos >= 0.8) {
      nuevoIntervalo = Math.max(800, moleInterval - 400);
      console.log(`🚀 Excelente rendimiento! Acelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos >= 0.6) {
      nuevoIntervalo = Math.max(800, moleInterval - 200);
      console.log(`⬆️ Buen rendimiento! Acelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos < 0.3) {
      nuevoIntervalo = Math.min(5000, moleInterval + 600);
      console.log(`⬇️ Rendimiento bajo! Desacelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos < 0.5) {
      nuevoIntervalo = Math.min(5000, moleInterval + 300);
      console.log(`📉 Rendimiento regular! Desacelerando a ${nuevoIntervalo}ms`);
    }

    if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
      moleInterval = nuevoIntervalo;
      console.log(`🔄 CAMBIO APLICADO - Nuevo intervalo: ${moleInterval}ms`);

      if (moleTimerId) {
        clearInterval(moleTimerId);
        moleTimerId = setInterval(randomMole, moleInterval);
      }
    }
    console.log(`📊 Estadísticas: ${successfulHits}/${totalMoles} (${(tasaAciertos * 100).toFixed(1)}%)`);
  }

  // 4. Iniciar el juego
  function startGame() {
    if (gameInProgress) return;

    // Reproducir música al iniciar
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(error => {
      console.warn('La reproducción automática de la música fue bloqueada:', error);
    });

    gameInProgress = true;
    startButton.textContent = '🎯 ¡Jugando! ¡Dale a los topos!';
    startButton.style.background = 'linear-gradient(45deg, #FF8A80, #FFD54F)';
    startButton.disabled = true;
    startButton.style.cursor = 'not-allowed';
    startButton.style.opacity = '0.8';

    if (timerId) clearInterval(timerId);
    if (moleTimerId) clearInterval(moleTimerId);

    gameActive = true;
    score = 0;
    currentTime = 60;
    moleInterval = 3000;
    totalMoles = 0;
    successfulHits = 0;
    reactionTimes = [];
    molePosition = null;
    consecutiveMisses = 0;
    consecutiveHits = 0;

    scoreBoard.textContent = score;
    timeLeft.textContent = currentTime;

    // Limpiar todos los agujeros al inicio
    holes.forEach(hole => {
      hole.classList.remove('up');
      const mole = hole.querySelector('.mole');
      if (mole) {
        mole.classList.remove('hit');
        mole.classList.add('normal');
      }
    });

    console.log("🎮 ¡Juego iniciado! Intervalo inicial: " + moleInterval + "ms");

    // CORRECCIÓN: Esperar un poco antes del primer topo
    setTimeout(() => {
      if (gameActive) {
        randomMole();
        moleTimerId = setInterval(randomMole, moleInterval);
      }
    }, 1000);

    timerId = setInterval(() => {
      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime === 0) {
        // Detener música al finalizar
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;

        gameActive = false;
        clearInterval(timerId);
        clearInterval(moleTimerId);

        holes.forEach(hole => {
          hole.classList.remove('up');
          const mole = hole.querySelector('.mole');
          if (mole) {
            mole.classList.remove('hit');
            mole.classList.add('normal');
          }
        });
        molePosition = null;

        const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
        const promedioReaccion = reactionTimes.length > 0
          ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0)
          : 0;

        console.log("🏁 Juego terminado");

        gameInProgress = false;
        startButton.textContent = buttonOriginalText;
        startButton.style.background = 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1)';
        startButton.disabled = false;
        startButton.style.cursor = 'pointer';
        startButton.style.opacity = '1';

        alert(`¡Juego Terminado! 🎉\n\n🎯 Puntuación: ${score}\n🐹 Topos totales: ${totalMoles}\n✅ Aciertos: ${successfulHits}\n📊 Tasa de éxito: ${tasaFinal}%\n⏱️ Tiempo promedio: ${promedioReaccion}ms\n\n¡Excelente trabajo entrenando tu coordinación! 👏`);
      }
    }, 1000);
  }

  // Botón de inicio con cambio de estado
  const startButton = document.createElement('button');
  startButton.textContent = '🎮 ¡EMPEZAR A JUGAR!';
  let buttonOriginalText = '🎮 ¡EMPEZAR A JUGAR!';
  let gameInProgress = false;
  startButton.style.cssText = `
    margin: 20px;
    padding: 20px 40px;
    font-size: 24px;
    font-weight: bold;
    background: linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1);
    background-size: 200% 200%;
    color: white;
    border: none;
    border-radius: 15px;
    cursor: pointer;
    box-shadow: 0 6px 12px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
    animation: gradientShift 2s ease infinite;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(style);

  startButton.addEventListener('mouseover', () => {
    startButton.style.transform = 'scale(1.1) rotate(-2deg)';
    startButton.style.boxShadow = '0 8px 16px rgba(0,0,0,0.4)';
  });

  startButton.addEventListener('mouseout', () => {
    startButton.style.transform = 'scale(1) rotate(0deg)';
    startButton.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
  });

  document.body.appendChild(startButton);
  startButton.addEventListener('click', startGame);

  holes.forEach(hole => hole.classList.remove('up'));
});