const { DataTypes } = require('sequelize');
const sequelize = require('../database');

// Utilizamos force: true para recrear la tabla con la nueva estructura
const MLData = sequelize.define('MLData', {
    nickname: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [1, 4] // Permitimos entre 1 y 4 caracteres para ser más flexibles
        }
    },
    puntuacion: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    aciertos: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    fallos: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    tasa_exito: {
        type: DataTypes.FLOAT, 
        allowNull: false
    },
    tiempo_reaccion_promedio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    partida_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    // Columnas necesarias para el modelo ML
    agujero_sugerido: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    velocidad_sugerida: {
        type: DataTypes.INTEGER,
        defaultValue: 1500
    },
    // Estadísticas por agujero (8 agujeros)
    aciertos_agujero_0: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_1: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_2: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_3: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_4: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_5: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_6: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    aciertos_agujero_7: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_0: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_1: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_2: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_3: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_4: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_5: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_6: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallos_agujero_7: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_0: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_1: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_2: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_3: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_4: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_5: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_6: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    tiempo_reaccion_agujero_7: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    }
});

module.exports = MLData;
