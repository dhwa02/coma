const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/db');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const Friend = require('../models/Friend');
const Transaction = require('../models/Transaction');

const USER_ATTRS = ['id', 'nickname', 'profileImage'];

// POST /api/groups
exports.createGroup = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, startDate, endDate, goal, inviteeIds = [], categories } = req.body;
    const ownerId = req.user.id;

    if (!name?.trim()) return res.status(400).json({ message: '그룹 이름을 입력해주세요.' });
    if (!startDate || !endDate) return res.status(400).json({ message: '기간을 입력해주세요.' });
    if (startDate > endDate) return res.status(400).json({ message: '종료일이 시작일보다 앞설 수 없습니다.' });

    const categoryValue = Array.isArray(categories) && categories.length > 0 ? categories : null;

    const group = await Group.create(
      { name: name.trim(), ownerId, startDate, endDate, goal: goal || null, categories: categoryValue },
      { transaction: t }
    );

    // 그룹장 멤버로 자동 추가
    await GroupMember.create(
      { groupId: group.id, userId: ownerId, role: 'owner', status: 'accepted' },
      { transaction: t }
    );

    // 초대된 친구들 pending 상태로 추가 (친구 관계 확인)
    if (inviteeIds.length > 0) {
      const friendships = await Friend.findAll({
        where: {
          status: 'accepted',
          [Op.or]: [
            { requesterId: ownerId, receiverId: { [Op.in]: inviteeIds } },
            { receiverId: ownerId, requesterId: { [Op.in]: inviteeIds } },
          ],
        },
      });
      const validIds = new Set(friendships.map(f =>
        f.requesterId === ownerId ? f.receiverId : f.requesterId
      ));

      const invites = [...validIds].map(userId => ({
        groupId: group.id, userId, role: 'member', status: 'pending',
      }));
      if (invites.length > 0) await GroupMember.bulkCreate(invites, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ id: group.id, name: group.name });
  } catch (err) {
    await t.rollback();
    console.error('[createGroup Error]', err);
    res.status(500).json({ message: '그룹 생성 실패' });
  }
};

// GET /api/groups
exports.getMyGroups = async (req, res) => {
  try {
    const memberships = await GroupMember.findAll({
      where: { userId: req.user.id, status: 'accepted' },
      include: [{
        model: Group,
        include: [
          { model: User, as: 'owner', attributes: USER_ATTRS },
          {
            model: GroupMember,
            as: 'members',
            where: { status: 'accepted' },
            include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
            required: false,
          },
        ],
      }],
    });

    const groups = memberships.map(m => ({
      ...m.Group.toJSON(),
      myRole: m.role,
    }));

    res.json(groups);
  } catch (err) {
    console.error('[getMyGroups Error]', err);
    res.status(500).json({ message: '그룹 목록 조회 실패' });
  }
};

// GET /api/groups/invites  (받은 그룹 초대 목록)
exports.getInvites = async (req, res) => {
  try {
    const invites = await GroupMember.findAll({
      where: { userId: req.user.id, status: 'pending' },
      include: [{
        model: Group,
        include: [{ model: User, as: 'owner', attributes: USER_ATTRS }],
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json(invites.map(i => ({
      inviteId: i.id,
      group: i.Group,
    })));
  } catch (err) {
    console.error('[getInvites Error]', err);
    res.status(500).json({ message: '초대 목록 조회 실패' });
  }
};

// GET /api/groups/:id
exports.getGroupDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const group = await Group.findByPk(req.params.id, {
      include: [
        { model: User, as: 'owner', attributes: USER_ATTRS },
        {
          model: GroupMember,
          as: 'members',
          where: { status: 'accepted' },
          include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
          required: false,
        },
      ],
    });

    if (!group) return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });

    const isMember = group.members.some(m => m.userId === userId);
    if (!isMember) return res.status(403).json({ message: '그룹 멤버가 아닙니다.' });

    // 각 멤버의 기간 내 지출 합계 조회 (챌린지 제외 내역 및 카테고리 필터 적용)
    const memberIds = group.members.map(m => m.userId);
    const spendingWhere = {
      userId: { [Op.in]: memberIds },
      type: 'expense',
      date: { [Op.between]: [group.startDate, group.endDate] },
      [Op.and]: [
        literal(`(excludedGroupIds IS NULL OR NOT JSON_CONTAINS(excludedGroupIds, CAST(${group.id} AS JSON)))`),
      ],
    };
    if (group.categories && group.categories.length > 0) {
      spendingWhere.category = { [Op.in]: group.categories };
    }
    const spendingRows = await Transaction.findAll({
      attributes: ['userId', [fn('SUM', col('amount')), 'total']],
      where: spendingWhere,
      group: ['userId'],
      raw: true,
    });

    const spendingMap = {};
    spendingRows.forEach(r => { spendingMap[r.userId] = Number(r.total); });

    const membersWithSpending = group.members.map(m => ({
      memberId: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
      totalExpense: spendingMap[m.userId] ?? 0,
    })).sort((a, b) => a.totalExpense - b.totalExpense);

    res.json({
      ...group.toJSON(),
      members: membersWithSpending,
      myRole: group.members.find(m => m.userId === userId)?.role ?? 'member',
    });
  } catch (err) {
    console.error('[getGroupDetail Error]', err);
    res.status(500).json({ message: '그룹 상세 조회 실패' });
  }
};

// POST /api/groups/:id/invite
exports.inviteMember = async (req, res) => {
  try {
    const { userId: inviteeId } = req.body;
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    if (group.ownerId !== req.user.id) return res.status(403).json({ message: '그룹장만 초대할 수 있습니다.' });

    const already = await GroupMember.findOne({ where: { groupId: group.id, userId: inviteeId } });
    if (already) return res.status(409).json({ message: '이미 초대했거나 멤버입니다.' });

    await GroupMember.create({ groupId: group.id, userId: inviteeId, role: 'member', status: 'pending' });
    res.status(201).json({ message: '초대를 보냈습니다.' });
  } catch (err) {
    console.error('[inviteMember Error]', err);
    res.status(500).json({ message: '초대 실패' });
  }
};

// PATCH /api/groups/invites/:inviteId/accept
exports.acceptInvite = async (req, res) => {
  try {
    const invite = await GroupMember.findByPk(req.params.inviteId);
    if (!invite) return res.status(404).json({ message: '초대를 찾을 수 없습니다.' });
    if (invite.userId !== req.user.id) return res.status(403).json({ message: '권한이 없습니다.' });
    if (invite.status !== 'pending') return res.status(400).json({ message: '처리할 수 없는 초대입니다.' });

    invite.status = 'accepted';
    await invite.save();
    res.json({ message: '그룹에 참여했습니다.' });
  } catch (err) {
    console.error('[acceptInvite Error]', err);
    res.status(500).json({ message: '초대 수락 실패' });
  }
};

// PATCH /api/groups/invites/:inviteId/reject
exports.rejectInvite = async (req, res) => {
  try {
    const invite = await GroupMember.findByPk(req.params.inviteId);
    if (!invite) return res.status(404).json({ message: '초대를 찾을 수 없습니다.' });
    if (invite.userId !== req.user.id) return res.status(403).json({ message: '권한이 없습니다.' });
    if (invite.status !== 'pending') return res.status(400).json({ message: '처리할 수 없는 초대입니다.' });

    await invite.destroy();
    res.json({ message: '초대를 거절했습니다.' });
  } catch (err) {
    console.error('[rejectInvite Error]', err);
    res.status(500).json({ message: '초대 거절 실패' });
  }
};

// DELETE /api/groups/:id/leave
exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    if (group.ownerId === userId) return res.status(400).json({ message: '그룹장은 탈퇴할 수 없습니다. 그룹을 삭제해주세요.' });

    const membership = await GroupMember.findOne({ where: { groupId: group.id, userId } });
    if (!membership) return res.status(404).json({ message: '멤버가 아닙니다.' });

    await membership.destroy();
    res.json({ message: '그룹에서 탈퇴했습니다.' });
  } catch (err) {
    console.error('[leaveGroup Error]', err);
    res.status(500).json({ message: '그룹 탈퇴 실패' });
  }
};

// DELETE /api/groups/:id
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    if (group.ownerId !== req.user.id) return res.status(403).json({ message: '그룹장만 삭제할 수 있습니다.' });

    await GroupMember.destroy({ where: { groupId: group.id } });
    await group.destroy();
    res.json({ message: '그룹이 삭제되었습니다.' });
  } catch (err) {
    console.error('[deleteGroup Error]', err);
    res.status(500).json({ message: '그룹 삭제 실패' });
  }
};
