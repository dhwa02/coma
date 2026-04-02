const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.get('/kakao', authController.kakaoLogin);
router.post('/kakao/token', authController.kakaoToken);
router.get('/naver', authController.naverLogin);
router.post('/naver/token', authController.naverToken);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;
