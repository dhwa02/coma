# 가계부 메이트

지출 추적부터 친구와의 더치페이까지, 소셜 로그인 기반 가계부 웹 서비스입니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, React Router, Zustand |
| Backend | Node.js, Express 5, Sequelize ORM |
| Database | MySQL |
| 인증 | JWT (Cookie), 카카오 OAuth, 네이버 OAuth |

---

## 실행 전 요구 사항

- Node.js 18 이상
- MySQL 8.0 이상
- 카카오 개발자 앱 등록 및 REST API 키
- 네이버 개발자 앱 등록 및 Client ID / Secret

---

## 1. 의존성 설치

```bash
# 백엔드
cd backend
npm install

# 프론트엔드
cd ../frontend
npm install
```

---

## 2. MySQL 데이터베이스 및 사용자 생성

MySQL에 root 또는 관리자 계정으로 접속한 뒤 아래 SQL을 실행합니다.

```sql
-- 데이터베이스 생성
CREATE DATABASE coma_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 전용 사용자 생성 및 권한 부여
CREATE USER 'coma_user'@'localhost' IDENTIFIED BY '비밀번호를_입력하세요';
GRANT ALL PRIVILEGES ON coma_db.* TO 'coma_user'@'localhost';
FLUSH PRIVILEGES;
```

> 테이블(`users`, `transactions`)은 서버 최초 실행 시 Sequelize가 자동으로 생성합니다.

---

## 3. 소셜 로그인 앱 등록

### 카카오

1. [카카오 개발자 콘솔](https://developers.kakao.com)에서 애플리케이션 추가
2. **앱 키 > REST API 키** 복사
3. **카카오 로그인 > 활성화** ON
4. **Redirect URI** 등록: `http://localhost:5173/auth/callback`
5. **동의항목**: 닉네임, 프로필 사진, 이메일(선택) 설정

-> 동화 API 키 활용

### 네이버

1. [네이버 개발자 센터](https://developers.naver.com)에서 애플리케이션 등록
2. 사용 API: **네아로(네이버 아이디로 로그인)** 선택
3. **서비스 URL**: `http://localhost:5173`
4. **Callback URL** 등록: `http://localhost:5173/auth/naver/callback`
5. **Client ID**와 **Client Secret** 복사

-> 재호 API 키 활용

---

## 4. 환경 변수 설정

### 백엔드 (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

`backend/.env`를 열어 아래 항목을 채웁니다.

```dotenv
# 서버
NODE_ENV=development
PORT=4000

# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_NAME=coma_db
DB_USER=coma_user
DB_PASSWORD=비밀번호를_입력하세요

# JWT (임의의 긴 문자열로 설정)
JWT_SECRET=여기에_랜덤_시크릿_키_입력
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=여기에_다른_랜덤_시크릿_키_입력
JWT_REFRESH_EXPIRES_IN=30d

# 카카오 OAuth
KAKAO_REST_API_KEY=카카오_REST_API_키
KAKAO_CLIENT_SECRET=카카오_Client_Secret_키_(없으면_빈칸)
KAKAO_REDIRECT_URI=http://localhost:5173/auth/callback

# 네이버 OAuth
NAVER_CLIENT_ID=네이버_Client_ID
NAVER_CLIENT_SECRET=네이버_Client_Secret
NAVER_REDIRECT_URI=http://localhost:5173/auth/naver/callback

# CORS
CLIENT_URL=http://localhost:5173
```

### 프론트엔드 (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

`frontend/.env` 내용 (기본값 그대로 사용 가능):

```dotenv
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

---

## 5. 서버 실행

터미널을 **두 개** 열고 각각 실행합니다.

**터미널 1 — 백엔드**
```bash
cd backend
npm run dev
```

정상 실행 시 출력:
```
DB 연결 성공
서버 실행 중: http://localhost:4000
```

**터미널 2 — 프론트엔드**
```bash
cd frontend
npm run dev
```

정상 실행 시 출력:
```
VITE v6.x.x  ready in ...ms
➜  Local:   http://localhost:5173/
```

---

## 6. 서비스 확인

1. 브라우저에서 `http://localhost:5173` 접속
2. 랜딩 페이지 확인 후 **로그인** 클릭
3. **카카오 로그인** 또는 **네이버 로그인** 버튼으로 소셜 인증 진행
4. 인증 완료 후 대시보드로 이동
5. **+** 버튼을 눌러 거래 내역 추가 확인

백엔드 헬스 체크: `http://localhost:4000/health` → `{"status":"ok"}`

---

## 프로젝트 구조

```
coma-main/
├── backend/
│   ├── src/
│   │   ├── config/       # DB 연결 설정
│   │   ├── controllers/  # 인증, 거래 내역 컨트롤러
│   │   ├── middleware/   # JWT 인증 미들웨어
│   │   ├── models/       # User, Transaction 모델
│   │   ├── routes/       # API 라우터
│   │   └── index.js      # 서버 진입점
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── assets/
    │   ├── pages/        # 각 페이지 컴포넌트
    │   └── services/     # API 호출 모듈
    ├── .env.example
    └── package.json
```
