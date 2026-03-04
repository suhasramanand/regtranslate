#!/bin/bash
# Load test for https://suhasramanand.vercel.app/
# Simulates traffic to test metrics/analytics

URL="https://suhasramanand.vercel.app/"
TOTAL=150
CONCURRENT=10

echo "Load testing $URL"
echo "Sending $TOTAL requests ($CONCURRENT concurrent)..."
echo ""

SUCCESS=0
FAIL=0
START=$(date +%s.%N)

for i in $(seq 1 $TOTAL); do
  curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" "$URL" &
  if [ $((i % CONCURRENT)) -eq 0 ]; then
    wait
    echo "  Completed $i/$TOTAL..."
  fi
done
wait

END=$(date +%s.%N)
ELAPSED=$(echo "$END - $START" | bc 2>/dev/null || echo "0")

echo ""
echo "=================================================="
echo "RESULTS"
echo "=================================================="
echo "  Total requests:  $TOTAL"
echo "  Total time:      ${ELAPSED}s"
echo "  Requests/sec:    $(echo "scale=1; $TOTAL / $ELAPSED" | bc 2>/dev/null || echo "N/A")"
echo "=================================================="
echo ""
echo "Check your Vercel Analytics / metrics dashboard for the traffic spike!"
