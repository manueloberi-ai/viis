"""
End-to-end regression: the "Nuovo articolo" form must block saving and
surface an inline error when data_acquisto > data_vendita, before any
Supabase INSERT is attempted.

Prerequisites
-------------
- The app runs at http://localhost:8080 (`bun run dev`).
- A signed-in Supabase session for the target user is injected via env:
    * LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
    * LOVABLE_BROWSER_SUPABASE_SESSION_JSON
    * (optional) LOVABLE_BROWSER_SUPABASE_COOKIES_JSON
  In Lovable's sandbox these are pre-populated when auth status is
  `injected`. Locally, mint them once with a headless login helper.

Run
---
    python3 scripts/e2e/inventory-date.spec.py

Exits non-zero if the form allowed a bad save or the expected error
copy did not appear.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE = os.environ.get("VIIS_E2E_BASE", "http://localhost:8080")
OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

EXPECTED_MSG = "La data di acquisto non può essere successiva alla data di vendita"


async def restore_session(context, page):
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies:
        parsed = json.loads(cookies)
        for c in parsed:
            c["url"] = BASE
        await context.add_cookies(parsed)
    await page.goto(BASE, wait_until="domcontentloaded")
    if key and session:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(session)})"
        )


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await restore_session(context, page)
        await page.goto(f"{BASE}/inventory", wait_until="domcontentloaded")
        await page.screenshot(path=str(OUT / "01_inventory.png"))

        # Open the "Nuovo articolo" dialog.
        await page.get_by_role("button", name="Nuovo articolo").first.click()
        await page.wait_for_selector('[data-field="data_acquisto"] input[type="date"]')
        await page.screenshot(path=str(OUT / "02_dialog_open.png"))

        # Vendita = today - 5 days, Acquisto = today (i.e. acquisto > vendita).
        vendita_input = page.locator('[data-field="data_vendita"] input[type="date"]')
        acquisto_input = page.locator('[data-field="data_acquisto"] input[type="date"]')
        await vendita_input.fill("2026-06-10")
        await acquisto_input.fill("2026-06-20")
        await page.screenshot(path=str(OUT / "03_bad_dates.png"))

        # Inline error must show under Data acquisto immediately.
        await expect(
            page.locator('[data-field="data_acquisto"]').get_by_text(EXPECTED_MSG)
        ).to_be_visible(timeout=3000)

        # Click Salva — must NOT close the dialog and must NOT hit Supabase.
        supabase_calls: list[str] = []
        page.on(
            "request",
            lambda r: supabase_calls.append(r.url)
            if "/rest/v1/inventory_items" in r.url and r.method in ("POST", "PATCH")
            else None,
        )
        await page.get_by_role("button", name="Salva").first.click()
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(OUT / "04_after_save_click.png"))

        # Dialog is still open and inline error persists.
        await expect(
            page.locator('[data-field="data_acquisto"]').get_by_text(EXPECTED_MSG)
        ).to_be_visible()

        if supabase_calls:
            print("FAIL: form hit Supabase despite invalid dates:", supabase_calls)
            await browser.close()
            return 1

        print("PASS (create): save blocked, inline error visible, no Supabase write attempted.")

        # -----------------------------------------------------------------
        # Edit-flow scenario: reopen an existing item and repeat the check.
        # -----------------------------------------------------------------
        # Close the create dialog.
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)

        edit_btn = page.get_by_role("button", name="Modifica").first
        if await edit_btn.count() == 0:
            print("SKIP (edit): no existing inventory row to edit.")
            await browser.close()
            return 0

        await edit_btn.click()
        await page.wait_for_selector('[data-field="data_acquisto"] input[type="date"]')
        await page.screenshot(path=str(OUT / "05_edit_open.png"))

        await page.locator('[data-field="data_vendita"] input[type="date"]').fill("2026-06-10")
        await page.locator('[data-field="data_acquisto"] input[type="date"]').fill("2026-06-20")
        await page.screenshot(path=str(OUT / "06_edit_bad_dates.png"))

        await expect(
            page.locator('[data-field="data_acquisto"]').get_by_text(EXPECTED_MSG)
        ).to_be_visible(timeout=3000)

        # Both fields must carry the destructive ring highlight after Salva.
        supabase_calls.clear()
        await page.get_by_role("button", name="Salva").first.click()
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(OUT / "07_edit_after_save.png"))

        for field in ("data_acquisto", "data_vendita"):
            classes = await page.locator(f'[data-field="{field}"] input').get_attribute("class")
            if not classes or "ring-destructive" not in classes:
                print(f"FAIL (edit): {field} input missing destructive ring highlight")
                await browser.close()
                return 1

        if supabase_calls:
            print("FAIL (edit): form hit Supabase despite invalid dates:", supabase_calls)
            await browser.close()
            return 1

        print("PASS (edit): save blocked, inline error visible, both fields highlighted.")
        await browser.close()
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
