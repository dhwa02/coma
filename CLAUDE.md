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

### 거래 내역 (Transactions)
- 수입/지출 CRUD
- 카테고리별 분류
- 날짜별 조회 및 달력 표시

### 더치페이 (DutchPay)
- 더치페이 생성 (제목, 총액, 참여자 이름 직접 입력)
- 참여자별 정산 금액 자동 계산 (`Math.ceil(totalAmount / count)`)
- 대표 지출자 지정 시 Transaction 자동 연동
- 참여자별 입금 완료 체크
- 정산 내용 클립보드 공유

---

## DB 모델 현황

### User (`users` 테이블)
```
id, kakaoId, naverId, email, nickname, profileImage, createdAt, updatedAt
```
- 최초 소셜 로그인 시 nickname/profileImage 저장 (이후 변경 API 없음)

### Transaction (`transactions` 테이블)
```
id, userId, type(income/expense), amount, category, memo, date, createdAt, updatedAt
```

### DutchPay (`dutch_pays` 테이블)
```
id, userId, title, totalAmount, participantCount, memo, date,
isUserPayer, linkedTransactionId, category, createdAt, updatedAt
```

### DutchPayParticipant (`dutch_pay_participants` 테이블)
```
id, dutchPayId, name(문자열), amountOwed, isPaid, paidAt, isPayer, createdAt, updatedAt
```
- 현재 참여자는 이름 문자열로만 저장 (User FK 없음)

---

## 진행 예정 작업: 친구 초대 및 그룹 생성 기능

### 구현 방식 결정사항
- 친구 검색: **닉네임 기반 앱 내 사용자 검색** (웹 자체 시스템)
- 친구 초대: **카카오 공유하기 JavaScript SDK** (비즈니스 심사 불필요, 팝업 방식)
- 카카오 친구 목록 불러오기: 미구현 (비즈니스 심사 필요하여 제외)

-------------------
-------------------

## 단계별 구현 계획

### 1단계: 프로필 페이지 + 닉네임 설정 (완료)

**목표**: 사용자가 닉네임을 직접 변경할 수 있도록 하고, 친구 검색의 기반 마련

**백엔드**
- [x] `PATCH /api/users/profile` - 닉네임, 프로필이미지 수정 API (중복 닉네임 검사 포함)
- [x] `GET /api/users/search?q=닉네임` - 닉네임으로 사용자 검색 API (2자 이상, 자신 제외)
- [x] 라우터: `/backend/src/routes/users.js` 신규 생성
- [x] 컨트롤러: `/backend/src/controllers/userController.js` 신규 생성
- [x] `index.js`에 `/api/users` 라우트 등록

**프론트엔드**
- [x] 프로필 페이지 신규 생성 (`/frontend/src/pages/ProfilePage.tsx`)
  - 닉네임 변경 폼 (실시간 글자수, 중복 오류 표시)
  - 카카오 프로필 이미지 표시 (없으면 이니셜 아바타)
  - 이메일/소셜 계정 정보 표시
- [x] `App.tsx`에 `/profile` 라우트 추가
- [x] 대시보드 Nav의 닉네임을 클릭하면 프로필 페이지로 이동 (`.db-profile-btn`)

---

### 2단계: 친구 시스템 (완료)

**목표**: 닉네임으로 친구를 검색하고 친구 요청/수락/거절 구현

**백엔드**
- [x] Friend 모델 신규 생성 (`/backend/src/models/Friend.js`)
  - `id, requesterId, receiverId, status(pending/accepted/rejected), createdAt, updatedAt`
  - User와 양방향 association (requester/receiver alias)
- [x] `POST /api/friends/request` - 친구 요청 (중복/이미 친구 검사, 거절 후 재요청 가능)
- [x] `PATCH /api/friends/:id/accept` - 친구 요청 수락
- [x] `PATCH /api/friends/:id/reject` - 친구 요청 거절
- [x] `DELETE /api/friends/:id` - 친구 삭제
- [x] `GET /api/friends` - 내 친구 목록 (requesterId/receiverId 양방향 조회)
- [x] `GET /api/friends/requests` - 받은 친구 요청 목록
- [x] 라우터: `/backend/src/routes/friends.js` 신규 생성
- [x] 컨트롤러: `/backend/src/controllers/friendController.js` 신규 생성
- [x] `index.js`에 `/api/friends` 라우트 등록

**프론트엔드**
- [x] 친구 페이지 신규 생성 (`/frontend/src/pages/FriendsPage.tsx`)
  - 닉네임 검색창 (2자 이상, 이미 친구/요청받음 배지 표시)
  - 친구 목록 탭 (인라인 삭제 확인)
  - 받은 요청 탭 (수락/거절, 뱃지 카운트)
- [x] `App.tsx`에 `/friends` 라우트 추가
- [x] 대시보드 Nav 우측에 👥 친구 아이콘 버튼 추가

---

### 3단계: 그룹 생성 (절약 대결용) (완료)

**목표**: 친구들과 그룹을 만들어 절약 대결(챌린지) 진행

**백엔드**
- [x] Group 모델 (`/backend/src/models/Group.js`)
  - `id, name, ownerId, startDate, endDate, goal(목표 지출 한도), createdAt, updatedAt`
- [x] GroupMember 모델 (`/backend/src/models/GroupMember.js`)
  - `id, groupId, userId, role(owner/member), status(pending/accepted), createdAt, updatedAt`
- [x] `POST /api/groups` - 그룹 생성 (친구 동시 초대 가능, 친구 관계 검증)
- [x] `GET /api/groups` - 내 그룹 목록
- [x] `GET /api/groups/invites` - 받은 그룹 초대 목록
- [x] `GET /api/groups/:id` - 그룹 상세 (멤버별 기간 내 지출 합계 포함)
- [x] `POST /api/groups/:id/invite` - 그룹에 친구 추가 초대
- [x] `PATCH /api/groups/invites/:inviteId/accept` - 초대 수락
- [x] `PATCH /api/groups/invites/:inviteId/reject` - 초대 거절
- [x] `DELETE /api/groups/:id/leave` - 그룹 탈퇴
- [x] `DELETE /api/groups/:id` - 그룹 삭제 (방장만)
- [x] `index.js`에 `/api/groups` 라우트 등록

**프론트엔드**
- [x] 그룹 페이지 (`/frontend/src/pages/GroupsPage.tsx`)
  - 내 그룹 탭: 카드 클릭 → 상세 모달 (절약 랭킹, 지출 바 차트, 목표달성 뱃지)
  - 받은 초대 탭: 수락/거절
  - 그룹 생성 모달: 이름/기간/목표금액/친구 초대 한번에
  - 그룹 상세 모달: 추가 초대, 그룹 삭제/탈퇴
- [x] `App.tsx`에 `/groups` 라우트 추가
- [x] 대시보드 Nav에 🏆 절약 대결 아이콘 버튼 추가

---

### 4단계: 더치페이 친구 연동 (완료)

**목표**: 더치페이 참여자 추가 시 이름 입력 대신 친구 목록에서 선택 가능하도록

**DB 변경**
- `dutch_pay_participants` 테이블에 `userId INT NULL` 컬럼 추가 (수동 ALTER 필요)
  ```sql
  ALTER TABLE coma_db.dutch_pay_participants ADD COLUMN userId INT NULL;
  ```

**백엔드**
- [x] DutchPayParticipant 모델에 `userId` 컬럼 추가 + User association
- [x] `createDutchPay`: participants를 `string[]` 대신 `{ name, userId? }[]`로 수신
- [x] `getDutchPays`: 참여자 조회 시 연결된 User 정보(id, nickname, profileImage) 포함

**프론트엔드**
- [x] `ParticipantEntry` 타입 정의 (`{ name: string; userId?: number }`)
- [x] 더치페이 생성 모달 UI 개선
  - 각 참여자 슬롯에 👥 버튼 추가 → 드롭다운에서 친구 선택
  - 친구 선택 시 보라색 chip으로 표시, ✕로 해제 가능
  - 이미 선택된 친구는 드롭다운에서 제외
  - 직접 입력과 친구 선택 혼용 가능

---

### 5단계: 카카오 공유하기 SDK 연동 (완료)

**목표**: 앱 초대 링크를 카카오톡으로 전송

**방식**: 카카오 JavaScript SDK `Kakao.Share.sendDefault()` 사용
- 비즈니스 심사 불필요, 사용자가 카카오 팝업에서 직접 받을 사람 선택

**사전 설정 필요 (개발자)**
1. 카카오 개발자 콘솔에서 JavaScript 키 확인
2. `frontend/.env`에 `VITE_KAKAO_JS_KEY=발급받은키` 추가
3. `VITE_APP_URL=배포된앱URL` 추가 (로컬은 http://localhost:5173)
4. 카카오 개발자 콘솔 > 앱 설정 > 플랫폼 > Web에 앱 URL 등록

**프론트엔드**
- [x] 카카오 JS SDK 로드 (`index.html` script 태그)
- [x] 유틸리티 파일 (`/frontend/src/lib/kakao.ts`)
  - `initKakao()` - SDK 초기화 (중복 호출 방지)
  - `shareInviteToFriend()` - 친구 초대 공유 (feed 템플릿)
  - `shareGroupInvite()` - 그룹 초대 공유 (그룹명/기간 포함)
- [x] 환경변수 추가 (`VITE_KAKAO_JS_KEY`, `VITE_APP_URL`)
- [x] 친구 페이지 - "카카오톡으로 초대 링크 보내기" 버튼 (검색 카드 하단)
- [x] 그룹 상세 모달 - "카카오톡으로 초대 링크 보내기" 버튼

-------------------
-------------------

-------------------
-------------------

## DB 변경사항 및 실행 쿼리 정리

> `sequelize.sync({ force: false })` 사용 중이므로 새 테이블/컬럼은 **자동 생성되지 않음**.
> 아래 쿼리를 MySQL에서 직접 실행해야 한다.

---

### 1단계 - DB 변경 없음

기존 `users` 테이블의 `nickname`, `profileImage` 컬럼을 그대로 활용.

---

### 2단계 - `friends` 테이블 신규 생성

```sql
CREATE TABLE IF NOT EXISTS friends (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  requesterId INT NOT NULL,
  receiverId  INT NOT NULL,
  status      ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requesterId) REFERENCES users(id),
  FOREIGN KEY (receiverId)  REFERENCES users(id)
);
```

---

### 3단계 - `groups`, `group_members` 테이블 신규 생성

```sql
CREATE TABLE IF NOT EXISTS `groups` (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  ownerId   INT NOT NULL,
  goal      INT NULL COMMENT '기간 내 목표 지출 한도(원)',
  startDate DATE NOT NULL,
  endDate   DATE NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS group_members (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  groupId   INT NOT NULL,
  userId    INT NOT NULL,
  role      ENUM('owner', 'member') NOT NULL DEFAULT 'member',
  status    ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (groupId) REFERENCES `groups`(id),
  FOREIGN KEY (userId)  REFERENCES users(id)
);
```

---

### 4단계 - `dutch_pay_participants` 테이블에 컬럼 추가

```sql
ALTER TABLE coma_db.dutch_pay_participants ADD COLUMN userId INT NULL;
```

---

### 5단계 - DB 변경 없음

카카오 공유하기 SDK는 프론트엔드만 수정. 백엔드/DB 변경 없음.

---

### 중복 인덱스 정리 (트러블슈팅)

`sequelize.sync({ alter: true })` 반복 실행으로 `users` 테이블에 중복 인덱스 64개 초과 발생 시:

```sql
-- 인덱스 현황 확인
SELECT INDEX_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'coma_db' AND TABLE_NAME = 'users'
ORDER BY COLUMN_NAME, INDEX_NAME;

-- 중복 인덱스 일괄 제거 (kakaoId, naverId, email 각각 _2~_21 제거)
ALTER TABLE coma_db.users
  DROP INDEX email_2,    DROP INDEX email_3,    DROP INDEX email_4,
  DROP INDEX email_5,    DROP INDEX email_6,    DROP INDEX email_7,
  DROP INDEX email_8,    DROP INDEX email_9,    DROP INDEX email_10,
  DROP INDEX email_11,   DROP INDEX email_12,   DROP INDEX email_13,
  DROP INDEX email_14,   DROP INDEX email_15,   DROP INDEX email_16,
  DROP INDEX email_17,   DROP INDEX email_18,   DROP INDEX email_19,
  DROP INDEX email_20,   DROP INDEX email_21,
  DROP INDEX kakaoId_2,  DROP INDEX kakaoId_3,  DROP INDEX kakaoId_4,
  DROP INDEX kakaoId_5,  DROP INDEX kakaoId_6,  DROP INDEX kakaoId_7,
  DROP INDEX kakaoId_8,  DROP INDEX kakaoId_9,  DROP INDEX kakaoId_10,
  DROP INDEX kakaoId_11, DROP INDEX kakaoId_12, DROP INDEX kakaoId_13,
  DROP INDEX kakaoId_14, DROP INDEX kakaoId_15, DROP INDEX kakaoId_16,
  DROP INDEX kakaoId_17, DROP INDEX kakaoId_18, DROP INDEX kakaoId_19,
  DROP INDEX kakaoId_20, DROP INDEX kakaoId_21,
  DROP INDEX naverId_2,  DROP INDEX naverId_3,  DROP INDEX naverId_4,
  DROP INDEX naverId_5,  DROP INDEX naverId_6,  DROP INDEX naverId_7,
  DROP INDEX naverId_8,  DROP INDEX naverId_9,  DROP INDEX naverId_10,
  DROP INDEX naverId_11, DROP INDEX naverId_12, DROP INDEX naverId_13,
  DROP INDEX naverId_14, DROP INDEX naverId_15, DROP INDEX naverId_16,
  DROP INDEX naverId_17, DROP INDEX naverId_18, DROP INDEX naverId_19,
  DROP INDEX naverId_20, DROP INDEX naverId_21;
```

> 이후 재발 방지를 위해 `index.js`의 sync 옵션을 `{ force: false }`로 변경 완료.

위 DB 관련 수정은 조원:이재호 의 로컬 PC 기준이며, 각 사용자의 로컬 환경 및 DB 상태에 따라 알맞은 수정 및 조언이 필요.

-------------------
-------------------



## 파일 구조 (주요)

```
coma-main/
├── backend/
│   ├── src/
│   │   ├── config/db.js              # MySQL Sequelize 설정
│   │   ├── middleware/auth.js        # JWT 인증 미들웨어
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Transaction.js
│   │   │   ├── DutchPay.js
│   │   │   └── DutchPayParticipant.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── transactionController.js
│   │   │   └── dutchPayController.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   └── dutchPays.js
│   │   └── index.js                  # 서버 엔트리포인트
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── AuthCallback.tsx
    │   │   ├── NaverCallback.tsx
    │   │   ├── DashboardPage.tsx     # 메인 대시보드 (1300+ lines)
    │   │   └── LandingPage.tsx
    │   └── services/api.ts           # Axios 클라이언트
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
VITE_KAKAO_JS_KEY     # 카카오 JS SDK 키 (5단계에서 추가 예정)
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
