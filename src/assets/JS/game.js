// src/assets/JS/game.js (renombrado desde ds.js)

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
  let moleInterval = 3000; // Intervalo inicial MUY LENTO (3 segundos)
  let consecutiveMisses = 0; // Contador de fallos consecutivos
  let consecutiveHits = 0; // Contador de aciertos consecutivos

  // 1. Hacer que un topo aparezca aleatoriamente
  function randomMole() {
    if (!gameActive) return; // Solo funcionar si el juego está activo

    // Si hay un topo anterior sin golpear, contarlo como fallo
    if (molePosition && molePosition.classList.contains('up')) {
      molePosition.classList.remove('up');
      consecutiveMisses++;
      consecutiveHits = 0; // Reiniciar contador de aciertos
      console.log(`❌ Fallo! Fallos consecutivos: ${consecutiveMisses}`);
    }

    holes.forEach(hole => hole.classList.remove('up')); // Oculta todos los topos

    let randomHole = holes[Math.floor(Math.random() * holes.length)];
    randomHole.classList.add('up');

    molePosition = randomHole;
    moleStartTime = Date.now();
    totalMoles++;

    console.log(`🐹 Topo #${totalMoles} apareció. Intervalo: ${moleInterval}ms`);
    
    // Recalcular dificultad cada vez que aparece un topo
    ajustarDificultad();
  }

  // 2. Contar los golpes
  holes.forEach(hole => {
    hole.addEventListener('click', () => {
      if (!gameActive) return; // Solo funcionar si el juego está activo
      
      if (hole === molePosition && hole.classList.contains('up')) {
        score++;
        successfulHits++;
        consecutiveHits++;
        consecutiveMisses = 0; // Reiniciar contador de fallos
        scoreBoard.textContent = score;
        
        const reactionTime = Date.now() - moleStartTime;
        reactionTimes.push(reactionTime);
        
        console.log(`✅ ¡Acierto! Tiempo: ${reactionTime}ms, Aciertos consecutivos: ${consecutiveHits}`);
        
        molePosition.classList.remove('up');
        molePosition = null;
      }
    });
  });

  // 3. Ajustar la dificultad - CAMBIOS MUY SIGNIFICATIVOS
  function ajustarDificultad() {
    if (totalMoles < 1) return;

    const tasaAciertos = successfulHits / totalMoles;
    let nuevoIntervalo = moleInterval;

    // REGLA CRÍTICA: Fallos consecutivos - bajar MUCHO la velocidad
    if (consecutiveMisses >= 3) {
      nuevoIntervalo = Math.min(5000, moleInterval + 1000); // Aumentar 1 segundo por cada 3 fallos
      console.log(`🚨 3+ fallos consecutivos! Reduciendo velocidad drásticamente a ${nuevoIntervalo}ms`);
    }
    // REGLA CRÍTICA: Muchos aciertos consecutivos - subir MUCHO la velocidad  
    else if (consecutiveHits >= 8) {
      nuevoIntervalo = Math.max(300, moleInterval - 800); // Reducir casi un segundo por cada 8 aciertos
      console.log(`🔥 8+ aciertos consecutivos! Aumentando velocidad EXTREMA a ${nuevoIntervalo}ms`);
    }
    else if (consecutiveHits >= 5) {
      nuevoIntervalo = Math.max(400, moleInterval - 600); // Reducir 600ms por cada 5 aciertos
      console.log(`🔥 5+ aciertos consecutivos! Aumentando velocidad drásticamente a ${nuevoIntervalo}ms`);
    }
    // Ajustes normales pero MUY SIGNIFICATIVOS
    else if (tasaAciertos >= 0.8) {
      // Muy bueno - acelerar MUCHO
      nuevoIntervalo = Math.max(800, moleInterval - 400);
      console.log(`🚀 Excelente rendimiento! Acelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos >= 0.6) {
      // Bien - acelerar bastante
      nuevoIntervalo = Math.max(800, moleInterval - 200);
      console.log(`⬆️ Buen rendimiento! Acelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos < 0.3) {
      // Muy mal - desacelerar MUCHO
      nuevoIntervalo = Math.min(5000, moleInterval + 600);
      console.log(`⬇️ Rendimiento bajo! Desacelerando a ${nuevoIntervalo}ms`);
    } else if (tasaAciertos < 0.5) {
      // Mal - desacelerar bastante
      nuevoIntervalo = Math.min(5000, moleInterval + 300);
      console.log(`📉 Rendimiento regular! Desacelerando a ${nuevoIntervalo}ms`);
    }

    // Aplicar cambio si es significativo
    if (Math.abs(nuevoIntervalo - moleInterval) >= 100) {
      moleInterval = nuevoIntervalo;
      console.log(`🔄 CAMBIO APLICADO - Nuevo intervalo: ${moleInterval}ms`);
      
      // Reiniciar intervalo inmediatamente
      if (moleTimerId) {
        clearInterval(moleTimerId);
        moleTimerId = setInterval(randomMole, moleInterval);
      }
    }

    // Mostrar estadísticas
    console.log(`📊 Estadísticas: ${successfulHits}/${totalMoles} (${(tasaAciertos * 100).toFixed(1)}%)`);
  }

  // 4. Iniciar el juego
  function startGame() {
    // Si el juego ya está en progreso, no hacer nada
    if (gameInProgress) return;

    // Cambiar el botón durante el juego
    gameInProgress = true;
    startButton.textContent = '🎯 ¡Jugando! ¡Dale a los topos!';
    startButton.style.background = 'linear-gradient(45deg, #FF8A80, #FFD54F)';
    startButton.disabled = true;
    startButton.style.cursor = 'not-allowed';
    startButton.style.opacity = '0.8';
    // Limpiar intervalos anteriores
    if (timerId) clearInterval(timerId);
    if (moleTimerId) clearInterval(moleTimerId);

    // Reiniciar TODAS las variables
    gameActive = true;
    score = 0;
    currentTime = 60;
    moleInterval = 3000; // EMPEZAR MUY LENTO (3 segundos)
    totalMoles = 0;
    successfulHits = 0;
    reactionTimes = [];
    molePosition = null;
    consecutiveMisses = 0;
    consecutiveHits = 0;
    
    // Actualizar UI
    scoreBoard.textContent = score;
    timeLeft.textContent = currentTime;

    // IMPORTANTE: Ocultar TODOS los topos al inicio
    holes.forEach(hole => hole.classList.remove('up'));

    console.log("🎮 ¡Juego iniciado! Intervalo inicial: " + moleInterval + "ms (MUY LENTO para niños)");

    // Iniciar los topos INMEDIATAMENTE cuando se presiona el botón
    randomMole(); // Primer topo
    moleTimerId = setInterval(randomMole, moleInterval);

    // Contador de tiempo
    timerId = setInterval(() => {
      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime === 0) {
        // TERMINAR EL JUEGO
        gameActive = false;
        clearInterval(timerId);
        clearInterval(moleTimerId);
        
        // IMPORTANTE: Ocultar TODOS los topos al final
        holes.forEach(hole => hole.classList.remove('up'));
        molePosition = null;
        
        const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
        const promedioReaccion = reactionTimes.length > 0 
          ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0)
          : 0;
        
        console.log("🏁 Juego terminado");
        
        // Restaurar el botón al estado original
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
  
  // Agregar animación CSS
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

  // Asegurar que no hay topos al cargar la página
  holes.forEach(hole => hole.classList.remove('up'));
});