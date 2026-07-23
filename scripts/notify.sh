#!/usr/bin/env bash
# إشعار تيليجرام. الاستخدام: bash scripts/notify.sh "الرسالة"
set -euo pipefail
MSG="${1:-تنبيه من أوتوبايلوت نَسَق}"
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "تخطي الإشعار: متغيرات تيليجرام غير معرّفة"
  exit 0
fi
curl --fail --show-error --silent -X POST   "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"   -d chat_id="${TELEGRAM_CHAT_ID}"   -d disable_web_page_preview=true   --data-urlencode text="${MSG}" > /dev/null
echo "تم الإرسال"
