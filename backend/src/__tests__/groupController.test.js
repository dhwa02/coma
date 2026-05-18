const mockCommit = jest.fn();
const mockRollback = jest.fn();

jest.mock('../config/db', () => ({
  transaction: jest.fn(async () => ({ commit: mockCommit, rollback: mockRollback })),
}));
jest.mock('../models/Group', () => ({
  findByPk: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock('../models/GroupMember', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));
jest.mock('../models/User', () => ({ findByPk: jest.fn() }));
jest.mock('../models/Friend', () => ({ findAll: jest.fn() }));
jest.mock('../models/Transaction', () => ({
  findAll: jest.fn(),
}));
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn(),
}));

const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Friend = require('../models/Friend');
const Transaction = require('../models/Transaction');
const { createNotification } = require('../controllers/notificationController');
const {
  createGroup,
  leaveGroup,
  deleteGroup,
  acceptInvite,
  rejectInvite,
  getGroupDetail,
  computeGroupRanking,
} = require('../controllers/groupController');

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

beforeEach(() => {
  jest.clearAllMocks();
  mockCommit.mockReset();
  mockRollback.mockReset();
});

describe('createGroup', () => {
  test('G1: 종료일이 시작일보다 앞선 경우 → 400', async () => {
    const { req, res } = mockReqRes({
      body: { name: '테스트그룹', startDate: '2026-05-31', endDate: '2026-05-01' },
    });
    await createGroup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('G2: 친구가 아닌 ID는 GroupMember에 추가되지 않음', async () => {
    Group.create.mockResolvedValue({ id: 1, name: '그룹' });
    GroupMember.create.mockResolvedValue({});
    // 친구 관계 검증: inviteeIds에 [2, 3] 중 userId 2만 친구
    Friend.findAll.mockResolvedValue([
      { requesterId: 1, receiverId: 2 }, // userId 2만 친구
    ]);
    GroupMember.bulkCreate.mockResolvedValue([]);

    const { req, res } = mockReqRes({
      body: {
        name: '테스트그룹', startDate: '2026-05-01', endDate: '2026-05-31',
        inviteeIds: [2, 3], // 3은 친구 아님
      },
    });
    await createGroup(req, res);

    const bulkArgs = GroupMember.bulkCreate.mock.calls[0][0];
    const addedUserIds = bulkArgs.map(r => r.userId);
    expect(addedUserIds).toContain(2);
    expect(addedUserIds).not.toContain(3); // 친구 아닌 3은 제외
  });

  test('G3: 친구가 아닌 ID에게 초대 알림 미발송 (BUG 1 검증)', async () => {
    Group.create.mockResolvedValue({ id: 1, name: '그룹' });
    GroupMember.create.mockResolvedValue({});
    Friend.findAll.mockResolvedValue([
      { requesterId: 1, receiverId: 2 }, // userId 2만 친구
    ]);
    GroupMember.bulkCreate.mockResolvedValue([]);

    const { req, res } = mockReqRes({
      body: {
        name: '테스트그룹', startDate: '2026-05-01', endDate: '2026-05-31',
        inviteeIds: [2, 3],
      },
    });
    await createGroup(req, res);

    const notifiedUserIds = createNotification.mock.calls.map(c => c[1].userId);
    expect(notifiedUserIds).toContain(2);
    expect(notifiedUserIds).not.toContain(3); // 친구 아닌 3은 알림 없음
  });
});

describe('getGroupDetail', () => {
  test('G4: 그룹 멤버가 아닌 유저 → 403', async () => {
    Group.findByPk.mockResolvedValue({
      id: 1,
      members: [{ userId: 99, role: 'owner' }], // 요청 유저(id=1)는 멤버 아님
      toJSON: jest.fn().mockReturnValue({}),
    });
    const { req, res } = mockReqRes({ params: { id: '1' } });
    await getGroupDetail(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('leaveGroup', () => {
  test('G5: 그룹장이 탈퇴 시도 → 400', async () => {
    Group.findByPk.mockResolvedValue({ id: 1, ownerId: 1 }); // 요청 유저 = 그룹장
    const { req, res } = mockReqRes({ params: { id: '1' } });
    await leaveGroup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteGroup', () => {
  test('G6: 그룹장이 아닌 유저가 삭제 시도 → 403', async () => {
    Group.findByPk.mockResolvedValue({ id: 1, ownerId: 99 }); // 그룹장은 99
    const { req, res } = mockReqRes({ params: { id: '1' } }); // 요청 유저는 1
    await deleteGroup(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('acceptInvite / rejectInvite', () => {
  test('G10: 본인 초대가 아닌 경우 수락 → 403', async () => {
    GroupMember.findByPk.mockResolvedValue({ id: 5, userId: 99, status: 'pending' });
    const { req, res } = mockReqRes({ params: { inviteId: '5' } }); // 요청 유저 id=1
    await acceptInvite(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('G11: 이미 처리된 초대 재수락 → 400', async () => {
    GroupMember.findByPk.mockResolvedValue({ id: 5, userId: 1, status: 'accepted' });
    const { req, res } = mockReqRes({ params: { inviteId: '5' } });
    await acceptInvite(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('computeGroupRanking', () => {
  const baseGroup = {
    id: 1,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    categories: null,
    members: [
      { id: 1, userId: 1, role: 'member', user: { id: 1, nickname: '유저1', profileImage: null } },
      { id: 2, userId: 2, role: 'member', user: { id: 2, nickname: '유저2', profileImage: null } },
    ],
  };

  test('G8: categories null → 카테고리 필터 없이 조회', async () => {
    Group.findByPk.mockResolvedValue({ ...baseGroup, categories: null });
    Transaction.findAll.mockResolvedValue([]);

    await computeGroupRanking(1);

    const whereArg = Transaction.findAll.mock.calls[0][0].where;
    expect(whereArg.category).toBeUndefined(); // 카테고리 조건 없음
  });

  test('G9: categories 지정 → 해당 카테고리만 where 조건에 포함', async () => {
    Group.findByPk.mockResolvedValue({ ...baseGroup, categories: ['식비', '교통'] });
    Transaction.findAll.mockResolvedValue([]);

    await computeGroupRanking(1);

    const whereArg = Transaction.findAll.mock.calls[0][0].where;
    expect(whereArg.category).toBeDefined(); // 카테고리 조건 있음
  });

  test('G7: 그룹 없을 시 빈 배열 반환', async () => {
    Group.findByPk.mockResolvedValue(null);
    const result = await computeGroupRanking(999);
    expect(result).toEqual([]);
  });
});
