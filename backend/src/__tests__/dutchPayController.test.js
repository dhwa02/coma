const mockCommit = jest.fn();
const mockRollback = jest.fn();

jest.mock('../config/db', () => ({
  transaction: jest.fn(async () => ({ commit: mockCommit, rollback: mockRollback })),
}));
jest.mock('../models/DutchPay', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
}));
jest.mock('../models/DutchPayParticipant', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));
jest.mock('../models/Transaction', () => ({
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
}));
jest.mock('../models/User', () => ({}));
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn(),
}));

const DutchPay = require('../models/DutchPay');
const DutchPayParticipant = require('../models/DutchPayParticipant');
const Transaction = require('../models/Transaction');
const {
  getDutchPays,
  createDutchPay,
  deleteDutchPay,
  togglePaid,
} = require('../controllers/dutchPayController');

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 1, nickname: '테스터' },
    body: {},
    params: {},
    app: { locals: { io: null } },
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

const validBody = {
  title: '점심 더치페이',
  totalAmount: 30000,
  participants: [
    { name: '나', userId: 1 },
    { name: '친구', userId: 2 },
  ],
  date: '2026-05-18',
  payerIndex: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCommit.mockReset();
  mockRollback.mockReset();
});

describe('getDutchPays', () => {
  test('D7: 내가 참여자인 더치페이도 조회됨', async () => {
    DutchPayParticipant.findAll.mockResolvedValue([{ dutchPayId: 5 }]);
    DutchPay.findAll.mockResolvedValue([
      { id: 1 }, // 내가 만든 것
      { id: 5 }, // 내가 참여자인 것
    ]);
    const { req, res } = mockReqRes();
    await getDutchPays(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([{ id: 1 }, { id: 5 }]));
  });
});

describe('createDutchPay', () => {
  test('D1: 참여자 1명으로 생성 시도 → 400', async () => {
    const { req, res } = mockReqRes({
      body: { ...validBody, participants: [{ name: '나', userId: 1 }] },
    });
    await createDutchPay(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('D2: 금액 분배는 Math.ceil(totalAmount / count) 적용', async () => {
    Transaction.create.mockResolvedValue({ id: 1 });
    DutchPay.create.mockResolvedValue({ id: 1 });
    DutchPayParticipant.bulkCreate.mockResolvedValue([]);
    DutchPay.findOne.mockResolvedValue({ id: 1, participants: [] });

    const { req, res } = mockReqRes({
      body: { ...validBody, totalAmount: 10000, participants: [
        { name: '나', userId: 1 },
        { name: '친구A', userId: 2 },
        { name: '친구B', userId: 3 },
      ]},
    });
    await createDutchPay(req, res);

    const records = DutchPayParticipant.bulkCreate.mock.calls[0][0];
    // Math.ceil(10000 / 3) = 3334
    expect(records[0].amountOwed).toBe(3334);
  });

  test('D8: 참여자 Transaction 생성 실패 시 rollback 호출', async () => {
    Transaction.create
      .mockResolvedValueOnce({ id: 1 })       // 지출자 트랜잭션 성공
      .mockRejectedValueOnce(new Error('DB 오류')); // 참여자 트랜잭션 실패
    DutchPay.create.mockResolvedValue({ id: 1 });

    const { req, res } = mockReqRes({ body: validBody });
    await createDutchPay(req, res);

    expect(mockRollback).toHaveBeenCalled();
    expect(mockCommit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('togglePaid', () => {
  test('D3: isPayer 슬롯 토글 시도 → 400', async () => {
    DutchPay.findByPk.mockResolvedValue({ id: 1, userId: 1 });
    DutchPayParticipant.findOne.mockResolvedValue({
      id: 10, dutchPayId: 1, isPayer: true, userId: 1,
    });
    const { req, res } = mockReqRes({ params: { id: '1', participantId: '10' } });
    await togglePaid(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('D4: 생성자도 해당 참여자도 아닌 유저 → 403', async () => {
    DutchPay.findByPk.mockResolvedValue({ id: 1, userId: 99 }); // 생성자는 userId 99
    DutchPayParticipant.findOne.mockResolvedValue({
      id: 10, dutchPayId: 1, isPayer: false, userId: 88, // 참여자도 다른 유저
    });
    const { req, res } = mockReqRes({ params: { id: '1', participantId: '10' } }); // req.user.id = 1
    await togglePaid(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('D5: 정산 완료 시 지출자 거래내역 금액 업데이트', async () => {
    DutchPay.findByPk.mockResolvedValue({
      id: 1, userId: 1, totalAmount: 30000, linkedTransactionId: 5,
    });
    DutchPayParticipant.findOne.mockResolvedValue({
      id: 10, dutchPayId: 1, isPayer: false, userId: 1,
      isPaid: false, name: '테스터',
      update: jest.fn().mockResolvedValue(true),
    });
    DutchPayParticipant.findAll.mockResolvedValue([
      { isPaid: true, isPayer: false, amountOwed: 10000 }, // 정산 완료된 참여자
      { isPaid: false, isPayer: false, amountOwed: 10000 },
      { isPaid: false, isPayer: true, amountOwed: 10000 },
    ]);
    // 지출자 알림 없도록 payer 조회 결과 null
    DutchPayParticipant.findOne
      .mockResolvedValueOnce({ // 첫 번째 findOne: 해당 참여자
        id: 10, dutchPayId: 1, isPayer: false, userId: 1,
        isPaid: false, name: '테스터',
        update: jest.fn().mockResolvedValue(true),
      })
      .mockResolvedValueOnce(null); // 두 번째 findOne: 지출자 (null)
    Transaction.update.mockResolvedValue([1]);

    const { req, res } = mockReqRes({ params: { id: '1', participantId: '10' } });
    await togglePaid(req, res);

    // effectiveAmount = 30000 - 10000 = 20000
    expect(Transaction.update).toHaveBeenCalledWith(
      { amount: 20000 },
      expect.objectContaining({ where: { id: 5 } })
    );
  });
});

describe('deleteDutchPay', () => {
  test('D6: 삭제 시 연결된 Transaction도 함께 삭제', async () => {
    DutchPay.findOne.mockResolvedValue({
      id: 1, userId: 1,
      destroy: jest.fn().mockResolvedValue(true),
    });
    DutchPayParticipant.findAll.mockResolvedValue([
      { linkedTransactionId: 10 },
      { linkedTransactionId: 11 },
      { linkedTransactionId: null },
    ]);
    DutchPayParticipant.destroy.mockResolvedValue(2);
    Transaction.destroy.mockResolvedValue(2);

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await deleteDutchPay(req, res);

    expect(Transaction.destroy).toHaveBeenCalled();
    // Op.in은 Symbol이므로 getOwnPropertySymbols로 꺼내서 검증
    const destroyArg = Transaction.destroy.mock.calls[0][0];
    const opKey = Object.getOwnPropertySymbols(destroyArg.where.id)[0];
    const idsArray = destroyArg.where.id[opKey];
    expect(idsArray).toEqual(expect.arrayContaining([10, 11]));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
