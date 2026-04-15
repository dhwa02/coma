const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const DutchPay = require('./DutchPay');

const DutchPayParticipant = sequelize.define('DutchPayParticipant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dutchPayId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountOwed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 대표 지출자 여부 (본인 참여자 슬롯)
  isPayer: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'dutch_pay_participants',
  timestamps: true,
});

DutchPay.hasMany(DutchPayParticipant, { foreignKey: 'dutchPayId', as: 'participants', onDelete: 'CASCADE' });
DutchPayParticipant.belongsTo(DutchPay, { foreignKey: 'dutchPayId' });

module.exports = DutchPayParticipant;
