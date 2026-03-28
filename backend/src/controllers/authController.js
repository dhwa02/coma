const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function issueTokens(user) {
  const payload = { id: user.id, nickname: user.nickname };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
  });
}

// GET /api/auth/kakao >> 카카오 OAuth 페이지로 리다이렉트
exports.kakaoLogin = (req, res) => {
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${process.env.KAKAO_REST_API_KEY}` +
    `&redirect_uri=${process.env.KAKAO_REDIRECT_URI}` +
    `&response_type=code`;

  res.redirect(kakaoAuthUrl);
};

// POST /api/auth/kakao/token >> 프론트에서 code를 받아 처리
exports.kakaoToken = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'code가 없습니다.' });
  }

  try {
    // 1. code >> 카카오 액세스 토큰
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      ...(process.env.KAKAO_CLIENT_SECRET && { client_secret: process.env.KAKAO_CLIENT_SECRET }),
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    });
    console.log('[Kakao Token Request]', Object.fromEntries(params));

    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const kakaoAccessToken = tokenRes.data.access_token;

    // 2. 카카오 사용자 정보 조회
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    const { id: kakaoId, kakao_account } = userRes.data;
    const nickname = kakao_account?.profile?.nickname ?? '사용자';
    const profileImage = kakao_account?.profile?.profile_image_url ?? null;
    const email = kakao_account?.email ?? null;

    // 3. DB에서 유저 조회 또는 신규 생성
    const [user] = await User.findOrCreate({
      where: { kakaoId: String(kakaoId) },
      defaults: { nickname, profileImage, email },
    });

    // 4. JWT 발급 >> 쿠키 저장
    const { accessToken, refreshToken } = issueTokens(user);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({ user: { id: user.id, nickname: user.nickname, profileImage: user.profileImage } });
  } catch (err) {
    console.error('[Kakao OAuth Error]', JSON.stringify(err.response?.data ?? err.message, null, 2));
    res.status(500).json({ message: '카카오 로그인 실패', error: err.response?.data ?? err.message });
  }
};

// GET /api/auth/me >> 현재 로그인 유저 정보
exports.getMe = async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'nickname', 'profileImage', 'email'],
  });
  if (!user) return res.status(404).json({ message: '유저를 찾을 수 없습니다.' });
  res.json(user);
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: '로그아웃 완료' });
};
