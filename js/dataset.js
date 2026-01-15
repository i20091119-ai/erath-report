// js/dataset.js
export const ISSUE_KEYS = {
  climate_change: "기후변화 문제",
  ecosystem_damage: "생태계 파괴 문제",
  resource_energy: "자원 및 에너지 문제",
  refugees: "난민 문제"
};

export function flagUrlFromCode(c) {
  return `https://flagcdn.com/w80/${String(c).toLowerCase()}.png`;
}

export const COUNTRY_BUTTONS = {
  climate_change: [
    { countryKo: "투발루", countryEn: "Tuvalu", flagCode: "tv" },
    { countryKo: "몰디브", countryEn: "Maldives", flagCode: "mv" },
    { countryKo: "스페인", countryEn: "Spain", flagCode: "es" },
    { countryKo: "호주", countryEn: "Australia", flagCode: "au" },
    { countryKo: "캐나다", countryEn: "Canada", flagCode: "ca" },
    { countryKo: "방글라데시", countryEn: "Bangladesh", flagCode: "bd" },
    { countryKo: "네덜란드", countryEn: "Netherlands", flagCode: "nl" },
    { countryKo: "필리핀", countryEn: "Philippines", flagCode: "ph" }
  ],
  ecosystem_damage: [
    { countryKo: "브라질", countryEn: "Brazil", flagCode: "br" },
    { countryKo: "인도네시아", countryEn: "Indonesia", flagCode: "id" },
    { countryKo: "호주", countryEn: "Australia", flagCode: "au" },
    { countryKo: "필리핀", countryEn: "Philippines", flagCode: "ph" },
    { countryKo: "코스타리카", countryEn: "Costa Rica", flagCode: "cr" },
    { countryKo: "마다가스카르", countryEn: "Madagascar", flagCode: "mg" },
    { countryKo: "케냐", countryEn: "Kenya", flagCode: "ke" },
    { countryKo: "중국", countryEn: "China", flagCode: "cn" }
  ],
  resource_energy: [
    { countryKo: "노르웨이", countryEn: "Norway", flagCode: "no" },
    { countryKo: "러시아", countryEn: "Russia", flagCode: "ru" },
    { countryKo: "캐나다", countryEn: "Canada", flagCode: "ca" },
    { countryKo: "독일", countryEn: "Germany", flagCode: "de" },
    { countryKo: "프랑스", countryEn: "France", flagCode: "fr" },
    { countryKo: "일본", countryEn: "Japan", flagCode: "jp" },
    { countryKo: "중국", countryEn: "China", flagCode: "cn" },
    { countryKo: "칠레", countryEn: "Chile", flagCode: "cl" }
  ],
  refugees: [
    { countryKo: "시리아", countryEn: "Syria", flagCode: "sy" },
    { countryKo: "우크라이나", countryEn: "Ukraine", flagCode: "ua" },
    { countryKo: "아프가니스탄", countryEn: "Afghanistan", flagCode: "af" },
    { countryKo: "터키", countryEn: "Türkiye", flagCode: "tr" },
    { countryKo: "독일", countryEn: "Germany", flagCode: "de" },
    { countryKo: "요르단", countryEn: "Jordan", flagCode: "jo" },
    { countryKo: "캐나다", countryEn: "Canada", flagCode: "ca" },
    { countryKo: "레바논", countryEn: "Lebanon", flagCode: "lb" }
  ]
};

function link(t, u) { return { title: t, url: u }; }

// [수정] 내 컴퓨터의 assets/images 폴더를 가리킴
function img(filename, c = "선생님 제공 자료") { 
  return { 
    commonsUrl: `./assets/images/${filename}`, 
    credit: c, 
    license: "" 
  }; 
}

export const REF_DATA = {
  // 1. 기후변화 (1_국가명.jpg)
  climate_change: {
    "투발루": { 
      topic: "해수면 상승과 섬나라의 위기", 
      sources: [link("연합뉴스-투발루 존폐", "https://www.yna.co.kr/view/AKR20230514044600504")], 
      news: [link("기후난민 이주", "https://www.hankyung.com/article/202311108208Y")], 
      images: [img("1_tuvalu.jpg")] 
    },
    "몰디브": { 
      topic: "해수면 상승과 관광·주거 영향", 
      sources: [link("몰디브 침몰 위기", "https://blog.naver.com/greenstartkr/221754245916")], 
      news: [link("몰디브는 침몰 중인가", "https://www.chosun.com/national/weekend/2025/04/12/OFWHPE36KRDYJLGU5Q37ZI5CGY/")], 
      images: [img("1_maldives.jpg")] 
    },
    "스페인": { 
      topic: "폭염·가뭄·산불 위험 증가", 
      sources: [link("유럽 폭염과 산불", "https://www.hani.co.kr/arti/society/environment/1219666.html")], 
      news: [link("스페인 산불 피해", "https://www.donga.com/news/Inter/article/all/20250820/132218910/1")], 
      images: [img("1_spain.jpg")] 
    },
    "호주": { 
      topic: "산불과 기후변화의 연관", 
      sources: [link("호주 산불 팩트체크", "https://www.greenpeace.org/korea/update/11560/blog-ce-australia-bushfire-fact/")], 
      news: [link("기후 재앙 논쟁", "https://h21.hani.co.kr/arti/world/world/48100.html")], 
      images: [img("1_australia.jpg")] 
    },
    "캐나다": { 
      topic: "기후 재난(폭염·산불)", 
      sources: [link("캐나다 산불 피해", "https://news.kbs.co.kr/news/view.do?ncd=8040211")], 
      news: [link("온난화와 산불", "https://www.yna.co.kr/view/AKR20240820132900017")], 
      images: [img("1_canada.jpg")] 
    },
    "방글라데시": { 
      topic: "홍수·침수 위험과 기후난민", 
      sources: [link("기후난민 10만명", "https://www.hani.co.kr/arti/international/international_general/390971.html")], 
      news: [link("자연의 경고 현장", "https://www.donga.com/news/Inter/article/all/20100410/27479985/1")], 
      images: [img("1_bangladesh.jpg")] 
    },
    "네덜란드": { 
      topic: "해수면 상승 대응(방재)", 
      sources: [link("네덜란드의 물 관리", "https://dream.kotra.or.kr/user/extra/kotranews/bbs/linkView/jsp/Page.do?dataIdx=216366")], 
      news: [link("가뭄 대비", "https://www.yna.co.kr/view/AKR20221012143300009")], 
      images: [img("1_netherlands.jpg")] 
    },
    "필리핀": { 
      topic: "태풍·집중호우 증가", 
      sources: [link("태풍 하이옌", "https://www.mk.co.kr/news/it/5786917")], 
      news: [link("기후 정의와 책임", "https://climateaction.re.kr/?mid=news03&document_srl=156068")], 
      images: [img("1_philippines.jpg")] 
    }
  },
  
  // 2. 생태계 파괴 (2_국가명.jpg)
  ecosystem_damage: {
    "브라질": { 
      topic: "아마존 열대우림 훼손", 
      sources: [link("아마존 불법 광업", "https://www.khan.co.kr/article/202305021619001")], 
      news: [link("개발 vs 보전", "https://www.chosun.com/kid/kid_nie/kid_upper-grades/2025/11/10/BGEK4WT6DZHMVDX7BWWPFOEHFY/")], 
      images: [img("2_brazil.jpg")] 
    },
    "인도네시아": { 
      topic: "열대우림 감소와 산림 훼손", 
      sources: [link("원시림 파괴", "https://apil.or.kr/news/9946")], 
      news: [link("연무 갈등", "https://www.hankyung.com/article/202103230209Q")], 
      images: [img("2_indonesia.jpg")] 
    },
    "호주": { 
      topic: "산호초 백화(대보초)", 
      sources: [link("대보초 백화 현상", "https://www.hani.co.kr/arti/international/asiapacific/1211896.html")], 
      news: [link("죽어가는 산호초", "https://www.hani.co.kr/arti/society/environment/801158.html")], 
      images: [img("2_australia.jpg")] 
    },
    "필리핀": { 
      topic: "해양 생태계(산호초) 훼손", 
      sources: [link("다이빙 성지 폐쇄", "https://news.kbs.co.kr/news/view.do?ncd=8053171")], 
      news: [link("산호초 훼손 낙서", "https://news.sbs.co.kr/news/endPage.do?news_id=N1007789777")], 
      images: [img("2_philippines.jpg")] 
    },
    "코스타리카": { 
      topic: "생태계 복원 모범 사례", 
      sources: [link("생태관광의 나라", "https://www.hankookilbo.com/News/Read/201606152088178357")], 
      news: [link("경제성장과 생태보전", "https://www.khan.co.kr/article/200904131814155")], 
      images: [img("2_costarica.jpg")] 
    },
    "마다가스카르": { 
      topic: "고유 생물다양성 파괴", 
      sources: [link("생물다양성 핫스팟", "http://biowebzine.com/webzine/vol02/sub08.html")], 
      news: [link("바오밥나무 보호", "https://www.hankyung.com/article/202008251632Y")], 
      images: [img("2_madagascar.jpg")] 
    },
    "케냐": { 
      topic: "사바나 생태계 보전", 
      sources: [link("자연의 역습", "https://www.hani.co.kr/arti/international/arabafrica/172819.html")], 
      news: [link("가뭄과 야생동물", "https://www.yna.co.kr/view/AKR20220729043200009")], 
      images: [img("2_kenya.jpg")] 
    },
    "중국": { 
      topic: "사막화와 조림 사업", 
      sources: [link("숲의 장성", "https://www.korea.kr/news/policyNewsView.do?newsId=135088853")], 
      news: [link("남중국해 생태 갈등", "https://www.hankookilbo.com/News/Read/A2023092117470000028")], 
      images: [img("2_china.jpg")] 
    }
  },
  
  // 3. 자원 및 에너지 (3_국가명.jpg)
  resource_energy: {
    "노르웨이": { 
      topic: "북극해 항로와 자원", 
      sources: [link("북극해 협력", "https://ctis.re.kr/board.es?mid=a10101010200&bid=0001&tag=&act=view&list_no=639")], 
      news: [link("에너지 패권 경쟁", "https://plus.hankyung.com/apps/newsinside.view?date=20250611&face=A001&orgId=YJA0000003146510")], 
      images: [img("3_norway.png")] 
    },
    "러시아": { 
      topic: "북극 자원과 북동항로", 
      sources: [link("북극항로 전략", "https://www.hankyung.com/article/202506091669i")], 
      news: [link("패권 경쟁", "https://mbnmoney.mbn.co.kr/news/view?news_no=MM1005718106")], 
      images: [img("3_russia.jpg")] 
    },
    "캐나다": { 
      topic: "북극 자원과 북서항로", 
      sources: [link("북극 공동연구", "https://www.korea.kr/news/policyNewsView.do?newsId=148733272")], 
      news: [link("활용과 보호", "https://www.korea.kr/news/policyNewsView.do?newsId=148765915")], 
      images: [img("3_canada.jpg")] 
    },
    "독일": { 
      topic: "에너지 전환과 재생에너지", 
      sources: [link("에너지전환 실적", "https://www.energytransitionkorea.org/energypress/?bmode=view&idx=169090677")], 
      news: [link("탈탄소화 계획", "https://ssirkorea.org/sector/?bmode=view&idx=43753725")], 
      images: [img("3_germany.jpg")] 
    },
    "프랑스": { 
      topic: "원자력 발전 정책", 
      sources: [link("원전 비중 70%", "https://www.hani.co.kr/arti/economy/economy_general/1094604.html")], 
      news: [link("원전과 재생에너지", "https://www.hankookilbo.com/News/Read/A2024052716260000163")], 
      images: [img("3_france.png")] 
    },
    "일본": { 
      topic: "에너지 수입 의존", 
      sources: [link("에너지 자급률 비교", "https://www.joongang.co.kr/article/25109903")], 
      news: [link("태양광 승부수", "https://www.chosun.com/opinion/specialist_column/2024/08/08/DCARE746QFFL3EJLS6HB5IRXKM/")], 
      images: [img("3_japan.jpg")] 
    },
    "중국": { 
      topic: "에너지 소비와 재생에너지", 
      sources: [link("재생에너지 선도", "https://www.khan.co.kr/article/202405271554001")], 
      news: [link("자원 무기화", "https://www.hankyung.com/article/2025101015041")], 
      images: [img("3_china.jpg")] 
    },
    "칠레": { 
      topic: "리튬 자원과 배터리", 
      sources: [link("핵심광물 협력", "https://www.yna.co.kr/view/AKR20240515031000003")], 
      news: [link("리튬 국유화", "https://www.hankyung.com/article/2023042368061")], 
      images: [img("3_chile.jpg")] 
    }
  },

  // 4. 난민 (4_국가명.jpg)
  refugees: {
    "시리아": { 
      topic: "분쟁과 난민 위기", 
      sources: [link("12년째 내전", "https://news.kbs.co.kr/news/view.do?ncd=7707287")], 
      news: [link("난민 혐오 갈등", "https://www.chosun.com/international/international_general/2024/12/12/TTMQF67QT5HZ3DIX56XD4MMEYM/")], 
      images: [img("4_syria.jpg")] 
    },
    "우크라이나": { 
      topic: "전쟁 난민과 지원", 
      sources: [link("800만 피란민", "https://www.yna.co.kr/view/AKR20230218002600088")], 
      news: [link("유럽의 갈등", "https://www.asiae.co.kr/article/2022110415552256671")], 
      images: [img("4_ukraine.jpg")] 
    },
    "아프가니스탄": { 
      topic: "치안 불안과 이주", 
      sources: [link("특별기여자 이슈", "https://www.sisain.co.kr/news/articleView.html?idxno=45450")], 
      news: [link("수용 논란", "https://www.khan.co.kr/article/202507222043015")], 
      images: [img("4_afghanistan.jpg")] 
    },
    "터키": { 
      topic: "대규모 난민 수용국", 
      sources: [link("난민 화약고", "https://www.donga.com/news/Inter/article/all/20160802/79514877/1")], 
      news: [link("국경 갈등", "https://www.khan.co.kr/article/202210172144005")], 
      images: [img("4_turkey.jpg")] 
    },
    "독일": { 
      topic: "난민 정착과 통합", 
      sources: [link("난민 통합 사례", "https://www.khan.co.kr/article/202303160600011")], 
      news: [link("정치적 갈등", "https://www.hankyung.com/article/2018061731891")], 
      images: [img("4_germany.jpg")] 
    },
    "요르단": { 
      topic: "난민 캠프 운영", 
      sources: [link("자타리 난민촌", "https://news.kbs.co.kr/news/view.do?ncd=2708100")], 
      news: [link("공존의 딜레마", "https://www.ytn.co.kr/_ln/0104_201812010736581232")], 
      images: [img("4_jordan.jpg")] 
    },
    "캐나다": { 
      topic: "난민 후원과 정착", 
      sources: [link("탈북민 수용", "https://news.kbs.co.kr/news/view.do?ncd=3031021")], 
      news: [link("여론 변화", "https://www.yna.co.kr/view/AKR20190705055400009")], 
      images: [img("4_canada.jpg")] 
    },
    "레바논": { 
      topic: "국가 부담과 지원", 
      sources: [link("피난 생활", "https://www.hani.co.kr/arti/international/international_general/567177.html")], 
      news: [link("정치 위기", "https://snuacwebzine.snu.ac.kr/?p=6844")], 
      images: [img("4_lebanon.jpg")] 
    }
  }
};
