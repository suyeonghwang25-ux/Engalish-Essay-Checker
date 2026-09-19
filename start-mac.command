#!/bin/bash
# 더블클릭으로 Engalish 에세이 첨삭기를 실행합니다 (macOS 전용).
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==================================================="
  echo " .env 파일을 새로 만들었습니다."
  echo " 방금 열린 파일에 ANTHROPIC_API_KEY를 입력하고 저장한 뒤"
  echo " 이 창을 닫고 다시 더블클릭해주세요."
  echo "==================================================="
  open -e .env
  read -p "확인했으면 엔터를 눌러 창을 닫으세요..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "필요한 패키지를 설치합니다 (최초 1회, 잠시만 기다려주세요)..."
  npm install
fi

echo "서버를 시작합니다... 잠시 후 브라우저가 자동으로 열립니다."
(sleep 2 && open http://localhost:3000) &
npm start
