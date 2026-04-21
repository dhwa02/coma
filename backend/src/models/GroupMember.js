const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Group = require('./Group');
const User = require('./User');

const GroupMember = sequelize.define('GroupMember', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('owner', 'member'),
    allowNull: false,
    defaultValue: 'member',
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'group_members',
  timestamps: true,
});

Group.hasMany(GroupMember, { foreignKey: 'groupId', as: 'members' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });
GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = GroupMember;
