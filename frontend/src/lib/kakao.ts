declare global {
  interface Window {
    Kakao: any;
  }
}

let initialized = false;

export function initKakao() {
  if (initialized || !window.Kakao) return;
  const key = import.meta.env.VITE_KAKAO_JS_KEY;
  if (!key || key === 'your_kakao_javascript_key_here') return;
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(key);
  }
  initialized = true;
}

interface ShareFriendParams {
  inviterNickname: string;
}

export function shareInviteToFriend({ inviterNickname }: ShareFriendParams) {
  initKakao();
  if (!window.Kakao?.isInitialized()) {
    alert('카카오 SDK가 초기화되지 않았습니다. VITE_KAKAO_JS_KEY를 설정해주세요.');
    return;
  }

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${inviterNickname}님이 COMA에 초대했습니다`,
      description: '친구와 함께 더치페이, 절약 대결을 시작해보세요!',
      imageUrl: 'https://via.placeholder.com/800x400?text=COMA',
      link: {
        mobileWebUrl: appUrl,
        webUrl: appUrl,
      },
    },
    buttons: [
      {
        title: 'COMA 시작하기',
        link: {
          mobileWebUrl: appUrl,
          webUrl: appUrl,
        },
      },
    ],
  });
}

interface ShareGroupParams {
  inviterNickname: string;
  groupName: string;
  startDate: string;
  endDate: string;
}

export function shareGroupInvite({ inviterNickname, groupName, startDate, endDate }: ShareGroupParams) {
  initKakao();
  if (!window.Kakao?.isInitialized()) {
    alert('카카오 SDK가 초기화되지 않았습니다. VITE_KAKAO_JS_KEY를 설정해주세요.');
    return;
  }

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const fmt = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `${inviterNickname}님의 절약 대결 초대`,
      description: `"${groupName}" · ${fmt(startDate)} ~ ${fmt(endDate)}\nCOMA에서 절약 대결을 함께 해요!`,
      imageUrl: 'https://via.placeholder.com/800x400?text=COMA',
      link: {
        mobileWebUrl: `${appUrl}/groups`,
        webUrl: `${appUrl}/groups`,
      },
    },
    buttons: [
      {
        title: '대결 참여하기',
        link: {
          mobileWebUrl: `${appUrl}/groups`,
          webUrl: `${appUrl}/groups`,
        },
      },
    ],
  });
}
