const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', groupController.getMyGroups);
router.post('/', groupController.createGroup);
router.get('/invites', groupController.getInvites);
router.patch('/invites/:inviteId/accept', groupController.acceptInvite);
router.patch('/invites/:inviteId/reject', groupController.rejectInvite);
router.get('/:id', groupController.getGroupDetail);
router.post('/:id/invite', groupController.inviteMember);
router.delete('/:id/leave', groupController.leaveGroup);
router.delete('/:id', groupController.deleteGroup);

module.exports = router;
