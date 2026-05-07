"""Capture mid-action screenshots that need a click or keystroke to surface.

Complements take_screenshots.py, which captures static page states. Run this
after re-seeding so the demo data is in a clean state.
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = Path(__file__).resolve().parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:5173"


def login(page, username: str, password: str = "demopass1") -> None:
    page.goto(f"{BASE}/login")
    page.get_by_label("Username").fill(username)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/app/**", timeout=10_000)
    page.wait_for_load_state("networkidle")


def shot(page, name: str) -> None:
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"  saved {path.relative_to(ROOT)}")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- chess: create channel modal ----------
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        login(page, "chess")

        page.goto(f"{BASE}/app/workspaces/1/channels/1")
        page.wait_for_load_state("networkidle")

        # Open the create-channel modal via the + button next to CHANNELS
        page.locator('button[title="Create channel"]').click()
        page.get_by_label("Channel name").fill("release-prep")
        page.wait_for_timeout(300)
        shot(page, "15_create_channel_modal")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # ---------- chess: members panel open ----------
        page.locator('button[title="Members"]').click()
        page.wait_for_timeout(400)
        shot(page, "16_members_panel_open")
        page.locator('button[title="Members"]').click()
        page.wait_for_timeout(200)

        # ---------- chess: invite to channel modal ----------
        page.locator('button[title="Invite people"]').click()
        page.wait_for_timeout(300)
        page.get_by_label("Username").fill("dave")
        page.wait_for_timeout(200)
        shot(page, "17_invite_to_channel_modal")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # ---------- chess: edit message inline ----------
        # Welcome-message row at the top is hers; hover to reveal action icons
        page.get_by_text("Welcome to CS6083 Spring 2026!").hover()
        page.wait_for_timeout(150)
        page.locator('button[title="Edit message"]').first.click()
        page.wait_for_timeout(200)
        # The first textarea on the page is the inline edit field; the bottom
        # message composer is rendered later and would be matched by .last.
        edit_textarea = page.locator("textarea").first
        edit_textarea.fill("Welcome to CS6083 Spring 2026! Demo on May 8 at 10am.")
        page.wait_for_timeout(200)
        shot(page, "18_edit_message_inline")
        edit_textarea.press("Escape")
        page.wait_for_timeout(300)

        # ---------- chess: @mention autocomplete in composer ----------
        composer = page.locator('textarea[placeholder="Message"]')
        composer.click()
        # Type slowly so the React state updates between keystrokes and the
        # suggestions dropdown actually opens.
        composer.type("checking the schema with @bo", delay=40)
        page.wait_for_timeout(400)
        shot(page, "19_mention_autocomplete")
        # Clear the composer
        composer.fill("")
        page.wait_for_timeout(150)

        ctx.close()

        # ---------- alice: last-admin guard error ----------
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        login(page, "alice")

        page.goto(f"{BASE}/app/workspaces/2/members")
        page.wait_for_load_state("networkidle")

        # Hover Alice's own row, click Demote
        row = page.locator("div").filter(has_text="@alice").first
        row.hover()
        page.wait_for_timeout(200)
        page.get_by_role("button", name="Demote").first.click()
        page.wait_for_timeout(900)
        shot(page, "20_last_admin_guard_error")

        ctx.close()
        browser.close()
        print(f"\nMid-action screenshots in {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
