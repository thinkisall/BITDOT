#!/bin/bash

# ============================================================
#   BITDOT Server Launcher
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# PM2 여부 확인
HAS_PM2=$(command -v pm2 &>/dev/null && echo "yes" || echo "no")

show_menu() {
  echo ""
  echo "============================================================"
  echo "   BITDOT Server Launcher"
  echo "============================================================"
  echo ""
  echo "  [1] 개발 서버 시작       (Next.js dev + API 서버)"
  echo "  [2] 프로덕션 시작        (PM2 전체 스택)"
  echo "  [3] API 서버만 시작      (포트 8000)"
  echo "  [4] 프론트만 시작        (Next.js dev, 포트 3000)"
  echo "  [5] 터널만 시작          (Cloudflare Tunnel)"
  echo "  [6] 서버 상태 확인       (PM2 status)"
  echo "  [7] 서버 중지            (PM2 stop all)"
  echo "  [8] 서버 재시작          (PM2 restart all)"
  echo "  [9] 로그 보기            (PM2 logs)"
  echo "  [0] 종료"
  echo ""
  echo -n "  선택 > "
}

start_dev() {
  echo -e "${GREEN}[개발 모드] Next.js + API 서버 동시 시작...${NC}"
  if command -v concurrently &>/dev/null 2>&1 || npx --no-install concurrently --version &>/dev/null 2>&1; then
    npx concurrently \
      --names "FRONTEND,BACKEND" \
      --prefix-colors "cyan,yellow" \
      "npm run dev:frontend" \
      "npm run dev:backend"
  else
    echo -e "${YELLOW}[BACKEND] API 서버 백그라운드 실행 중...${NC}"
    node --no-deprecation server/index.js &
    BACKEND_PID=$!
    echo "  Backend PID: $BACKEND_PID"
    echo -e "${YELLOW}[FRONTEND] Next.js 실행 중...${NC}"
    npm run dev:frontend
    kill $BACKEND_PID 2>/dev/null
  fi
}

start_production() {
  if [ "$HAS_PM2" = "no" ]; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다. 설치: npm install -g pm2${NC}"
    return 1
  fi
  echo -e "${GREEN}[프로덕션] PM2로 전체 스택 시작...${NC}"
  npm run build
  pm2 start ecosystem.config.js
  pm2 status
}

start_api_only() {
  echo -e "${GREEN}[API 서버] 포트 8000에서 시작...${NC}"
  node --no-deprecation server/index.js
}

start_frontend_only() {
  echo -e "${GREEN}[프론트엔드] Next.js dev 시작 (포트 3000)...${NC}"
  npm run dev:frontend
}

start_tunnel() {
  if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo -e "${RED}CLOUDFLARE_TUNNEL_TOKEN 환경변수가 없습니다.${NC}"
    echo "  .env 파일에 CLOUDFLARE_TUNNEL_TOKEN=... 을 추가하거나"
    echo "  export CLOUDFLARE_TUNNEL_TOKEN=... 을 먼저 실행하세요."
    return 1
  fi
  echo -e "${GREEN}[터널] Cloudflare Tunnel 시작 (api.maketruthy.com)...${NC}"
  cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
}

check_status() {
  if [ "$HAS_PM2" = "no" ]; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다.${NC}"
    return 1
  fi
  pm2 status
}

stop_all() {
  if [ "$HAS_PM2" = "no" ]; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다.${NC}"
    return 1
  fi
  echo -e "${YELLOW}모든 서버 중지 중...${NC}"
  pm2 stop all
  pm2 status
}

restart_all() {
  if [ "$HAS_PM2" = "no" ]; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다.${NC}"
    return 1
  fi
  echo -e "${YELLOW}모든 서버 재시작 중...${NC}"
  pm2 restart all
  pm2 status
}

show_logs() {
  if [ "$HAS_PM2" = "no" ]; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다.${NC}"
    return 1
  fi
  pm2 logs
}

# .env 파일 로드
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs) 2>/dev/null
fi
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | xargs) 2>/dev/null
fi

# 인수로 직접 실행 지원: ./start.sh dev | prod | api | front | tunnel
if [ -n "$1" ]; then
  case "$1" in
    dev)     start_dev ;;
    prod)    start_production ;;
    api)     start_api_only ;;
    front)   start_frontend_only ;;
    tunnel)  start_tunnel ;;
    status)  check_status ;;
    stop)    stop_all ;;
    restart) restart_all ;;
    logs)    show_logs ;;
    *) echo "사용법: $0 [dev|prod|api|front|tunnel|status|stop|restart|logs]" ;;
  esac
  exit 0
fi

# 대화형 메뉴
while true; do
  show_menu
  read -r choice
  echo ""
  case "$choice" in
    1) start_dev ;;
    2) start_production ;;
    3) start_api_only ;;
    4) start_frontend_only ;;
    5) start_tunnel ;;
    6) check_status ;;
    7) stop_all ;;
    8) restart_all ;;
    9) show_logs ;;
    0) echo "종료합니다."; exit 0 ;;
    *) echo -e "${RED}잘못된 선택입니다.${NC}" ;;
  esac
  echo ""
  echo -n "  계속하려면 Enter..."
  read -r
done
