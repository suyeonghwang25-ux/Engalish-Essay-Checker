# Engalish - 영어 에세이 첨삭기 (Gemini, 서버 없음)

**설치도, 서버도, 터미널도 필요 없습니다.** `index.html` 파일 하나를 더블클릭해서 브라우저에서 열면 바로 사용할 수 있는, 영어 교사를 위한 손글씨 에세이 첨삭 웹앱입니다.

손글씨 에세이 사진을 업로드하면 **Google Gemini API**가 브라우저에서 직접 이미지를 읽어(OCR) 텍스트로 변환하고, 문법·어휘·문장구조·구성을 분석해 오류 위치를 색상으로 표시하며, 단어 수·점수·교사용 총평까지 한 번에 보여줍니다.

## 주요 기능

- **손글씨 이미지 업로드** (드래그 앤 드롭 지원, JPEG/PNG/GIF/WEBP, 장당 최대 5MB, 최대 5장 — 여러 페이지 에세이도 순서대로 이어서 판독)
- **OCR Text**: Gemini가 읽어낸 원문에 오류 위치를 색상으로 하이라이트
  - 🔴 Grammar · 🔵 Spelling · 🟢 Vocabulary/Word Choice · 🟠 Punctuation · 🟣 Sentence Structure/Naturalness · 🟡 Organization/Coherence · ⚪ Other
  - 판독이 불확실한 부분은 임의로 추측하지 않고 `[OCR uncertain]`으로 별도 표시
- **Score**: 문법(25) / 어휘(20) / 내용(20) / 구성(20) / 표기·문장부호(15) 세부 채점 + 총점(100점)
- **Word Count**: 단어 수 / 문장 수 / 평균 문장 길이
- **Corrections**: 오류별 원문→수정안, 카테고리, 심각도(Minor/Moderate/Major), 설명
- **Corrected Essay**: 필요한 부분만 수정한 전체 에세이 (수정된 부분은 굵게 표시)
- **Teacher Feedback**: Strengths / Areas to Improve / Teaching Points / Overall 총평
- API 키는 **localStorage**에만 저장되고, 이 앱을 만든 개발자나 다른 서버로는 전송되지 않습니다.
- 실제 스타일 취향이 아닌 **진짜 오류만** 표시하도록, 그리고 학생의 원래 표현을 최대한 유지하도록 설계되어 있습니다.

## 실행 방법 (Mac)

### 1. Gemini API 키 발급받기

1. [Google AI Studio](https://aistudio.google.com/apikey)에 접속해 구글 계정으로 로그인합니다.
2. **Create API key**를 눌러 키를 발급받습니다. (결제 등록 없이 무료 등급으로 바로 사용 가능합니다.)
3. 생성된 키(`AIza...`로 시작)를 복사해둡니다.

### 2. 앱 열기

1. 이 저장소를 다운로드/클론합니다.
2. Finder에서 `index.html` 파일을 **더블클릭**합니다. 기본 브라우저(Chrome, Safari 등)로 바로 열립니다.
   - 만약 다른 프로그램으로 열린다면, 파일을 우클릭 → "다음으로 열기" → Chrome/Safari 등 브라우저를 선택하세요.

### 3. API 키 입력 후 사용

1. 화면 상단 **"Gemini API Key"** 입력란에 1단계에서 복사한 키를 붙여넣습니다. (자동으로 이 브라우저에 저장되어, 다음에 열 때 다시 입력할 필요가 없습니다.)
2. 모델은 기본값(`gemini-2.5-flash`, 무료 등급 권장)을 그대로 두거나 필요시 변경합니다.
3. **Upload Handwritten Essay** 영역에 손글씨 에세이 사진을 올립니다 (최대 5장).
4. 학생 수준을 선택하고 **Analyze Essay** 버튼을 클릭합니다.
5. 잠시 후 OCR Text, Score, Word Count, Corrections, Corrected Essay, Teacher Feedback이 순서대로 표시됩니다.

Windows 등 다른 OS에서도 동일하게 `index.html`을 더블클릭(또는 브라우저로 열기)하면 똑같이 동작합니다.

## 데이터 처리에 대한 안내

- 업로드한 이미지와 에세이 텍스트는 첨삭을 위해 **Google Gemini API로 전송**됩니다. 학생 이름 등 개인정보가 이미지에 그대로 노출되지 않도록 확인 후 업로드해주세요.
- API 키는 오직 이 브라우저의 `localStorage`에만 저장되며, 이 앱은 별도의 서버나 데이터베이스를 두지 않습니다. "키 삭제" 버튼으로 언제든 지울 수 있습니다.
- Gemini 무료 등급은 분당/일일 요청 수 제한이 있습니다. 한도를 초과하면 화면에 오류 메시지가 표시되며, 잠시 후 다시 시도하면 됩니다.

## 파일 구성

```
.
├── index.html   # 페이지 구조 (이 파일을 더블클릭해서 실행)
├── style.css    # 스타일
└── app.js       # Gemini API 호출 및 화면 로직 (순수 JavaScript, 빌드 불필요)
```

## 참고 사항

- AI가 실제 오류(문법/철자/어휘/문장부호/문장구조/구성)와 선택적인 스타일 개선을 구분하도록 지시되어 있으며, 학생의 원래 표현이 문법적으로 맞다면 "더 세련된 표현이 아니다"라는 이유만으로 오류로 표시하지 않습니다.
- 손글씨가 불명확해 판독이 불확실한 경우 AI가 임의로 단어를 지어내지 않고 `[OCR uncertain]`으로 표시합니다. 최종 확인 시 참고하세요.
- 응답은 참고용 AI 첨삭이며, 성적 처리나 공식 평가에는 교사의 최종 검토를 함께 권장합니다.
