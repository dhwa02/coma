const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  message: { type: DataTypes.STRING, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  referenceId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;
