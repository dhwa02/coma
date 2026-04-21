const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

router.patch('/profile', authMiddleware, userController.updateProfile);
router.get('/search', authMiddleware, userController.searchUsers);

module.exports = router;
