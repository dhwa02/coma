jest.mock('../models/Friend', () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
}));
jest.mock('../models/User', () => ({
  findByPk: jest.fn(),
}));
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn(),
}));

const Friend = require('../models/Friend');
const User = require('../models/User');
const { createNotification } = require('../controllers/notificationController');
const {
  sendRequest,
  acceptRequest,
  rejectRequest,
  deleteFriend,
  getFriends,
} = require('../controllers/friendController');

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

beforeEach(() => jest.clearAllMocks());

describe('sendRequest (친구 요청)', () => {
  test('F1: 자기 자신에게 친구 요청 → 400', async () => {
    const { req, res } = mockReqRes({ body: { receiverId: 1 } }); // req.user.id와 동일
    await sendRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('F2: 이미 친구인 상태에서 재요청 → 409', async () => {
    User.findByPk.mockResolvedValue({ id: 2, nickname: '친구' });
    Friend.findOne.mockResolvedValue({ status: 'accepted' });
    const { req, res } = mockReqRes({ body: { receiverId: 2 } });
    await sendRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('F3: pending 상태에서 재요청 → 409', async () => {
    User.findByPk.mockResolvedValue({ id: 2 });
    Friend.findOne.mockResolvedValue({ status: 'pending' });
    const { req, res } = mockReqRes({ body: { receiverId: 2 } });
    await sendRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('F4: rejected 상태에서 재요청 → 201 + 수신자에게 알림 발송 (BUG 2 검증)', async () => {
    const mockFriend = {
      id: 10, status: 'rejected',
      requesterId: 2, receiverId: 1,
      save: jest.fn().mockResolvedValue(true),
    };
    User.findByPk.mockResolvedValue({ id: 2 });
    Friend.findOne.mockResolvedValue(mockFriend);
    createNotification.mockResolvedValue({});

    const { req, res } = mockReqRes({ body: { receiverId: 2 } });
    await sendRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // 알림이 수신자(receiverId=2)에게 발송되었는지 검증
    expect(createNotification).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ userId: 2, type: 'friend_request' })
    );
  });
});

describe('acceptRequest (친구 요청 수락)', () => {
  test('F5: 수신자가 아닌 유저가 수락 시도 → 403', async () => {
    Friend.findByPk.mockResolvedValue({ id: 5, receiverId: 99, status: 'pending' });
    const { req, res } = mockReqRes({ params: { id: '5' } }); // 요청 유저 id=1
    await acceptRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('F6: pending 아닌 요청 수락 → 400', async () => {
    Friend.findByPk.mockResolvedValue({ id: 5, receiverId: 1, status: 'accepted' });
    const { req, res } = mockReqRes({ params: { id: '5' } });
    await acceptRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('rejectRequest (친구 요청 거절)', () => {
  test('F6-b: pending 아닌 요청 거절 → 400', async () => {
    Friend.findByPk.mockResolvedValue({ id: 5, receiverId: 1, status: 'rejected' });
    const { req, res } = mockReqRes({ params: { id: '5' } });
    await rejectRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteFriend (친구 삭제)', () => {
  test('F7: 관계 없는 유저가 삭제 시도 → 403', async () => {
    Friend.findByPk.mockResolvedValue({
      id: 5, requesterId: 88, receiverId: 99, // 요청 유저(id=1)와 무관
    });
    const { req, res } = mockReqRes({ params: { id: '5' } });
    await deleteFriend(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('F8: requester가 삭제 시도 → 성공', async () => {
    const mockFriend = {
      id: 5, requesterId: 1, receiverId: 2,
      destroy: jest.fn().mockResolvedValue(true),
    };
    Friend.findByPk.mockResolvedValue(mockFriend);
    const { req, res } = mockReqRes({ params: { id: '5' } });
    await deleteFriend(req, res);
    expect(mockFriend.destroy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test('F8-b: receiver가 삭제 시도 → 성공', async () => {
    const mockFriend = {
      id: 5, requesterId: 2, receiverId: 1, // req.user.id=1이 receiver
      destroy: jest.fn().mockResolvedValue(true),
    };
    Friend.findByPk.mockResolvedValue(mockFriend);
    const { req, res } = mockReqRes({ params: { id: '5' } });
    await deleteFriend(req, res);
    expect(mockFriend.destroy).toHaveBeenCalled();
  });
});
