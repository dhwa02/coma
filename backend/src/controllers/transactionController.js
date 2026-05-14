const { Op } = require('sequelize');
const Transaction = require('../models/Transaction');
const GroupMember = require('../models/GroupMember');
const Group = require('../models/Group');
const { computeGroupRanking } = require('./groupController');
const { createNotification } = require('./notificationController');

// 트랜잭션 변경 전 그룹별 랭킹 스냅샷 수집 (활성 그룹만)
async function captureGroupRankings(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const memberships = await GroupMember.findAll({
    where: { userId, status: 'accepted' },
    include: [{
      model: Group,
      where: { startDate: { [Op.lte]: today }, endDate: { [Op.gte]: today } },
      required: true,
    }],
  });
  const snapshot = new Map();
  for (const m of memberships) {
    snapshot.set(m.groupId, {
      groupName: m.Group.name,
      ranking: await computeGroupRanking(m.groupId),
    });
  }
  return snapshot;
}

// 변경 후 랭킹 계산 → 소켓 emit + 순위 변동 알림
async function emitRankingAndNotify(req, beforeSnapshot) {
  try {
    const io = req.app.locals.io;
    if (!io) return;
    for (const [groupId, { groupName, ranking: before }] of beforeSnapshot) {
      const after = await computeGroupRanking(groupId);
      io.to(`group:${groupId}`).emit('ranking:update', { groupId, members: after });

      for (let newIdx = 0; newIdx < after.length; newIdx++) {
        const member = after[newIdx];
        const oldIdx = before.findIndex(m => m.userId === member.userId);
        if (oldIdx === -1 || oldIdx === newIdx) continue;
        const direction = newIdx < oldIdx ? '올랐습니다' : '내려갔습니다';
        await createNotification(io, {
          userId: member.userId,
          type: 'ranking_change',
          message: `'${groupName}' 챌린지 랭킹이 ${newIdx + 1}위로 ${direction}.`,
          referenceId: groupId,
        });
      }
    }
  } catch (err) {
    console.error('[emitRankingAndNotify]', err);
  }
}

// GET /api/transactions?year=2026&month=4
exports.getTransactions = async (req, res) => {
  const { year, month } = req.query;
  const userId = req.user.id;

  const where = { userId };

  if (year && month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10); // 해당 월 마지막 날
    where.date = { [Op.between]: [start, end] };
  }

  try {
    const transactions = await Transaction.findAll({
      where,
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(transactions);
  } catch (err) {
    console.error('[getTransactions]', err);
    res.status(500).json({ message: '조회 실패' });
  }
};

// POST /api/transactions
exports.createTransaction = async (req, res) => {
  const { type, amount, category, memo, date, paymentMethod, excludedGroupIds } = req.body;
  const userId = req.user.id;

  if (!type || !amount || !category || !date) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  try {
    const snapshot = await captureGroupRankings(userId);
    const transaction = await Transaction.create({
      userId,
      type,
      amount: Number(amount),
      category,
      memo: memo || null,
      date,
      paymentMethod: paymentMethod || '카드 결제',
      excludedGroupIds: Array.isArray(excludedGroupIds) && excludedGroupIds.length > 0 ? excludedGroupIds : null,
    });
    res.status(201).json(transaction);
    emitRankingAndNotify(req, snapshot);
  } catch (err) {
    console.error('[createTransaction]', err);
    res.status(500).json({ message: '등록 실패' });
  }
};

// PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { type, amount, category, memo, date, paymentMethod, excludedGroupIds } = req.body;

  try {
    const transaction = await Transaction.findOne({ where: { id, userId } });
    if (!transaction) {
      return res.status(404).json({ message: '거래 내역을 찾을 수 없습니다.' });
    }

    const snapshot = await captureGroupRankings(userId);
    await transaction.update({
      type,
      amount: Number(amount),
      category,
      memo: memo || null,
      date,
      paymentMethod: paymentMethod || '카드 결제',
      excludedGroupIds: Array.isArray(excludedGroupIds) && excludedGroupIds.length > 0 ? excludedGroupIds : null,
    });

    res.json(transaction);
    emitRankingAndNotify(req, snapshot);
  } catch (err) {
    console.error('[updateTransaction]', err);
    res.status(500).json({ message: '수정 실패' });
  }
};

// DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const transaction = await Transaction.findOne({ where: { id, userId } });
    if (!transaction) {
      return res.status(404).json({ message: '거래 내역을 찾을 수 없습니다.' });
    }

    const snapshot = await captureGroupRankings(userId);
    await transaction.destroy();
    res.json({ message: '삭제 완료' });
    emitRankingAndNotify(req, snapshot);
  } catch (err) {
    console.error('[deleteTransaction]', err);
    res.status(500).json({ message: '삭제 실패' });
  }
};
