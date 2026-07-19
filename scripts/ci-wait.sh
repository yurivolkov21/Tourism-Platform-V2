#!/bin/sh
# Chờ CI của ĐÚNG commit đang ở HEAD rồi trả exit code theo kết quả.
#
# Vì sao cần script này (bài học 19/07): vòng chờ viết vội kiểu
#   until [ "$(gh run list --branch X --limit 1 --jq '.[0].status')" = completed ]
# có hai lỗi chí mạng:
#   1. Không có run nào (sai trigger, hoặc run chưa kịp đăng ký) → chuỗi rỗng
#      không bao giờ bằng "completed" → quay vô tận tới lúc timeout (từng mất
#      23 phút cho CI vốn chạy 47 giây).
#   2. Lọc theo BRANCH nên có thể bắt trúng run CŨ đã completed từ trước →
#      thoát ngay với kết quả xanh giả của commit khác.
# Cách đúng: khoá theo headSha của commit hiện tại, rồi để `gh run watch` chờ
# phía server thay vì tự poll.

set -e
SHA=$(git rev-parse HEAD)
DEADLINE=$(( $(date +%s) + 120 ))   # tối đa 2 phút để run kịp đăng ký

echo "Chờ CI cho commit ${SHA%${SHA#???????}}…"
RUN_ID=""
while [ -z "$RUN_ID" ]; do
  RUN_ID=$(gh run list --limit 20 --json databaseId,headSha,workflowName \
    --jq "[.[] | select(.headSha == \"$SHA\" and .workflowName == \"CI\")][0].databaseId" 2>/dev/null || true)
  [ "$RUN_ID" = "null" ] && RUN_ID=""
  if [ -z "$RUN_ID" ]; then
    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
      echo "✖ Không thấy CI run nào cho commit này sau 2 phút."
      echo "  Kiểm tra: commit đã push chưa? workflow có trigger cho branch này không?"
      exit 1
    fi
    sleep 3
  fi
done

# `gh run watch` chờ phía server (không poll thủ công) và --exit-status trả
# exit code khác 0 nếu CI đỏ → dùng được trong chuỗi `&&`.
exec gh run watch "$RUN_ID" --exit-status --interval 5
