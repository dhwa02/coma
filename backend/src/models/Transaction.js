const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('income', 'expense'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
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
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '카드 결제',
  },
  excludedGroupIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: '챌린지에서 제외된 그룹 ID 배열 (NULL = 전체 포함)',
  },
}, {
  tableName: 'transactions',
  timestamps: true,
});

User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

module.exports = Transaction;
