const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', friendController.getFriends);
router.get('/requests', friendController.getRequests);
router.post('/request', friendController.sendRequest);
router.patch('/:id/accept', friendController.acceptRequest);
router.patch('/:id/reject', friendController.rejectRequest);
router.delete('/:id', friendController.deleteFriend);

module.exports = router;
