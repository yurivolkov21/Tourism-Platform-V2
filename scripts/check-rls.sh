#!/usr/bin/env bash
# Đối chiếu RLS backstop (W2, audit 05/09 cụm 6): MỌI bảng public (trừ
# _prisma_migrations) phải có relrowsecurity = true.
#
# Vì sao cần script thay vì chỉ có migration: migration chỉ bật cho bảng ĐÃ
# biết lúc viết nó — hai bảng mới (enquiry_status_events, tour_cost_items)
# đã lọt đúng kiểu đó sau đợt hardening 18/07. Kiểm bằng máy trong CI (chạy
# sau test:int, DB đã migrate) thì bảng thứ N+1 không lọt được nữa.
#
# Chạy tay: ./scripts/check-rls.sh   (mặc định trỏ tourism_test của test:int;
# đè bằng DATABASE_URL). Máy không có psql thì tự rơi về docker exec vào
# container compose (tourism-v2-postgres-1).
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://tourism:tourism@localhost:5432/tourism_test}"
QUERY="SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity
    AND c.relname <> '_prisma_migrations'
  ORDER BY c.relname;"

if command -v psql > /dev/null 2>&1; then
  MISSING=$(psql "$DB_URL" -tAc "$QUERY")
else
  # Fallback dev WSL: không có psql client, nhưng Postgres chạy trong docker
  # compose — exec thẳng vào container, lấy tên db từ đuôi DATABASE_URL.
  DB_NAME="${DB_URL##*/}"
  DB_NAME="${DB_NAME%%\?*}"
  MISSING=$(docker exec tourism-v2-postgres-1 psql -U tourism -d "$DB_NAME" -tAc "$QUERY")
fi

if [ -n "$MISSING" ]; then
  echo "✖ Bảng public THIẾU Row Level Security (backstop, migration hardening 18/07):"
  echo "$MISSING" | sed 's/^/  - /'
  echo "Viết migration MỚI 'ALTER TABLE <tên> ENABLE ROW LEVEL SECURITY;' (không sửa migration cũ)."
  exit 1
fi
echo "✓ RLS backstop: mọi bảng public đều bật row security."
