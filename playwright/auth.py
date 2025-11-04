import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Set dummy credentials from environment variables
        username = os.environ.get("ADMIN_USERNAME", "testadmin")
        password = os.environ.get("ADMIN_PASSWORD", "password")

        # In a real app, this would be a full OAuth flow.
        # Here, we'll simulate it by setting a mock token.
        # This assumes your backend has a way to accept a test user/pass
        # or a specific test endpoint for generating a token.
        # For this example, we'll create a dummy token directly in local storage,
        # as if the login process had completed successfully.

        await page.goto("http://localhost:5173/login")

        # Create a mock user object with an admin role
        mock_user = {
            "id": 1,
            "discord_id": "123456789",
            "username": "admin_user",
            "avatar": None,
            "roles": ["admin"],
            "reviewer_profile": None,
            "moderated_reviewers": [{ "id": 1, "discord_channel_id": "987654321" }]
        }

        # Create a mock auth state object
        mock_auth_state = {
            "state": {
                "token": "mock-admin-token-for-testing",
                "user": mock_user,
                "isLoading": False
            },
            "version": 0
        }

        # Inject the auth state into localStorage
        await page.evaluate(f"localStorage.setItem('auth-storage', '{json.dumps(mock_auth_state)}')")

        # Save storage state to a file.
        await page.context.storage_state(path="playwright/.auth/admin.json")
        print("Admin auth state saved.")

        await browser.close()

import json
if __name__ == "__main__":
    asyncio.run(main())
