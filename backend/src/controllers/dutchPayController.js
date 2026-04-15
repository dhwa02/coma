const DutchPay = require('../models/DutchPay');
const DutchPayParticipant = require('../models/DutchPayParticipant');
const Transaction = require('../models/Transaction');

// GET /api/dutch-pays
exports.getDutchPays = async (req, res) => {
  const userId = req.user.id;
  try {
    const dutchPays = await DutchPay.findAll({
      where: { userId },
      include: [{ model: DutchPayParticipant, as: 'participants', order: [['createdAt', 'ASC']] }],
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
  const { title, totalAmount, participants, memo, date, isUserPayer, payerIndex, category } = req.body;

  if (!title || !totalAmount || !participants || participants.length < 2 || !date) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  const count = participants.length;
  const amountPerPerson = Math.ceil(totalAmount / count);
  const userIsActualPayer = isUserPayer === true;
  const resolvedPayerIndex = userIsActualPayer ? (Number(payerIndex) || 0) : -1;

  try {
    // 대표 지출자가 본인일 때 거래 내역 자동 생성
    let linkedTransactionId = null;
    if (userIsActualPayer) {
      const transaction = await Transaction.create({
        userId,
        type: 'expense',
        amount: Number(totalAmount),
        category: category || '기타',
        memo: title,
        date,
        paymentMethod: '더치페이',
      });
      linkedTransactionId = transaction.id;
    }

    const dutchPay = await DutchPay.create({
      userId,
      title,
      totalAmount: Number(totalAmount),
      participantCount: count,
      memo: memo || null,
      date,
      isUserPayer: userIsActualPayer,
      linkedTransactionId,
      category: category || null,
    });

    const participantRecords = participants.map((name, i) => ({
      dutchPayId: dutchPay.id,
      name,
      amountOwed: amountPerPerson,
      isPaid: false,
      isPayer: i === resolvedPayerIndex,
    }));

    await DutchPayParticipant.bulkCreate(participantRecords);

    const result = await DutchPay.findOne({
      where: { id: dutchPay.id },
      include: [{ model: DutchPayParticipant, as: 'participants' }],
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

    // 연결된 거래 내역도 함께 삭제
    if (dutchPay.linkedTransactionId) {
      await Transaction.destroy({ where: { id: dutchPay.linkedTransactionId, userId } });
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
    const dutchPay = await DutchPay.findOne({ where: { id, userId } });
    if (!dutchPay) return res.status(404).json({ message: '더치페이를 찾을 수 없습니다.' });

    const participant = await DutchPayParticipant.findOne({ where: { id: participantId, dutchPayId: id } });
    if (!participant) return res.status(404).json({ message: '참여자를 찾을 수 없습니다.' });

    // 대표 지출자 본인 슬롯은 입금 확인 불가
    if (participant.isPayer) {
      return res.status(400).json({ message: '본인 슬롯은 입금 확인을 변경할 수 없습니다.' });
    }

    const newPaid = !participant.isPaid;
    await participant.update({
      isPaid: newPaid,
      paidAt: newPaid ? new Date() : null,
    });

    // 연결된 거래 내역 금액 업데이트 (participant 업데이트 후 재조회)
    if (dutchPay.isUserPayer && dutchPay.linkedTransactionId) {
      const allParticipants = await DutchPayParticipant.findAll({ where: { dutchPayId: id } });
      const paidByOthers = allParticipants
        .filter(p => p.isPaid && !p.isPayer)
        .reduce((sum, p) => sum + p.amountOwed, 0);

      const effectiveAmount = Math.max(dutchPay.totalAmount - paidByOthers, 0);
      await Transaction.update(
        { amount: effectiveAmount },
        { where: { id: dutchPay.linkedTransactionId, userId } }
      );
    }

    res.json(participant);
  } catch (err) {
    console.error('[togglePaid]', err);
    res.status(500).json({ message: '수정 실패' });
  }
};
