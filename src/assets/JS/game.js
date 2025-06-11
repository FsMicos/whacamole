// src/assets/JS/game.js (renombrado desde ds.js)

document.addEventListener('DOMContentLoaded', () => {
  const holes = document.querySelectorAll('.hole');
  const scoreBoard = document.querySelector('#score');
  const timeLeft = document.querySelector('#time-left');
  let score = 0;
  let currentTime = 60;
  let timerId = null;
  let molePosition = null;

  // 1. Hacer que un topo aparezca aleatoriamente
  function randomMole() {
    holes.forEach(hole => hole.classList.remove('up')); // Oculta todos los topos

    let randomHole = holes[Math.floor(Math.random() * holes.length)];
    randomHole.classList.add('up');

    molePosition = randomHole;
  }

  // 2. Contar los golpes
  holes.forEach(hole => {
    hole.addEventListener('click', () => {
      if (hole === molePosition) {
        score++;
        scoreBoard.textContent = score;
        molePosition.classList.remove('up'); // El topo se oculta al ser golpeado
      }
    });
  });

  // 3. Iniciar el juego
  function startGame() {
    score = 0;
    currentTime = 60;
    scoreBoard.textContent = score;
    timeLeft.textContent = currentTime;

    // Mover el topo cada 700ms
    let moleTimerId = setInterval(randomMole, 700);

    // Temporizador del juego
    timerId = setInterval(() => {
      currentTime--;
      timeLeft.textContent = currentTime;

      if (currentTime === 0) {
        clearInterval(timerId);
        clearInterval(moleTimerId);
        alert('¡Juego Terminado! Tu puntuación final es: ' + score);
        molePosition.classList.remove('up');
      }
    }, 1000);
  }

  // (Opcional) Añadir un botón para empezar el juego
  const startButton = document.createElement('button');
  startButton.textContent = '¡Empezar a Jugar!';
  document.body.appendChild(startButton);
  startButton.addEventListener('click', startGame);
});