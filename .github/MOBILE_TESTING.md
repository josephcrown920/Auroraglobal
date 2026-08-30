# Mobile Testing Guidelines

## Running Mobile Tests

```bash
# Mobile tests only
npm run test:e2e -- --grep "mobile"

# All tests (desktop + mobile)
npm run test:e2e

# Specific mobile test
npm run test:e2e -- --grep "Studio page is usable"
```

## Adding New Mobile Tests

1. Open `e2e/mobile.spec.ts`
2. Add test within the `test.describe("Mobile viewport (430px)")` block:

```typescript
test("My feature works at 430px", async ({ page }) => {
  await page.goto("/my-feature");
  await page.setViewportSize({ width: 430, height: 932 });
  
  // Your assertions here
  await expect(page.locator('[data-testid="element"]')).toBeVisible();
});
```

## Debugging Mobile Test Failures

- Run with `--headed` to see browser: `npm run test:e2e -- --headed --grep "mobile"`
- Check screenshot: `.test-results/` folder
- Enable trace: `--trace on`

## Mobile Viewport Sizes Supported

| Device | Width | Height |
|--------|-------|--------|
| iPhone SE / 12 / 13 | 430px | 932px |
| iPhone 14/15 | 390px | 844px |
| Android (low-end) | 360px | 640px |

Current tests validate **430px** as baseline.

## CI/CD Integration

Mobile tests run automatically on every PR via `.github/workflows/ci.yml` to ensure mobile UX isn't broken before merge.

**If mobile tests fail in CI:**
1. Run locally: `npm run test:e2e -- --grep "mobile" --headed`
2. Check viewport-related CSS changes
3. Ensure all interactive elements fit within 430px
4. View failed screenshots in GitHub Actions artifacts
