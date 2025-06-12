// src/assets/JS/game.js (renombrado desde ds.js)

document.addEventListener('DOMContentLoaded', () => {
  const holes = document.querySelectorAll('.hole');
  const scoreBoard = document.querySelector('#score');
  const timeLeft = document.querySelector('#time-left');
  let score = 0;
  let currentTime = 60;
  let timerId = null;
  let moleTimerId = null; // Variable declarada correctamente
  let molePosition = null;

  // Datos para adaptación
  let totalMoles = 0;
  let successfulHits = 0;
  let reactionTimes = [];
  let moleStartTime = 0;
  let moleInterval = 800; // Intervalo inicial en ms

  // 1. Hacer que un topo aparezca aleatoriamente
  function randomMole() {
    holes.forEach(hole => hole.classList.remove('up')); // Oculta todos los topos

    let randomHole = holes[Math.floor(Math.random() * holes.length)];
    randomHole.classList.add('up');

    molePosition = randomHole;
    moleStartTime = Date.now(); // Guardar el momento en que apareció el topo
    totalMoles++;
  }

  // 2. Contar los golpes
  holes.forEach(hole => {
    hole.addEventListener('click', () => {
      if (hole === molePosition) {
        score++;
        successfulHits++; // CORREGIDO: Incrementar aciertos exitosos
        scoreBoard.textContent = score;
        const reactionTime = Date.now() - moleStartTime;
        reactionTimes.push(reactionTime);
        molePosition.classList.remove('up'); // Ocultar el topo después de un acierto
        ajustarDificultad(); // Recalcular dificultad después de cada acierto
        molePosition = null; // Limpiar la posición del topo
      }
    });
  });

  // 3. Ajustar la dificultad
  function ajustarDificultad() {
    // Solo ajustar después de al menos 3 topos para tener datos suficientes
    if (totalMoles < 3) return;

    const tasaAciertos = successfulHits / totalMoles;
    const promedioReaccion = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;

    console.log(`Tasa de aciertos: ${tasaAciertos.toFixed(2)}, Promedio reacción: ${promedioReaccion.toFixed(0)}ms, Intervalo actual: ${moleInterval}ms`);

    // Ajuste básico de dificultad
    if (tasaAciertos > 0.7 && promedioReaccion < 1000) {
      // Jugador está bien, aumentar dificultad (reducir intervalo)
      moleInterval = Math.max(300, moleInterval - 50); // Reducir de 50ms en 50ms
      console.log(`Aumentando dificultad. Nuevo intervalo: ${moleInterval}ms`);
    } else if (tasaAciertos < 0.4 || promedioReaccion > 1500) {
      // Jugador tiene dificultades, reducir dificultad (aumentar intervalo)
      moleInterval = Math.min(1200, moleInterval + 50); // Aumentar de 50ms en 50ms
      console.log(`Reduciendo dificultad. Nuevo intervalo: ${moleInterval}ms`);
    }

    // Reiniciar el intervalo con el nuevo valor
    clearInterval(moleTimerId);
    moleTimerId = setInterval(randomMole, moleInterval);
  }

  // 4. Función para limpiar el estado de los topos perdidos
  function handleMissedMole() {
    if (molePosition && molePosition.classList.contains('up')) {
      molePosition.classList.remove('up');
      // No incrementamos successfulHits aquí, solo totalMoles ya se incrementó
      ajustarDificultad(); // Recalcular dificultad después de un fallo
    }
    molePosition = null;
  }

  // 5. Modificar randomMole para manejar topos perdidos
  function randomMoleWithCleanup() {
    // Limpiar topo anterior si no fue golpeado
    handleMissedMole();
    
    // Crear nuevo topo
    randomMole();
  }

  // 6. Iniciar el juego
  function startGame() {
    // Limpiar intervalos anteriores
    if (timerId) clearInterval(timerId);
    if (moleTimerId) clearInterval(moleTimerId);

    // Reiniciar variables
    score = 0;
    currentTime = 60;
    moleInterval = 800; // Empezar lento
    totalMoles = 0;
    successfulHits = 0;
    reactionTimes = [];
    molePosition = null;
    
    // Actualizar UI
    scoreBoard.textContent = score;
    timeLeft.textContent = currentTime;

    // Ocultar todos los topos
    holes.forEach(hole => hole.classList.remove('up'));

    // Iniciar el primer topo
    setTimeout(() => {
      randomMole();
      moleTimerId = setInterval(randomMoleWithCleanup, moleInterval);
    }, 1000); // Dar un segundo antes de empezar

    // Contador de tiempo
    timerId = setInterval(() => {
      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime === 0) {
        clearInterval(timerId);
        clearInterval(moleTimerId);
        
        // Limpiar topos al final
        holes.forEach(hole => hole.classList.remove('up'));
        
        const tasaFinal = totalMoles > 0 ? (successfulHits / totalMoles * 100).toFixed(1) : 0;
        alert(`¡Juego Terminado!\nPuntuación final: ${score}\nTopos totales: ${totalMoles}\nTasa de aciertos: ${tasaFinal}%`);
      }
    }, 1000);
  }

  // (Opcional) Añadir un botón para empezar el juego
  const startButton = document.createElement('button');
  startButton.textContent = '¡Empezar a Jugar!';
  startButton.style.cssText = 'margin: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer;';
  document.body.appendChild(startButton);
  startButton.addEventListener('click', startGame);
});