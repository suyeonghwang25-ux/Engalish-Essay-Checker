# Engalish - 영어 에세이 첨삭기

AI(Claude API)를 이용해 영어 에세이를 첨삭해주는 웹 애플리케이션입니다. 에세이를 붙여넣으면 문법, 어휘, 문장 구조, 논리적 흐름을 분석하고 한국어로 설명을 제공합니다.

## 주요 기능

- 영어 에세이 입력 후 AI 첨삭 요청
- 학습자 수준 선택 (중학생 / 고등학생 / 대학생 / 일반 / 비즈니스)
- 종합 점수(100점 만점)와 총평 제공
- 잘된 점 / 보완할 점 목록
- 원문에 수정이 필요한 부분을 하이라이트 표시 (마우스 오버 시 제안 확인)
- 교정된 전체 에세이 제공
- 문법 / 어휘 / 문장 구조 / 내용·논리 / 문체 카테고리별 세부 첨삭 목록

## 기술 스택

- Backend: Node.js, Express
- AI: Anthropic Claude API (`@anthropic-ai/sdk`, structured outputs via Zod)
- Frontend: 순수 HTML / CSS / JavaScript (별도 빌드 과정 없음)

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 만들고 Anthropic API 키를 입력하세요.

```bash
cp .env.example .env
```

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
PORT=3000
```

API 키는 [console.anthropic.com](https://console.anthropic.com/)에서 발급받을 수 있습니다.

### 3. 서버 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000` 접속 후 사용하면 됩니다.

개발 중 파일 변경 시 자동 재시작하려면:

```bash
npm run dev
```

## 프로젝트 구조

```
.
├── server.js           # Express 서버 + Claude API 연동
├── public/
│   ├── index.html       # 메인 페이지
│   ├── style.css        # 스타일
│   └── app.js           # 프론트엔드 로직
├── .env.example
└── package.json
```

## 참고 사항

- 에세이는 한 번에 최대 8,000자까지 입력할 수 있습니다.
- 응답은 참고용 AI 첨삭이며, 중요한 과제나 시험 준비의 경우 사람의 검토를 함께 받는 것을 권장합니다.
- API 사용에는 Anthropic API 요금이 부과됩니다.
