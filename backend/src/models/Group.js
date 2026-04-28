const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  goal: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '기간 내 목표 지출 한도 (원)',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  categories: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '챌린지 대상 카테고리 배열 (NULL = 전체)',
  },
}, {
  tableName: 'groups',
  timestamps: true,
});

User.hasMany(Group, { foreignKey: 'ownerId', as: 'ownedGroups' });
Group.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

module.exports = Group;
