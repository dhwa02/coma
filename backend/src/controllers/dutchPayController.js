const { Op } = require('sequelize');
const DutchPay = require('../models/DutchPay');
const DutchPayParticipant = require('../models/DutchPayParticipant');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const PARTICIPANT_INCLUDE = {
  model: DutchPayParticipant,
  as: 'participants',
  include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'profileImage'] }],
};

// GET /api/dutch-pays — 내가 만든 것 + 내가 참여자인 것 모두 반환
exports.getDutchPays = async (req, res) => {
  const userId = req.user.id;
  try {
    const participantRows = await DutchPayParticipant.findAll({
      where: { userId },
      attributes: ['dutchPayId'],
    });
    const participantDutchPayIds = participantRows.map(r => r.dutchPayId);

    const dutchPays = await DutchPay.findAll({
      where: {
        [Op.or]: [
          { userId },
          { id: { [Op.in]: participantDutchPayIds } },
        ],
      },
      include: [PARTICIPANT_INCLUDE],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json(dutchPays);
  } catch (err) {
    console.error('[getDutchPays]', err);
    res.status(500).json({ message: '조회 실패' });
  }
};

// POST /api/dutch-pays
exports.createDutchPay = async (req, res) => {
  const userId = req.user.id;
  const { title, totalAmount, participants, memo, date, payerIndex, category } = req.body;

  if (!title || !totalAmount || !participants || participants.length < 2 || !date) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  const count = participants.length;
  const amountPerPerson = Math.ceil(totalAmount / count);
  const resolvedPayerIdx = payerIndex >= 0 && payerIndex < count ? payerIndex : -1;
  const payerParticipant = resolvedPayerIdx >= 0 ? participants[resolvedPayerIdx] : null;
  const payerUserId = payerParticipant?.userId ?? null;
  const isUserPayer = payerUserId === userId;

  try {
    // 대표 지출자 거래 내역 생성
    let linkedTransactionId = null;
    if (payerUserId) {
      const txn = await Transaction.create({
        userId: payerUserId,
        type: 'expense',
        amount: Number(totalAmount),
        category: category || '기타',
        memo: title,
        date,
        paymentMethod: '더치페이',
      });
      linkedTransactionId = txn.id;
    }

    const dutchPay = await DutchPay.create({
      userId,
      title,
      totalAmount: Number(totalAmount),
      participantCount: count,
      memo: memo || null,
      date,
      isUserPayer,
      linkedTransactionId,
      category: category || null,
    });

    // 참여자 레코드 생성 + 비지불자 중 userId 있는 사람도 거래 내역 생성
    const participantRecords = [];
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const isPayer = i === resolvedPayerIdx;
      const pUserId = typeof p === 'string' ? null : (p.userId ?? null);

      let participantLinkedTxnId = null;
      if (!isPayer && pUserId) {
        const txn = await Transaction.create({
          userId: pUserId,
          type: 'expense',
          amount: amountPerPerson,
          category: category || '기타',
          memo: title,
          date,
          paymentMethod: '더치페이',
        });
        participantLinkedTxnId = txn.id;
      }

      participantRecords.push({
        dutchPayId: dutchPay.id,
        name: typeof p === 'string' ? p : p.name,
        userId: pUserId,
        amountOwed: amountPerPerson,
        isPaid: false,
        isPayer,
        linkedTransactionId: isPayer ? linkedTransactionId : participantLinkedTxnId,
      });
    }

    await DutchPayParticipant.bulkCreate(participantRecords);

    const result = await DutchPay.findOne({
      where: { id: dutchPay.id },
      include: [PARTICIPANT_INCLUDE],
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[createDutchPay]', err);
    res.status(500).json({ message: '등록 실패' });
  }
};

// DELETE /api/dutch-pays/:id
exports.deleteDutchPay = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const dutchPay = await DutchPay.findOne({ where: { id, userId } });
    if (!dutchPay) return res.status(404).json({ message: '더치페이를 찾을 수 없습니다.' });

    // 참여자 linkedTransactionId 포함 전체 삭제
    const allParticipants = await DutchPayParticipant.findAll({ where: { dutchPayId: id } });
    const linkedTxnIds = allParticipants.map(p => p.linkedTransactionId).filter(Boolean);
    if (linkedTxnIds.length > 0) {
      await Transaction.destroy({ where: { id: { [Op.in]: linkedTxnIds } } });
    }

    await DutchPayParticipant.destroy({ where: { dutchPayId: id } });
    await dutchPay.destroy();
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error('[deleteDutchPay]', err);
    res.status(500).json({ message: '삭제 실패' });
  }
};

// PATCH /api/dutch-pays/:id/participants/:participantId/paid
exports.togglePaid = async (req, res) => {
  const { id, participantId } = req.params;
  const userId = req.user.id;
  try {
    const dutchPay = await DutchPay.findByPk(id);
    if (!dutchPay) return res.status(404).json({ message: '더치페이를 찾을 수 없습니다.' });

    const participant = await DutchPayParticipant.findOne({ where: { id: participantId, dutchPayId: id } });
    if (!participant) return res.status(404).json({ message: '참여자를 찾을 수 없습니다.' });

    // 생성자 또는 해당 슬롯의 본인만 변경 가능
    if (dutchPay.userId !== userId && participant.userId !== userId) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    if (participant.isPayer) {
      return res.status(400).json({ message: '대표 지출자 슬롯은 변경할 수 없습니다.' });
    }

    const newPaid = !participant.isPaid;
    await participant.update({ isPaid: newPaid, paidAt: newPaid ? new Date() : null });

    // 대표 지출자의 거래 내역 금액 업데이트 (정산될수록 실질 지출 감소)
    if (dutchPay.linkedTransactionId) {
      const allParticipants = await DutchPayParticipant.findAll({ where: { dutchPayId: id } });
      const paidByOthers = allParticipants
        .filter(p => p.isPaid && !p.isPayer)
        .reduce((sum, p) => sum + p.amountOwed, 0);
      const effectiveAmount = Math.max(dutchPay.totalAmount - paidByOthers, 0);
      await Transaction.update({ amount: effectiveAmount }, { where: { id: dutchPay.linkedTransactionId } });
    }

    res.json(participant);
  } catch (err) {
    console.error('[togglePaid]', err);
    res.status(500).json({ message: '수정 실패' });
  }
};
