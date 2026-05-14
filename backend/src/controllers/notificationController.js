const Notification = require('../models/Notification');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error('[getNotifications]', err);
    res.status(500).json({ message: '조회 실패' });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { id: req.params.id, userId: req.user.id } }
    );
    res.json({ message: 'ok' });
  } catch (err) {
    console.error('[markRead]', err);
    res.status(500).json({ message: '수정 실패' });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.json({ message: 'ok' });
  } catch (err) {
    console.error('[markAllRead]', err);
    res.status(500).json({ message: '수정 실패' });
  }
};

// 내부 헬퍼: 알림 생성 + 소켓 emit
exports.createNotification = async (io, { userId, type, message, referenceId }) => {
  try {
    const notif = await Notification.create({ userId, type, message, referenceId: referenceId ?? null });
    if (io) {
      io.to(`user:${userId}`).emit('new-notification', notif.toJSON());
    }
    return notif;
  } catch (err) {
    console.error('[createNotification]', err);
  }
};
