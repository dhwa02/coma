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
```

> DB 관련 수정은 조원 이재호의 로컬 PC 기준이며, 각 사용자의 로컬 환경 및 DB 상태에 따라 알맞은 수정 필요.

---

## 주요 변경 파일 (최근)

### 백엔드

| 파일 | 변경 내용 |
|------|-----------|
| `controllers/authController.js` | `devLogin` 핸들러 추가 (`findOrCreate`로 중복 방지) |
| `routes/auth.js` | `POST /dev-login` 라우트 추가 |
| `models/Group.js` | `categories: JSON` 컬럼 추가 |
| `models/Transaction.js` | `excludeFromChallenge` 제거 → `excludedGroupIds: JSON` 추가 |
| `models/DutchPayParticipant.js` | `userId: INT NULL`, `linkedTransactionId: INT NULL` 추가 |
| `controllers/groupController.js` | 그룹 생성 시 `categories` 저장; 지출 집계에 `JSON_CONTAINS` + 카테고리 필터 적용 |
| `controllers/transactionController.js` | `excludedGroupIds` 저장/수정 지원 |
| `controllers/dutchPayController.js` | `getDutchPays`: 참여자 기준 조회 추가; `createDutchPay`: 전원 트랜잭션 생성; `deleteDutchPay`: 참여자 트랜잭션 일괄 삭제; `togglePaid`: 생성자 또는 본인만 가능 |

### 프론트엔드

| 파일 | 변경 내용 |
|------|-----------|
| `pages/LoginPage.tsx` | 하단에 임시 개발용 로그인 버튼 추가 |
| `pages/LoginPage.css` | `.login-dev-btn` 스타일 추가 |
| `pages/GroupsPage.tsx` | 그룹 생성 모달에 카테고리 선택 UI 추가; 그룹 상세에 선택 카테고리 표시; UI 텍스트 "그룹" → "챌린지" 전면 변경 |
| `pages/GroupsPage.css` | `.gr-all-cat-toggle`, `.gr-cat-grid`, `.gr-cat-chip` 스타일 추가 |
| `pages/DashboardPage.tsx` | 아래 항목 참조 |
| `pages/DashboardPage.css` | 아래 항목 참조 |

#### DashboardPage.tsx 주요 변경사항
- `Transaction` 인터페이스에 `excludedGroupIds: number[] | null` 추가
- `DutchPayParticipant` 인터페이스에 `userId`, `linkedTransactionId` 추가
- `DutchPay` 인터페이스에 `userId: number` 추가
- 거래 내역 추가/수정 모달: 진행 중인 챌린지 포함 여부 체크박스 (기본 체크)
- 친구 요청 / 그룹 초대 30초 폴링 + 네비게이션 뱃지 표시
- `DutchPayCreateModal`: 내가 기본 첫 번째 참여자로 포함; 왕관(👑) 버튼으로 대표 지출자 선택; 카테고리 항상 표시
- `DutchPayView`: 친구가 참여자인 더치페이 표시; "(나)" 라벨; 생성자/본인만 삭제·체크 가능
- 거래 내역 정산 상태 표시 수정:
  - 비지출자 미정산 → **"정산 필요"** + 금액 주황색
  - 비지출자 정산 완료 → **"정산 완료"**
  - 대표 지출자 전원 미입금 → **"정산 중"**
  - 대표 지출자 전원 입금 → **"정산 완료"**
- 더치페이 카드 전체 클릭으로 펼치기/접기 (내부 버튼 `stopPropagation` 처리)
- `DutchPayView`에 더치페이 상세 보기 내 **챌린지 포함 설정 UI** 추가:
  - `transactions`, `activeGroups` prop 추가
  - 카드 펼칠 때 현재 유저의 연결 트랜잭션 `excludedGroupIds`를 `excludedMap` 로컬 상태로 초기화
  - 대표 지출자는 `DutchPay.linkedTransactionId`, 비지출자는 `DutchPayParticipant.linkedTransactionId` 기준 적용
  - 더치페이 카테고리와 매칭되는 진행 중 챌린지만 표시, 체크 = 포함 (기본값)
  - 토글 시 `PUT /api/transactions/:id`로 `excludedGroupIds` 즉시 저장
  - 연결 트랜잭션 없거나 매칭 챌린지 없으면 섹션 미표시

#### DashboardPage.css 주요 추가 스타일
- `.db-nav-icon-wrap`, `.db-nav-badge` — 네비게이션 알림 뱃지 (빨간 점)
- `.db-challenge-list`, `.db-challenge-item`, `.db-challenge-item.included` — 챌린지 포함 체크박스
- `.dutch-me-label`, `.dutch-payer-crown-btn`, `.dutch-payer-crown-btn.active` — 더치페이 UI
- `.db-tx-amount.needs-settlement` — 정산 필요 금액 주황색 (`#e07a00`)
- `.dutch-challenge-section`, `.dutch-challenge-label`, `.dutch-challenge-list`, `.dutch-challenge-item` — 더치페이 챌린지 포함 설정 UI (다크모드 대응: `--surface`, `--text1/2`, `--accent`, `--border` 변수 사용)

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
│   │   │   └── Friend.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── transactionController.js
│   │   │   ├── dutchPayController.js
│   │   │   ├── groupController.js
│   │   │   └── friendController.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   ├── dutchPays.js
│   │   │   ├── groups.js
│   │   │   └── friends.js
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
