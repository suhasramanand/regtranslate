#!/usr/bin/env python3
"""Record RegTranslate product demo using Playwright. Saves video to demo-recordings/."""

import asyncio
import sys
from pathlib import Path

# 9 scenes × 8 sec = 72 sec, plus buffer
DEMO_DURATION_SEC = 80
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "demo-recordings"


async def main():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Installing playwright...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
        subprocess.run([sys.executable, "-m", "playwright", "install", "webkit"], check=True)
        from playwright.async_api import async_playwright

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    video_path = OUTPUT_DIR / "regtranslate-demo.webm"

    print("Recording demo... (ensure backend + frontend are running)")
    print("  Backend: uvicorn app.main:app --reload")
    print("  Frontend: cd react-ui && npm run dev")
    print("")

    async with async_playwright() as p:
        browser = await p.webkit.launch(headless=False)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(OUTPUT_DIR),
            record_video_size={"width": 1920, "height": 1080},
        )
        page = await context.new_page()
        await page.goto("http://localhost:5173/demo-recorder.html", wait_until="networkidle")
        await page.click('button:has-text("Record mode")')
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await asyncio.sleep(DEMO_DURATION_SEC)
        video_path_obj = await page.video.path() if page.video else None
        await context.close()

    if video_path_obj:
        import shutil
        dest = OUTPUT_DIR / "regtranslate-demo.webm"
        shutil.copy(video_path_obj, dest)
        print(f"Saved: {dest}")
    else:
        print("No video saved.")

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
