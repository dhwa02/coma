###중요###

현재 npm에 강력한 공급망 공격이 진행중임.
절대로 npm을 이용한 추가 패키지 설치/삭제를 진행하지말것
npm 버전 업데이트또한 절대 진행하지 말것


# COMA 프로젝트 개발 문서

## 프로젝트 개요

**COMA**는 카카오/네이버 소셜 로그인 기반의 가계부 + 더치페이 + 절약 대결 웹 애플리케이션이다.

- **프론트엔드**: React 19 + TypeScript + Vite (`/frontend`)
- **백엔드**: Express.js + Node.js (`/backend`)
- **DB**: MySQL + Sequelize ORM
- **인증**: JWT (쿠키 저장) + 카카오/네이버 OAuth

---

## 현재 구현된 기능

### 인증
- 카카오 소셜 로그인 (`GET /api/auth/kakao` → `POST /api/auth/kakao/token`)
- 네이버 소셜 로그인 (`GET /api/auth/naver` → `POST /api/auth/naver/token`)
- JWT accessToken + refreshToken 쿠키 발급
- `GET /api/auth/me` - 현재 로그인 유저 조회
- **임시 개발용 계정 로그인** (`POST /api/auth/dev-login`) - `findOrCreate`로 중복 생성 방지

### 거래 내역 (Transactions)
- 수입/지출 CRUD
- 카테고리별 분류
- 날짜별 조회 및 달력 표시
- **챌린지 포함/제외 설정**: `excludedGroupIds` JSON 배열로 그룹별 제외 여부 관리 (기본값 null = 모든 챌린지 포함)
- 지출 추가/수정 모달에서 진행 중인 챌린지별 포함 여부 체크박스 제공

### 더치페이 (DutchPay)
- 더치페이 생성 (제목, 총액, 참여자 이름 직접 입력 또는 친구 선택)
- 참여자별 정산 금액 자동 계산 (`Math.ceil(totalAmount / count)`)
- **대표 지출자**: 참여자 목록에서 왕관(👑) 버튼으로 선택 (기본: 첫 번째 = 나)
- **전원 트랜잭션 자동 생성**: 대표 지출자(totalAmount) + 비지출자 참여자(amountOwed) 모두 거래 내역 자동 등록
- **친구도 본인 더치페이 조회 가능**: `DutchPayParticipant.userId` 기준으로 본인이 참여자인 더치페이 모두 표시
- 참여자별 입금 완료 체크 (생성자 또는 해당 참여자 본인만 가능)
- 정산 내용 클립보드 공유
- **카드 전체 클릭으로 펼치기/접기** (상세 보기 버튼과 병행)

### 그룹 챌린지
- 그룹 생성/초대/수락/거절/탈퇴/삭제
- **지출 카테고리 지정**: 그룹 생성 시 대상 카테고리 선택 가능 (null = 전체)
- 그룹별 기간 내 지출 합산 및 멤버 랭킹
- `JSON_CONTAINS`로 `excludedGroupIds` 필터 적용한 정확한 지출 집계

### 알림 뱃지
- 친구 요청 대기 중이면 👥 아이콘에 빨간 뱃지 표시 (30초 폴링)
- 그룹 초대 대기 중이면 🏆 아이콘에 빨간 뱃지 표시 (30초 폴링)

### 통합 알림 센터 (Notification Center) - 260514
- 대시보드 우측 상단 🔔 벨 아이콘 클릭 시 드롭다운 패널 표시
- 읽지 않은 알림 수 숫자 뱃지 표시 (최대 9+ 표시)
- 알림 클릭 시 읽음 처리 + 해당 페이지로 자동 이동
  - `friend_request` / `friend_accepted` → `/friends`
  - `group_invite` / `group_invite_accepted` / `group_invite_rejected` / `ranking_change` → `/groups`
  - `dutch_settled` → 대시보드 더치페이 탭 + 해당 항목 포커스
- "모두 읽음" 버튼으로 일괄 처리
- **실시간 push**: Socket.IO `join-user` 이벤트로 개인 룸(`user:${userId}`) 참여 → 새 알림 발생 시 `new-notification` 이벤트로 즉시 수신
- 30초 폴링 fallback 병행
- **알림 생성 시점 및 타입** (type 컬럼: `VARCHAR(50)`):

| 타입 | 트리거 | 수신자 |
|------|--------|--------|
| `friend_request` 👥 | 친구 요청 전송 | 수신자 |
| `friend_accepted` 🤝 | 친구 요청 수락 | 요청자 |
| `group_invite` 🏆 | 챌린지 초대 (생성 시 일괄 / 개별) | 초대된 유저 |
| `group_invite_accepted` 🎉 | 챌린지 초대 수락 | 그룹 오너 |
| `group_invite_rejected` ❌ | 챌린지 초대 거절 | 그룹 오너 |
| `dutch_settled` ✅ | 더치페이 정산 완료 (본인 지출자 제외) | 대표 지출자 |
| `ranking_change` 📊 | 트랜잭션 변경 후 순위 이동 (활성 그룹만, before·after 비교) | 순위 변동 멤버 |

### 버그 수정 및 단위 테스트 - 260518

- 아래 버그 수정 완
BUG 1 — `groupController.js` 친구가 아닌 사람에게 초대 알림 발송 (심각)
BUG 2 — `friendController.js` 거절된 친구 요청 재전송 시 알림 미발송 (중간)
BUG 3 — `dutchPayController.js` createDutchPay DB 트랜잭션 미사용 (중간)

- 단위 테스트
| 우선순위 | 테스트 ID | 이유 |
|----------|-----------|------|
| **P0** | D8, G3, F4 | 수정된 버그 회귀 방지 (BUG 1, 2, 3 검증) |
| **P1** | A1~A5, T4, T5, G4, G6, F5, F7 | 인증·인가 관련 — 보안 직결 |
| **P2** | D1~D7, G1, G2, G7~G9 | 핵심 비즈니스 로직 |
| **P3** | T1, T3, T6, F1~F3, F6, F8, G5, G10, G11 | 부가 기능 및 엣지 케이스 |

- 테스트 코드는 `backend/src/__tests__/` 폴더에 위치한다.

| 파일명 | 커버하는 테스트 ID | 비고 |
|--------|-------------------|------|
| `setup.js` | — | JWT_SECRET 등 테스트용 환경변수 설정 (setupFiles) |
| `authMiddleware.test.js` | A1 ~ A5 | supertest + 미니 Express 앱 사용, DB 불필요 |
| `transactionController.test.js` | T1 ~ T6 | 모델 mock, 컨트롤러 함수 직접 호출 |
| `dutchPayController.test.js` | D1 ~ D8 | 모델 + sequelize.transaction() mock |
| `groupController.test.js` | G1 ~ G11 | 모델 + computeGroupRanking 직접 테스트 포함 |
| `friendController.test.js` | F1 ~ F8 | 모델 mock, BUG 2 회귀 테스트 포함 |
| `notificationController.test.js` | N1 ~ N5 | 모델 mock, io.emit 호출 검증 포함 |

- 설정 파일:

| 파일명 | 역할 |
|--------|------|
| `backend/jest.config.js` | Jest 설정 (testMatch, setupFiles, timeout) |



---

## DB 모델 현황

### User (`users` 테이블)
```
id, kakaoId, naverId, email, nickname, profileImage, createdAt, updatedAt
```
- 최초 소셜 로그인 시 nickname/profileImage 저장 (이후 변경 API 없음)

### Transaction (`transactions` 테이블)
```
id, userId, type(income/expense), amount, category, memo, date,
paymentMethod, excludedGroupIds(JSON), createdAt, updatedAt
```
- `excludedGroupIds`: 제외할 그룹 ID 배열. NULL이면 모든 챌린지에 포함

### DutchPay (`dutch_pays` 테이블)
```
id, userId, title, totalAmount, participantCount, memo, date,
isUserPayer, linkedTransactionId, category, createdAt, updatedAt
```
- `linkedTransactionId`: 대표 지출자의 거래 내역 ID

### DutchPayParticipant (`dutch_pay_participants` 테이블)
```
id, dutchPayId, userId(FK nullable), name, amountOwed, isPaid, paidAt,
isPayer, linkedTransactionId, createdAt, updatedAt
```
- `userId`: 친구 연동 시 User FK 저장 (없으면 NULL)
- `linkedTransactionId`: 해당 참여자의 거래 내역 ID (비지출자도 포함)

### Group (`groups` 테이블)
```
id, name, ownerId, startDate, endDate, goal, categories(JSON), createdAt, updatedAt
```
- `categories`: 대상 카테고리 배열. NULL이면 전체 카테고리

### GroupMember (`group_members` 테이블)
```
id, groupId, userId, role(owner/member), status(pending/accepted), createdAt, updatedAt
```

### Friend (`friends` 테이블)
```
id, requesterId, receiverId, status(pending/accepted/rejected), createdAt, updatedAt
```

### Notification (`notifications` 테이블)
```
id, userId(수신자 FK), type(VARCHAR 50 — 7가지 타입),
message, isRead(default false), referenceId(관련 레코드 ID), createdAt, updatedAt
```

---

## DB 마이그레이션 (신규 컬럼 추가 필요)

각 팀원의 로컬 DB에 아래 SQL을 실행해야 함:

```sql
-- groups 테이블에 categories 추가
ALTER TABLE coma_db.`groups` ADD COLUMN categories JSON NULL;

-- transactions 테이블: excludeFromChallenge → excludedGroupIds 변경
ALTER TABLE coma_db.transactions DROP COLUMN IF EXISTS excludeFromChallenge;
ALTER TABLE coma_db.transactions ADD COLUMN excludedGroupIds JSON NULL;

-- dutch_pay_participants 테이블에 linkedTransactionId 추가
ALTER TABLE coma_db.dutch_pay_participants ADD COLUMN linkedTransactionId INT NULL;

-- dutch_pay_participants 테이블에 userId 추가 (없는 경우)
ALTER TABLE coma_db.dutch_pay_participants ADD COLUMN userId INT NULL;


-- 260514 
-- notifications 테이블 생성 (알림 센터 기능)
CREATE TABLE IF NOT EXISTS coma_db.notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  message VARCHAR(255) NOT NULL,
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  referenceId INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```
> `notifications` 테이블은 `sequelize.sync({ force: false })`로 자동 생성되므로 위 SQL은 수동 생성이 필요한 경우에만 사용.

```sql
-- notifications 테이블이 이미 ENUM으로 생성된 경우 VARCHAR로 변경
ALTER TABLE coma_db.notifications MODIFY COLUMN type VARCHAR(50) NOT NULL;
```

> DB 관련 수정은 조원 이재호의 로컬 PC 기준이며, 각 사용자의 로컬 환경 및 DB 상태에 따라 알맞은 수정 필요.

---


---

## 파일 구조 (주요)

```
coma-main/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Transaction.js
│   │   │   ├── DutchPay.js
│   │   │   ├── DutchPayParticipant.js
│   │   │   ├── Group.js
│   │   │   ├── GroupMember.js
│   │   │   ├── Friend.js
│   │   │   └── Notification.js            # 신규
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── transactionController.js
│   │   │   ├── dutchPayController.js
│   │   │   ├── groupController.js
│   │   │   ├── friendController.js
│   │   │   └── notificationController.js  # 신규
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   ├── dutchPays.js
│   │   │   ├── groups.js
│   │   │   ├── friends.js
│   │   │   └── notifications.js           # 신규
│   │   └── index.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LoginPage.tsx / .css
    │   │   ├── AuthCallback.tsx
    │   │   ├── NaverCallback.tsx
    │   │   ├── DashboardPage.tsx / .css   # 메인 대시보드
    │   │   ├── GroupsPage.tsx / .css      # 그룹 챌린지
    │   │   ├── ProfilePage.tsx / .css     # 개인 페이지 (친구)
    │   │   └── LandingPage.tsx
    │   └── services/api.ts
    └── package.json
```

---

## 환경변수 목록

### 백엔드 (`/backend/.env`)
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET, JWT_EXPIRES_IN
JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN
KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI
NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI
CLIENT_URL
```

### 프론트엔드 (`/frontend/.env`)
```
VITE_API_URL          # 백엔드 API 주소 (예: http://localhost:4000)
VITE_SOCKET_URL       # WebSocket 주소
VITE_KAKAO_JS_KEY     # 카카오 JS SDK 키
```

---

## 개발 서버 실행

```bash
# 백엔드
cd backend && npm run dev   # localhost:4000

# 프론트엔드
cd frontend && npm run dev  # localhost:5173
```

---

## 배포 관련

현재 로컬 환경에서 개발 중이며, 기능 구현 완료 후 클라우드 배포 예정.
- 추천 플랫폼: Railway (백엔드 + MySQL 통합 배포, 간단함)
- 배포 시 `.env` 값만 프로덕션 주소로 교체하면 됨
- 코드 자체는 이미 `NODE_ENV=production` 분기 처리되어 있음
