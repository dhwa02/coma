const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Friend = sequelize.define('Friend', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'friends',
  timestamps: true,
});

User.hasMany(Friend, { foreignKey: 'requesterId', as: 'sentRequests' });
User.hasMany(Friend, { foreignKey: 'receiverId', as: 'receivedRequests' });
Friend.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
Friend.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

module.exports = Friend;
