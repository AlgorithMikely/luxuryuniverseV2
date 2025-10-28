from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the login page
    page.goto("http://localhost:8000/")

    # Click the login button
    page.click("text=Login with Discord")

    # Wait for the redirect to the hub page, which indicates a successful login.
    # We'll use a generous timeout as the dev server can be slow.
    page.wait_for_load_state("networkidle", timeout=60000)

    # Now navigate to the admin page
    page.goto("http://localhost:8000/")

    # Wait for the reviewers to load
    page.wait_for_selector("text=Admin Dashboard")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/admin_dashboard.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
