# COMA 프로젝트 단위 테스트 문서

> 작성일: 2026-05-18  
> 대상 브랜치: main

---

## 1. 버그 수정 내역

### BUG 1 — `groupController.js` 친구가 아닌 사람에게 초대 알림 발송 (심각)

**파일:** `backend/src/controllers/groupController.js`

**문제:**  
그룹 생성 시 초대 대상을 친구 관계로 검증해서 `validIds`만 `GroupMember`에 추가하지만,  
알림 발송 루프는 검증 전 원본 배열인 `inviteeIds`를 사용하고 있었다.  
결과적으로 친구가 아닌 사람도 그룹 초대 알림을 수신할 수 있었다.  
또한 `validIds`가 `if` 블록 내부에 `const`로 선언되어 블록 밖에서 참조 시 ReferenceError가 발생하는 문제도 함께 수정했다.

**수정 전:**
```js
if (inviteeIds.length > 0) {
  const validIds = new Set(...); // if 블록 안에서만 유효
  // ...
}

// 알림을 inviteeIds 전체에 발송 (친구 아닌 사람 포함)
for (const uid of inviteeIds) {
  await createNotification(io, { userId: uid, type: 'group_invite', ... });
}
```

**수정 후:**
```js
let validIds = new Set(); // 블록 밖에서 선언
if (inviteeIds.length > 0) {
  validIds = new Set(...); // 친구 관계 검증 후 채움
  // ...
}

// 실제 초대된 validIds에게만 발송
if (validIds.size > 0) {
  for (const uid of validIds) {
    await createNotification(io, { userId: uid, type: 'group_invite', ... });
  }
}
```

---

### BUG 2 — `friendController.js` 거절된 친구 요청 재전송 시 알림 미발송 (중간)

**파일:** `backend/src/controllers/friendController.js`

**문제:**  
`status === 'rejected'` 상태의 친구 요청을 재전송할 때 early return 전에 알림 발송 코드가 없었다.  
알림 발송 코드는 신규 요청(`Friend.create`) 경로에만 존재해서,  
재전송의 경우 수신자가 친구 요청이 왔는지 알 수 없었다.

**수정 전:**
```js
if (existing.status === 'rejected') {
  existing.status = 'pending';
  await existing.save();
  return res.status(201).json({ message: '친구 요청을 다시 보냈습니다.' });
  // ↑ 여기서 반환 → 아래 알림 발송 코드에 도달 안 함
}
// 신규 요청 경로에만 알림 발송
await createNotification(io, { userId: receiverId, type: 'friend_request', ... });
```

**수정 후:**
```js
if (existing.status === 'rejected') {
  existing.status = 'pending';
  await existing.save();
  const io = req.app.locals.io;
  await createNotification(io, {    // ← 반환 전에 알림 발송 추가
    userId: receiverId,
    type: 'friend_request',
    message: `${req.user.nickname}님이 친구 요청을 보냈습니다.`,
    referenceId: existing.id,
  });
  return res.status(201).json({ message: '친구 요청을 다시 보냈습니다.' });
}
```

---

### BUG 3 — `dutchPayController.js` createDutchPay DB 트랜잭션 미사용 (중간)

**파일:** `backend/src/controllers/dutchPayController.js`

**문제:**  
`createDutchPay`는 내부적으로 여러 개의 DB 레코드를 순차 생성한다.

1. 대표 지출자 `Transaction` 생성
2. `DutchPay` 생성
3. 참여자 수만큼 `Transaction` 생성 (루프)
4. `DutchPayParticipant` bulkCreate

Sequelize 트랜잭션 없이 실행하므로, 중간 단계에서 실패하면  
앞서 성공한 레코드들이 DB에 고아 상태로 남는다.  
(예: 루프 도중 실패 → 지출자 Transaction + DutchPay 고아 레코드 잔존)  
`createGroup`은 Sequelize 트랜잭션을 올바르게 사용하고 있었으나 `createDutchPay`만 누락되어 있었다.

**수정 전:**
```js
try {
  await Transaction.create({ ... });           // 트랜잭션 없음
  await DutchPay.create({ ... });              // 트랜잭션 없음
  for (...) { await Transaction.create(...); } // 트랜잭션 없음
  await DutchPayParticipant.bulkCreate(...);   // 트랜잭션 없음
} catch (err) {
  res.status(500).json({ message: '등록 실패' }); // 롤백 없음
}
```

**수정 후:**
```js
const t = await sequelize.transaction();
try {
  await Transaction.create({ ... }, { transaction: t });
  await DutchPay.create({ ... }, { transaction: t });
  for (...) { await Transaction.create(..., { transaction: t }); }
  await DutchPayParticipant.bulkCreate(..., { transaction: t });
  await t.commit();
} catch (err) {
  await t.rollback(); // 모든 레코드 원자적 롤백
  res.status(500).json({ message: '등록 실패' });
}
```

---

## 2. 단위 테스트 목록

> 권장 프레임워크: 백엔드 **Jest + Supertest**, 프론트엔드 **Vitest + React Testing Library**

---

### 2-1. `transactionController` 테스트

| ID | 테스트 케이스 | 검증 포인트 | 예상 결과 |
|----|---|---|---|
| T1 | 년/월 쿼리 파라미터로 거래 내역 조회 | 해당 기간 데이터만 반환 | 기간 외 데이터 미포함 |
| T2 | 필수 항목(`type`, `amount`, `category`, `date`) 누락 시 등록 | 유효성 검사 | `400` 반환 |
| T3 | `excludedGroupIds` 빈 배열(`[]`) 전달 시 등록 | 빈 배열은 null로 저장 | DB에 `null` 저장 확인 |
| T4 | 다른 유저의 거래 내역 수정 시도 | `userId` 기반 소유권 격리 | `404` 반환 |
| T5 | 다른 유저의 거래 내역 삭제 시도 | `userId` 기반 소유권 격리 | `404` 반환 |
| T6 | 존재하지 않는 거래 내역 ID 수정 | Not Found 처리 | `404` 반환 |

---

### 2-2. `dutchPayController` 테스트

| ID | 테스트 케이스 | 검증 포인트 | 예상 결과 |
|----|---|---|---|
| D1 | 참여자 수 1명으로 더치페이 생성 시도 | 최소 참여자 2명 제한 | `400` 반환 |
| D2 | 총액과 참여자 수로 분배 금액 검증 | `Math.ceil(totalAmount / count)` 적용 | 계산값 일치 |
| D3 | 대표 지출자(isPayer) 슬롯 `paid` 토글 시도 | 지출자 슬롯 보호 | `400` 반환 |
| D4 | 생성자도 해당 참여자도 아닌 유저가 `paid` 토글 | 권한 검사 | `403` 반환 |
| D5 | 정산 완료 시 지출자 거래내역 금액 업데이트 | `totalAmount - paidByOthers` 반영 | 금액 감소 확인 |
| D6 | 더치페이 삭제 시 연결된 Transaction 동반 삭제 | 고아 레코드 방지 | 관련 Transaction 전부 삭제 |
| D7 | 내가 참여자인 더치페이 조회 | 생성자 + 참여자 모두 반환 | 양쪽 모두 포함 |
| D8 | 중간 오류 발생 시 트랜잭션 롤백 (BUG 3 검증) | 원자성 보장 | 고아 레코드 미생성 |

---

### 2-3. `groupController` 테스트

| ID | 테스트 케이스 | 검증 포인트 | 예상 결과 |
|----|---|---|---|
| G1 | 종료일이 시작일보다 앞선 그룹 생성 | 날짜 유효성 검사 | `400` 반환 |
| G2 | 친구가 아닌 ID 포함해서 초대 시 멤버 등록 | `validIds`만 `GroupMember` 추가 | 친구 아닌 유저 미등록 |
| G3 | 친구가 아닌 ID에게 초대 알림 발송 여부 (BUG 1 검증) | 실제 초대된 멤버에게만 알림 | 비친구 알림 미발송 |
| G4 | 그룹 멤버가 아닌 유저의 그룹 상세 조회 | 멤버십 검증 | `403` 반환 |
| G5 | 그룹장이 탈퇴 시도 | 그룹장 탈퇴 불가 | `400` 반환 |
| G6 | 그룹장이 아닌 유저가 그룹 삭제 시도 | 삭제 권한 검사 | `403` 반환 |
| G7 | `computeGroupRanking` — `excludedGroupIds` 필터 | 제외 설정된 그룹 ID의 거래 미포함 | 합산에서 제외 확인 |
| G8 | `computeGroupRanking` — `categories` null | 전체 카테고리 집계 | 카테고리 필터 미적용 |
| G9 | `computeGroupRanking` — `categories` 지정 | 해당 카테고리만 합산 | 다른 카테고리 미포함 |
| G10 | 초대 수락: 본인 초대가 아닌 경우 | 수락 권한 검사 | `403` 반환 |
| G11 | 이미 처리된 초대(pending 아닌) 재수락 시도 | 상태 검사 | `400` 반환 |

---

### 2-4. `friendController` 테스트

| ID | 테스트 케이스 | 검증 포인트 | 예상 결과 |
|----|---|---|---|
| F1 | 자기 자신에게 친구 요청 | 자기 자신 요청 금지 | `400` 반환 |
| F2 | 이미 친구인 상태에서 재요청 | 중복 요청 방지 | `409` 반환 |
| F3 | `pending` 상태에서 재요청 | 중복 요청 방지 | `409` 반환 |
| F4 | `rejected` 상태에서 재요청 후 알림 발송 (BUG 2 검증) | 수신자 알림 발송 확인 | `201` + 알림 생성 |
| F5 | 수신자가 아닌 유저가 친구 요청 수락 | 수락 권한 검사 | `403` 반환 |
| F6 | `pending` 아닌 요청 수락/거절 시도 | 상태 검사 | `400` 반환 |
| F7 | 관계 없는 유저가 친구 삭제 시도 | 삭제 권한 검사 | `403` 반환 |
| F8 | 친구 목록 조회 — requester와 receiver 양방향 | 양방향 조회 정확성 | 양쪽 다 포함 |

---

---

### 2-6. `authMiddleware` 테스트

| ID | 테스트 케이스 | 검증 포인트 | 예상 결과 |
|----|---|---|---|
| A1 | 토큰 없는 요청 | 인증 필수 검사 | `401` 반환 |
| A2 | 만료된 JWT 토큰 | 토큰 유효성 검사 | `401` 반환 |
| A3 | 위조된 JWT 토큰 | 서명 검증 | `401` 반환 |
| A4 | 유효한 JWT — 쿠키(`accessToken`) 방식 | `req.user` 세팅 후 `next()` 호출 | 다음 미들웨어 진입 |
| A5 | 유효한 JWT — `Authorization: Bearer` 헤더 방식 | 헤더 파싱 정확성 | 다음 미들웨어 진입 |

---

## 3. 테스트 환경 설정 가이드

### 백엔드 (Jest + Supertest)

```bash
# 테스트 실행 (backend/package.json scripts에 추가 필요)
cd backend && npm install --save-dev jest
# 필요하다면
npm audit fix
```


## 4. 테스트 우선순위

| 우선순위 | 테스트 ID | 이유 |
|----------|-----------|------|
| **P0** | D8, G3, F4 | 수정된 버그 회귀 방지 (BUG 1, 2, 3 검증) |
| **P1** | A1~A5, T4, T5, G4, G6, F5, F7 | 인증·인가 관련 — 보안 직결 |
| **P2** | D1~D7, G1, G2, G7~G9 | 핵심 비즈니스 로직 |
| **P3** | T1, T3, T6, F1~F3, F6, F8, G5, G10, G11 | 부가 기능 및 엣지 케이스 |

---

## 5. 작성된 테스트 파일 목록

테스트 코드는 `backend/src/__tests__/` 폴더에 위치한다.

| 파일명 | 커버하는 테스트 ID | 비고 |
|--------|-------------------|------|
| `setup.js` | — | JWT_SECRET 등 테스트용 환경변수 설정 (setupFiles) |
| `authMiddleware.test.js` | A1 ~ A5 | supertest + 미니 Express 앱 사용, DB 불필요 |
| `transactionController.test.js` | T1 ~ T6 | 모델 mock, 컨트롤러 함수 직접 호출 |
| `dutchPayController.test.js` | D1 ~ D8 | 모델 + sequelize.transaction() mock |
| `groupController.test.js` | G1 ~ G11 | 모델 + computeGroupRanking 직접 테스트 포함 |
| `friendController.test.js` | F1 ~ F8 | 모델 mock, BUG 2 회귀 테스트 포함 |
| `notificationController.test.js` | N1 ~ N5 | 모델 mock, io.emit 호출 검증 포함 |

설정 파일:

| 파일명 | 역할 |
|--------|------|
| `backend/jest.config.js` | Jest 설정 (testMatch, setupFiles, timeout) |

---

## 6. 테스트 실행 방법

```bash
# backend 폴더에서 실행
cd backend

# 전체 테스트 실행
npm test

# 특정 파일만 실행
npx jest friendController

# 결과 상세 출력
npm run test:verbose

# 파일 변경 감지 후 자동 재실행
npm run test:watch
```

**테스트 구조 요약:**
- DB 연결 없이 실행 가능 (모든 Sequelize 모델을 jest.mock으로 대체)
- `authMiddleware.test.js`만 supertest 사용, 나머지는 컨트롤러 함수 직접 호출
- 각 테스트 파일은 `beforeEach`에서 `jest.clearAllMocks()`로 독립성 보장


**Test code file 요약:**
작성된 파일 목록

  backend/
  ├── jest.config.js                         ← Jest 설정
  └── src/__tests__/
      ├── setup.js                           ← 테스트용 환경변수
      ├── authMiddleware.test.js             ← A1~A5 (supertest)
      ├── transactionController.test.js      ← T1~T6
      ├── dutchPayController.test.js         ← D1~D8 (BUG 3 롤백 검증    
  포함)
      ├── groupController.test.js            ← G1~G11 (BUG 1 검증 포함)  
      ├── friendController.test.js           ← F1~F8 (BUG 2 검증 포함)   
      └── notificationController.test.js     ← N1~N5