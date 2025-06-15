
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Score = sequelize.define('Score', {
    nickname: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [4, 4] // Validar que tenga exactamente 4 caracteres
        }
    },
    score: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    successfulHits: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    missedMoles: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    successRate: {
        type: DataTypes.FLOAT, // Usamos FLOAT para guardar el porcentaje
        allowNull: false
    },
    avgReactionTime: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

module.exports = Score;