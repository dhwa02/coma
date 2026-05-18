jest.mock('../models/Notification', () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const Notification = require('../models/Notification');
const {
  getNotifications,
  markRead,
  markAllRead,
  createNotification,
} = require('../controllers/notificationController');

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 1 },
    body: {},
    params: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => jest.clearAllMocks());

describe('getNotifications', () => {
  test('N1: 최대 50개 제한으로 조회', async () => {
    Notification.findAll.mockResolvedValue([]);
    const { req, res } = mockReqRes();
    await getNotifications(req, res);

    const opts = Notification.findAll.mock.calls[0][0];
    expect(opts.limit).toBe(50);
  });
});

describe('markRead', () => {
  test('N2: update 조건에 userId 포함 → 타인 알림 처리 불가', async () => {
    Notification.update.mockResolvedValue([1]);
    const { req, res } = mockReqRes({ params: { id: '99' } });
    await markRead(req, res);

    const whereArg = Notification.update.mock.calls[0][1].where;
    expect(whereArg.userId).toBe(1); // 자신의 userId만 조건으로 사용
    expect(whereArg.id).toBe('99');
  });
});

describe('markAllRead', () => {
  test('N3: isRead false인 것만 업데이트', async () => {
    Notification.update.mockResolvedValue([3]);
    const { req, res } = mockReqRes();
    await markAllRead(req, res);

    const [values, opts] = Notification.update.mock.calls[0];
    expect(values.isRead).toBe(true);
    expect(opts.where.isRead).toBe(false);
    expect(opts.where.userId).toBe(1);
  });
});

describe('createNotification (내부 헬퍼)', () => {
  test('N4: 알림 생성 후 io.emit 호출', async () => {
    const mockNotif = {
      id: 1, userId: 2, type: 'friend_request', message: '친구 요청',
      toJSON: jest.fn().mockReturnValue({ id: 1 }),
    };
    Notification.create.mockResolvedValue(mockNotif);
    const mockEmit = jest.fn();
    const mockIo = { to: jest.fn().mockReturnValue({ emit: mockEmit }) };

    await createNotification(mockIo, {
      userId: 2, type: 'friend_request', message: '친구 요청', referenceId: 5,
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, type: 'friend_request' })
    );
    expect(mockIo.to).toHaveBeenCalledWith('user:2');
    expect(mockEmit).toHaveBeenCalledWith('new-notification', expect.any(Object));
  });

  test('N5: DB 오류 시 예외가 호출 코드로 전파되지 않음', async () => {
    Notification.create.mockRejectedValue(new Error('DB 오류'));
    await expect(
      createNotification(null, { userId: 1, type: 'test', message: '테스트' })
    ).resolves.toBeUndefined(); // 에러 없이 undefined 반환
  });
});
