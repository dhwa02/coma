const { Op } = require('sequelize');
const Transaction = require('../models/Transaction');

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
  const { type, amount, category, memo, date, paymentMethod } = req.body;
  const userId = req.user.id;

  if (!type || !amount || !category || !date) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  try {
    const transaction = await Transaction.create({
      userId,
      type,
      amount: Number(amount),
      category,
      memo: memo || null,
      date,
      paymentMethod: paymentMethod || '카드 결제',
    });
    res.status(201).json(transaction);
  } catch (err) {
    console.error('[createTransaction]', err);
    res.status(500).json({ message: '등록 실패' });
  }
};

// PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { type, amount, category, memo, date, paymentMethod } = req.body;

  try {
    const transaction = await Transaction.findOne({ where: { id, userId } });
    if (!transaction) {
      return res.status(404).json({ message: '거래 내역을 찾을 수 없습니다.' });
    }

    await transaction.update({
      type,
      amount: Number(amount),
      category,
      memo: memo || null,
      date,
      paymentMethod: paymentMethod || '카드 결제',
    });

    res.json(transaction);
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

    await transaction.destroy();
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error('[deleteTransaction]', err);
    res.status(500).json({ message: '삭제 실패' });
  }
};
