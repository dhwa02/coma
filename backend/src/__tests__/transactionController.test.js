jest.mock('../models/Transaction', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/GroupMember', () => ({ findAll: jest.fn() }));
jest.mock('../models/Group', () => ({}));
jest.mock('../controllers/groupController', () => ({
  computeGroupRanking: jest.fn().mockResolvedValue([]),
}));
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn(),
}));

const Transaction = require('../models/Transaction');
const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 1, nickname: '테스터' },
    body: {},
    params: {},
    query: {},
    app: { locals: { io: null } },
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  // captureGroupRankings: GroupMember.findAll → 빈 배열 (활성 그룹 없음)
  require('../models/GroupMember').findAll.mockResolvedValue([]);
});

describe('getTransactions', () => {
  test('T1: 년/월 파라미터 제공 시 해당 기간만 조회', async () => {
    Transaction.findAll.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { year: '2026', month: '5' } });
    await getTransactions(req, res);

    const callArgs = Transaction.findAll.mock.calls[0][0];
    expect(callArgs.where.date).toBeDefined();
    expect(res.json).toHaveBeenCalled();
  });
});

describe('createTransaction', () => {
  test('T2: 필수 항목 누락 시 → 400', async () => {
    const { req, res } = mockReqRes({ body: { type: 'expense' } });
    await createTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('T3: excludedGroupIds 빈 배열 → DB에 null 저장', async () => {
    Transaction.create.mockResolvedValue({ id: 1 });
    const { req, res } = mockReqRes({
      body: {
        type: 'expense', amount: 10000, category: '식비',
        date: '2026-05-18', excludedGroupIds: [],
      },
    });
    await createTransaction(req, res);

    const saved = Transaction.create.mock.calls[0][0];
    expect(saved.excludedGroupIds).toBeNull();
  });

  test('T3-b: excludedGroupIds 값 있으면 배열 그대로 저장', async () => {
    Transaction.create.mockResolvedValue({ id: 2 });
    const { req, res } = mockReqRes({
      body: {
        type: 'expense', amount: 10000, category: '식비',
        date: '2026-05-18', excludedGroupIds: [1, 2],
      },
    });
    await createTransaction(req, res);

    const saved = Transaction.create.mock.calls[0][0];
    expect(saved.excludedGroupIds).toEqual([1, 2]);
  });
});

describe('updateTransaction', () => {
  test('T4: 다른 유저의 거래 내역 수정 → 404', async () => {
    Transaction.findOne.mockResolvedValue(null); // 소유권 불일치 시 null
    const { req, res } = mockReqRes({ params: { id: '99' }, body: { type: 'expense', amount: 5000, category: '식비', date: '2026-05-18' } });
    await updateTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('T6: 존재하지 않는 ID 수정 → 404', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '9999' }, body: {} });
    await updateTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('deleteTransaction', () => {
  test('T5: 다른 유저의 거래 내역 삭제 → 404', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' } });
    await deleteTransaction(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
