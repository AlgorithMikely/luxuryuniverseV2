import json
import time
import re
from playwright.sync_api import sync_playwright, expect

def create_jwt(payload):
    import jwt
    return jwt.encode(payload, "supersecretjwtkeyforjules", algorithm="HS256")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock user data and create a JWT
        user_payload = {
            "sub": "12345",
            "roles": ["reviewer"],
            "discord_id": "12345"
        }
        token = create_jwt(user_payload)

        user_profile = {
            "id": 1,
            "discord_id": "12345",
            "username": "Test Reviewer",
            "avatar": None,
            "reviewer_profile": {"id": 1},
            "roles": ["reviewer"]
        }

        queue_data = [
            {
                "id": 1,
                "track_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                "status": "pending",
                "is_spotlighted": False,
                "is_bookmarked": False,
                "track_title": "Test Track 1",
                "track_artist": "Test Artist 1",
                "submitted_by": {"id": 2, "discord_id": "67890", "username": "Submitter A", "avatar": None}
            },
            {
                "id": 2,
                "track_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
                "status": "pending",
                "is_spotlighted": False,
                "is_bookmarked": False,
                "track_title": "Test Track 2",
                "track_artist": "Test Artist 2",
                "submitted_by": {"id": 3, "discord_id": "11223", "username": "Submitter B", "avatar": None}
            }
        ]

        # Mock API calls
        page.route("**/api/user/me", lambda route: route.fulfill(status=200, json=user_profile))
        page.route("**/api/1/queue", lambda route: route.fulfill(status=200, json=queue_data))
        page.route("**/api/1/queue/submission/1/bookmark**", lambda route: route.fulfill(status=200))
        page.route("**/api/proxy/audio**", lambda route: route.continue_())

        # Start at the root and inject the token
        page.goto("http://localhost:5173")
        page.evaluate(f"window.localStorage.setItem('auth-storage', JSON.stringify({{state: {{ token: '{token}', user: {json.dumps(user_profile)}, roles: ['reviewer'] }}, version: 0}}))")

        # Navigate to the dashboard
        page.goto("http://localhost:5173/dashboard/1")

        # --- VERIFICATION STEPS ---

        # 1. Verify queue is populated
        expect(page.get_by_text("Test Track 1")).to_be_visible()
        expect(page.get_by_text("Test Track 2")).to_be_visible()

        # 2. Click the first track and verify it plays in the player AND the review hub
        page.get_by_text("Test Track 1").click()
        expect(page.locator("footer").get_by_text("Test Track 1")).to_be_visible()
        expect(page.locator("main").get_by_text("Test Track 1")).to_be_visible() # Check ReviewHub

        # 3. Click the bookmark button and verify the icon changes color
        bookmark_button = page.get_by_label("Bookmark")
        expect(bookmark_button).to_have_class(re.compile(r"\btext-gray-400\b"))
        bookmark_button.click()
        expect(bookmark_button).to_have_class(re.compile(r"\btext-pink-500\b"))

        # 4. Click the "Next" button and verify the second track plays
        page.get_by_label("Next Track").click()
        expect(page.locator("footer").get_by_text("Test Track 2")).to_be_visible()
        expect(page.locator("main").get_by_text("Test Track 2")).to_be_visible() # Check ReviewHub again

        # 5. Verify the first track is now in the "Recently Played" list
        history_panel = page.locator("main > div:nth-child(3)") # The right-most panel
        expect(history_panel.get_by_text("Test Track 1")).to_be_visible()

        # Give a moment for animations/final renders
        time.sleep(1)

        # 6. Take the final screenshot
        page.screenshot(path="jules-scratch/verification/full_dashboard.png")

        browser.close()

run()
