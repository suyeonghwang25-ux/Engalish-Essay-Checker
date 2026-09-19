@echo off
REM 더블클릭으로 Engalish 에세이 첨삭기를 실행합니다 (Windows 전용).
cd /d "%~dp0"

if not exist ".env" (
  copy .env.example .env >nul
  echo ===================================================
  echo  .env 파일을 새로 만들었습니다.
  echo  방금 열린 메모장에 ANTHROPIC_API_KEY를 입력하고 저장한 뒤
  echo  이 창을 닫고 다시 더블클릭해주세요.
  echo ===================================================
  notepad .env
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 필요한 패키지를 설치합니다 (최초 1회, 잠시만 기다려주세요)...
  call npm install
)

echo 서버를 시작합니다... 잠시 후 브라우저가 자동으로 열립니다.
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"
call npm start
