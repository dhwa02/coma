const { Op } = require('sequelize');
const User = require('../models/User');

// PATCH /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { nickname, profileImage } = req.body;

    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ message: '닉네임을 입력해주세요.' });
    }
    if (nickname.trim().length > 20) {
      return res.status(400).json({ message: '닉네임은 20자 이내로 입력해주세요.' });
    }

    const existing = await User.findOne({
      where: { nickname: nickname.trim(), id: { [Op.ne]: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: '유저를 찾을 수 없습니다.' });

    user.nickname = nickname.trim();
    if (profileImage !== undefined) user.profileImage = profileImage;
    await user.save();

    res.json({ id: user.id, nickname: user.nickname, profileImage: user.profileImage, email: user.email });
  } catch (err) {
    console.error('[updateProfile Error]', err);
    res.status(500).json({ message: '프로필 업데이트 실패' });
  }
};

// GET /api/users/search?q=닉네임
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: '검색어는 2자 이상 입력해주세요.' });
    }

    const users = await User.findAll({
      where: {
        nickname: { [Op.like]: `%${q.trim()}%` },
        id: { [Op.ne]: req.user.id },
      },
      attributes: ['id', 'nickname', 'profileImage'],
      limit: 20,
    });

    res.json(users);
  } catch (err) {
    console.error('[searchUsers Error]', err);
    res.status(500).json({ message: '사용자 검색 실패' });
  }
};
