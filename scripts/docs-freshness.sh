#!/usr/bin/env bash
# Chặn CHANGELOG bị bỏ đói (CLAUDE.md luật 13).
#
# Vì sao cần script thay vì chỉ có luật: luật 13 tồn tại từ P0 mà vẫn bị bỏ
# qua 8 merge liên tiếp trong ngày 19/07 — người/agent đang tập trung vào
# code thì việc ghi sử luôn là thứ rơi đầu tiên. Kiểm tra tự chạy trong CI
# thì không phụ thuộc trí nhớ ai cả.
#
# Cách hoạt động: lấy ngày của entry MỚI NHẤT trong docs/CHANGELOG.md, đếm
# commit feat/fix trên main mới hơn ngày đó. Còn commit chưa được kể → fail.
#
# Cố ý CHỈ đếm feat/fix: docs/chore/ci/test không cần entry riêng.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CHANGELOG="docs/CHANGELOG.md"
[ -f "$CHANGELOG" ] || { echo "không tìm thấy $CHANGELOG"; exit 1; }

# Entry mới nhất, dạng "## YYYY-MM-DD — ..."
latest_date=$(grep -m1 -oE '^## [0-9]{4}-[0-9]{2}-[0-9]{2}' "$CHANGELOG" | awk '{print $2}')
if [ -z "$latest_date" ]; then
  echo "CHANGELOG chưa có entry nào theo định dạng '## YYYY-MM-DD — ...'"
  exit 1
fi

# Commit feat/fix sau NGÀY đó (dùng cuối ngày để commit cùng ngày được tính là
# đã kể — entry viết sau các commit của chính ngày ấy).
unlogged=$(git log --since="${latest_date} 23:59:59" --pretty=format:'%h %s' \
  --grep='^feat' --grep='^fix' --extended-regexp || true)

if [ -n "$unlogged" ]; then
  echo "✗ CHANGELOG lạc hậu — entry mới nhất là ${latest_date}, nhưng còn commit chưa được kể:"
  echo "$unlogged" | sed 's/^/    /'
  echo
  echo "  Thêm một entry vào $CHANGELOG (ngày · nội dung · review findings · số test)."
  echo "  Xem CLAUDE.md luật 13."
  exit 1
fi

echo "✓ CHANGELOG cập nhật tới ${latest_date}, không có feat/fix nào chưa được kể"
