const { Sequelize } = require('sequelize');

// Crear una instancia de Sequelize para la conexión a MySQL
const sequelize = new Sequelize('whacamole', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});

module.exports = sequelize;