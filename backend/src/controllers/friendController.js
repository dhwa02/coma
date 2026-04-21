const { Op } = require('sequelize');
const Friend = require('../models/Friend');
const User = require('../models/User');

const USER_ATTRS = ['id', 'nickname', 'profileImage'];

// POST /api/friends/request
exports.sendRequest = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) return res.status(400).json({ message: '대상 유저를 지정해주세요.' });
    if (requesterId === receiverId) return res.status(400).json({ message: '자기 자신에게 친구 요청을 보낼 수 없습니다.' });

    const receiver = await User.findByPk(receiverId);
    if (!receiver) return res.status(404).json({ message: '해당 유저를 찾을 수 없습니다.' });

    const existing = await Friend.findOne({
      where: {
        [Op.or]: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ message: '이미 친구입니다.' });
      if (existing.status === 'pending') return res.status(409).json({ message: '이미 친구 요청을 보냈거나 받은 상태입니다.' });
      if (existing.status === 'rejected') {
        existing.status = 'pending';
        existing.requesterId = requesterId;
        existing.receiverId = receiverId;
        await existing.save();
        return res.status(201).json({ message: '친구 요청을 다시 보냈습니다.' });
      }
    }

    const request = await Friend.create({ requesterId, receiverId, status: 'pending' });
    res.status(201).json(request);
  } catch (err) {
    console.error('[sendRequest Error]', err);
    res.status(500).json({ message: '친구 요청 실패' });
  }
};

// PATCH /api/friends/:id/accept
exports.acceptRequest = async (req, res) => {
  try {
    const friend = await Friend.findByPk(req.params.id);
    if (!friend) return res.status(404).json({ message: '친구 요청을 찾을 수 없습니다.' });
    if (friend.receiverId !== req.user.id) return res.status(403).json({ message: '권한이 없습니다.' });
    if (friend.status !== 'pending') return res.status(400).json({ message: '처리할 수 없는 요청입니다.' });

    friend.status = 'accepted';
    await friend.save();
    res.json({ message: '친구 요청을 수락했습니다.' });
  } catch (err) {
    console.error('[acceptRequest Error]', err);
    res.status(500).json({ message: '친구 수락 실패' });
  }
};

// PATCH /api/friends/:id/reject
exports.rejectRequest = async (req, res) => {
  try {
    const friend = await Friend.findByPk(req.params.id);
    if (!friend) return res.status(404).json({ message: '친구 요청을 찾을 수 없습니다.' });
    if (friend.receiverId !== req.user.id) return res.status(403).json({ message: '권한이 없습니다.' });
    if (friend.status !== 'pending') return res.status(400).json({ message: '처리할 수 없는 요청입니다.' });

    friend.status = 'rejected';
    await friend.save();
    res.json({ message: '친구 요청을 거절했습니다.' });
  } catch (err) {
    console.error('[rejectRequest Error]', err);
    res.status(500).json({ message: '친구 거절 실패' });
  }
};

// DELETE /api/friends/:id
exports.deleteFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const friend = await Friend.findByPk(req.params.id);
    if (!friend) return res.status(404).json({ message: '친구 관계를 찾을 수 없습니다.' });
    if (friend.requesterId !== userId && friend.receiverId !== userId) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    await friend.destroy();
    res.json({ message: '친구가 삭제되었습니다.' });
  } catch (err) {
    console.error('[deleteFriend Error]', err);
    res.status(500).json({ message: '친구 삭제 실패' });
  }
};

// GET /api/friends
exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await Friend.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [{ requesterId: userId }, { receiverId: userId }],
      },
      include: [
        { model: User, as: 'requester', attributes: USER_ATTRS },
        { model: User, as: 'receiver', attributes: USER_ATTRS },
      ],
    });

    const friends = rows.map(row => {
      const friend = row.requesterId === userId ? row.receiver : row.requester;
      return { friendshipId: row.id, ...friend.toJSON() };
    });

    res.json(friends);
  } catch (err) {
    console.error('[getFriends Error]', err);
    res.status(500).json({ message: '친구 목록 조회 실패' });
  }
};

// GET /api/friends/requests
exports.getRequests = async (req, res) => {
  try {
    const rows = await Friend.findAll({
      where: { receiverId: req.user.id, status: 'pending' },
      include: [{ model: User, as: 'requester', attributes: USER_ATTRS }],
      order: [['createdAt', 'DESC']],
    });

    const requests = rows.map(row => ({
      requestId: row.id,
      ...row.requester.toJSON(),
      requestedAt: row.createdAt,
    }));

    res.json(requests);
  } catch (err) {
    console.error('[getRequests Error]', err);
    res.status(500).json({ message: '친구 요청 목록 조회 실패' });
  }
};
