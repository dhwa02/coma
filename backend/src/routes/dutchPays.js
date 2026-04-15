const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const ctrl = require('../controllers/dutchPayController');

router.use(authMiddleware);

router.get('/', ctrl.getDutchPays);
router.post('/', ctrl.createDutchPay);
router.delete('/:id', ctrl.deleteDutchPay);
router.patch('/:id/participants/:participantId/paid', ctrl.togglePaid);

module.exports = router;
