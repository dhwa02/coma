const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const DutchPay = sequelize.define('DutchPay', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  totalAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  participantCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  memo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  // 대표 지출자 기능
  isUserPayer: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  linkedTransactionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'dutch_pays',
  timestamps: true,
});

User.hasMany(DutchPay, { foreignKey: 'userId' });
DutchPay.belongsTo(User, { foreignKey: 'userId' });

module.exports = DutchPay;
