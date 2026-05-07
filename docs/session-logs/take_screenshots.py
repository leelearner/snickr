"""Drive the Snickr UI with Playwright and capture demo screenshots.

Prerequisites:
- Frontend dev server running at http://localhost:5173 (Vite default)
- Backend running at http://localhost:8000
- Database seeded via database/seeds/demo_seed.py

Saves PNGs to docs/session-logs/screenshots/.
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


def shot(page, name: str) -> None:
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"  saved {path.relative_to(ROOT)}")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- chess context ----------
        chess_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        chess = chess_ctx.new_page()

        chess.goto(f"{BASE}/login")
        chess.wait_for_load_state("networkidle")
        shot(chess, "01_login_page")

        login(chess, "chess")
        chess.wait_for_load_state("networkidle")
        shot(chess, "02_chess_workspace_list")

        chess.goto(f"{BASE}/app/workspaces/1")
        chess.wait_for_load_state("networkidle")
        shot(chess, "03_chess_cs6083_home")

        chess.goto(f"{BASE}/app/workspaces/1/channels/1")
        chess.wait_for_load_state("networkidle")
        shot(chess, "04_chess_general_channel")

        chess.goto(f"{BASE}/app/invitations")
        chess.wait_for_load_state("networkidle")
        shot(chess, "05_chess_inbox")

        chess.goto(f"{BASE}/app/search?q=demo")
        chess.wait_for_load_state("networkidle")
        shot(chess, "06_chess_search_results")

        chess.goto(f"{BASE}/app/admins")
        chess.wait_for_load_state("networkidle")
        shot(chess, "07_chess_admins_across_workspaces")

        chess.goto(f"{BASE}/app/profile")
        chess.wait_for_load_state("networkidle")
        shot(chess, "08_chess_profile")

        chess.goto(f"{BASE}/app/workspaces/1/members")
        chess.wait_for_load_state("networkidle")
        shot(chess, "09_chess_workspace_members")

        chess.goto(f"{BASE}/app/users/4/messages")
        chess.wait_for_load_state("networkidle")
        shot(chess, "10_chess_views_bobs_messages")

        chess_ctx.close()

        # ---------- bob context: shows mention in his Inbox + multi-user ----------
        bob_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        bob = bob_ctx.new_page()
        login(bob, "bob")

        bob.goto(f"{BASE}/app/invitations")
        bob.wait_for_load_state("networkidle")
        shot(bob, "11_bob_inbox_with_seeded_mention")

        bob.goto(f"{BASE}/app/workspaces/1/channels/1")
        bob.wait_for_load_state("networkidle")
        shot(bob, "12_bob_view_of_general")

        bob_ctx.close()

        # ---------- dave context: shows pending workspace invitation ----------
        dave_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        dave = dave_ctx.new_page()
        login(dave, "dave")
        dave.wait_for_load_state("networkidle")
        shot(dave, "13_dave_workspace_list_with_pending_invite")

        dave.goto(f"{BASE}/app/invitations")
        dave.wait_for_load_state("networkidle")
        shot(dave, "14_dave_pending_invitation")

        dave_ctx.close()
        browser.close()
        print(f"\nAll screenshots in {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
