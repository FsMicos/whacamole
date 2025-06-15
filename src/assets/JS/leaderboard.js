
document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('leaderboard-body');

    // Función para obtener los récords desde nuestra API
    async function fetchScores() {
        try {
            // Hacemos la petición a la ruta GET que creamos en el backend
            const response = await fetch('/api/scores');
            
            if (!response.ok) {
                throw new Error('No se pudo conectar con el servidor de récords.');
            }

            const scores = await response.json();
            populateTable(scores);

        } catch (error) {
            console.error("Error al cargar los récords:", error);
            tableBody.innerHTML = `<tr><td colspan="5">No se pudieron cargar los récords. Intenta de nuevo más tarde.</td></tr>`;
        }
    }

    // Función para rellenar la tabla con los datos
    function populateTable(scores) {
        // Limpiamos cualquier contenido previo
        tableBody.innerHTML = '';

        if (scores.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5">Aún no hay récords. ¡Sé el primero!</td></tr>`;
            return;
        }

        scores.forEach((record, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${record.nickname}</td>
                <td>${record.score}</td>
                <td>${record.successfulHits}</td>
                <td>${record.missedMoles}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Llamamos a la función principal al cargar la página
    fetchScores();
});