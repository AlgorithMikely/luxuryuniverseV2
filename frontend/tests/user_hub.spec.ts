import { test, expect } from '@playwright/test';

test('UserHubPage visual and functional verification', async ({ page }) => {
  // State for mocks
  let submissions = [
    {
      id: 1,
      reviewer_id: 101,
      track_url: "https://soundcloud.com/test/track",
      track_title: "My Awesome Track",
      status: "pending",
      submitted_at: new Date().toISOString(),
      user: { id: 1, username: "Test User" },
      priority_value: 0,
      start_time: "0:30"
    }
  ];

  let queueStats = {
    length: 5,
    avg_wait_time: 20,
    status: "open"
  };

  // 1. Mock Authentication and User Data
  await page.route('**/api/user/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        discord_id: "123456789",
        username: "Test User",
        avatar: "https://example.com/avatar.jpg",
        xp: 150,
        level: 3,
        roles: ["reviewer"],
        moderated_reviewers: [
          {
             id: 101,
             username: "Test Reviewer",
             tiktok_handle: "@testreviewer",
             queue_status: "open" // This is initial status in profile, but card fetches live stats
          }
        ]
      }),
    });
  });

  // 2. Mock Submissions
  await page.route('**/api/user/me/submissions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(submissions),
    });
  });

  // 3. Mock Submission Update (PATCH)
  await page.route('**/api/user/submissions/1', async route => {
    const payload = JSON.parse(route.request().postData() || '{}');
    submissions = submissions.map(s => {
        if (s.id === 1) {
            return {
                ...s,
                track_title: payload.track_title || s.track_title,
                start_time: payload.start_time || s.start_time,
                genre: payload.genre || s.genre,
                user: { ...s.user, tiktok_username: payload.tiktok_handle }
            };
        }
        return s;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(submissions.find(s => s.id === 1)),
    });
  });

  // 4. Mock Stats & Toggle
  await page.route('**/api/reviewer/101/stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(queueStats),
    });
  });

  await page.route('**/api/reviewer/101/queue/status', async route => {
     const payload = JSON.parse(route.request().postData() || '{}');
     queueStats.status = payload.status;
     await route.fulfill({
       status: 200,
       contentType: 'application/json',
       body: JSON.stringify(queueStats),
     });
  });

  // 5. Navigate to Hub
  await page.goto('http://localhost:5173/');

  // Set Auth Token
  await page.evaluate(() => {
    const authData = {
      state: {
        token: "fake-jwt-token",
        user: { id: 1, username: "Test User", roles: ["reviewer"] },
        isLoading: false
      },
      version: 0
    };
    localStorage.setItem('auth-storage', JSON.stringify(authData));
  });

  await page.goto('http://localhost:5173/hub');

  // 6. Verify Layout & Stats
  await expect(page.getByText('Your Balance')).toBeVisible();

  // Verify Queue Stats (fetched via API)
  await expect(page.getByText('Queue Status')).toBeVisible();
  // "Open" should appear.
  await expect(page.getByText('Open').first()).toBeVisible();
  // Stats: 5 tracks, 20 mins
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('20', { exact: true }).first()).toBeVisible();

  // 7. Verify Status Toggle
  // Click the toggle button (it's the container around Open/Closed in new card? No, it's the button)
  // In `QueueStatCard`, if isReviewer is true, it's a button.
  // We need to target it carefully.
  const toggleBtn = page.locator('button').filter({ hasText: 'Open' }).first();
  await toggleBtn.click();

  // Expect status to change to Closed
  await expect(page.getByText('Closed').first()).toBeVisible();
  await expect(page.getByText('Queue closed!')).toBeVisible(); // Toast

  // 8. Verify Submissions List
  await expect(page.getByText('My Awesome Track')).toBeVisible();

  // 9. Verify Edit Flow (same as before)
  await page.getByRole('button', { name: 'Edit Submission' }).click();
  await expect(page.getByText('Edit Submission')).toBeVisible();
  await page.getByPlaceholder('Artist - Song Name').fill('Updated Track Title');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Submission updated!')).toBeVisible();
  await expect(page.getByText('Updated Track Title')).toBeVisible();
});
