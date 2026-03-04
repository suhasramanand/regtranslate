#!/usr/bin/env python3
"""
Load test script for https://suhasramanand.vercel.app/
Simulates traffic to help test metrics/analytics dashboards.
Uses only Python stdlib - no extra deps.
"""

import urllib.request
import urllib.error
import ssl
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

TARGET_URL = "https://suhasramanand.vercel.app/"
NUM_REQUESTS = 150  # Total requests to send
CONCURRENT_WORKERS = 10  # Parallel requests
BATCH_DELAY = 0.1  # Small delay between batches to avoid hammering

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]


def make_request(req_id: int) -> tuple[int, bool, float]:
    """Make a single GET request. Returns (req_id, success, duration_sec)."""
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        TARGET_URL,
        headers={"User-Agent": random.choice(USER_AGENTS)},
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            _ = resp.read()
        return (req_id, True, time.perf_counter() - start)
    except Exception as e:
        return (req_id, False, time.perf_counter() - start)


def main():
    print(f"Load testing {TARGET_URL}")
    print(f"Sending {NUM_REQUESTS} requests with {CONCURRENT_WORKERS} concurrent workers...\n")

    results = []
    start_total = time.perf_counter()

    with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
        futures = [executor.submit(make_request, i) for i in range(NUM_REQUESTS)]
        for i, f in enumerate(as_completed(futures)):
            req_id, ok, dur = f.result()
            results.append((req_id, ok, dur))
            if (i + 1) % 25 == 0:
                print(f"  Completed {i + 1}/{NUM_REQUESTS} requests...")
            time.sleep(BATCH_DELAY)

    elapsed = time.perf_counter() - start_total
    success = sum(1 for _, ok, _ in results if ok)
    failed = NUM_REQUESTS - success
    avg_dur = sum(d for _, _, d in results) / len(results) if results else 0

    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)
    print(f"  Total requests:  {NUM_REQUESTS}")
    print(f"  Successful:     {success}")
    print(f"  Failed:         {failed}")
    print(f"  Total time:     {elapsed:.2f}s")
    print(f"  Avg response:   {avg_dur*1000:.0f}ms")
    print(f"  Requests/sec:   {NUM_REQUESTS/elapsed:.1f}")
    print("=" * 50)
    print("\nCheck your Vercel Analytics / metrics dashboard for the traffic spike!")


if __name__ == "__main__":
    main()
