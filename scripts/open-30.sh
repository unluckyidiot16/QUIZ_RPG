
#!/usr/bin/env bash
URL="${1:-http://localhost:5173/?pack=sample}"
for i in $(seq 1 30); do
  open -na "Google Chrome" --args --user-data-dir="/tmp/qd-stu-$i" --no-first-run "$URL"
done
