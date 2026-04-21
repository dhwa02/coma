require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const sequelize = require('./config/db');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const dutchPayRoutes = require('./routes/dutchPays');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const groupRoutes = require('./routes/groups');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dutch-pays', dutchPayRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;

// alter:true는 재시작마다 중복 인덱스를 쌓는 Sequelize 버그가 있어 사용하지 않음
// 새 테이블은 force:false(기본값)로 없을 때만 생성됨
sequelize.sync({ force: false })
  .then(() => {
    console.log('DB 연결 성공');
    app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB 연결 실패:', err);
    process.exit(1);
  });
