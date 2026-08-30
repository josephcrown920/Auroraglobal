# CI/CD Testing Pipeline Guide

## Overview

Our CI/CD pipeline automatically runs tests on every pull request to catch bugs before merge. This guide explains how the pipeline works and how to handle failures.

## Test Suites

### Desktop Tests
Default Playwright tests running on standard desktop viewport (1280x720+).

**Run locally:**
```bash
npm run test:e2e
```

### Mobile Tests (430px)
Mobile-specific tests validating iPhone SE / low-end Android experience.

**Run locally:**
```bash
npm run test:e2e -- --grep "mobile"
```

**What's tested:**
- 430px viewport (iPhone SE standard)
- All key pages: Home, Studio, Lipsync, Canvas
- Element visibility, accessibility, no horizontal scroll
- Touch target sizes and interactive element positioning

## CI Workflow

1. **On PR creation/update**: Automatically runs all tests
2. **Both desktop & mobile tests must pass** to merge
3. **Artifacts preserved** for 30 days if tests fail

## Handling Test Failures

### Mobile Tests Failed

1. **Check the error message in GitHub Actions**
   - Failed assertions tell you what broke
   - Screenshots/traces attached to run

2. **Run locally to reproduce:**
   ```bash
   npm run test:e2e -- --grep "mobile" --headed
   ```

3. **Common causes:**
   - CSS breakpoint changes at 430px
   - Interactive elements pushed off-screen
   - Missing `data-testid` attributes
   - Overflow/horizontal scroll issues

4. **Fix checklist:**
   - [ ] Verify CSS media queries work at 430px
   - [ ] Check all buttons/inputs are accessible
   - [ ] Test no horizontal scroll
   - [ ] Verify touch targets are ≥44px
   - [ ] Run tests locally before pushing

### Desktop Tests Failed

Same process, but for standard viewport issues:
```bash
npm run test:e2e --headed
```

## Debugging Tips

### View test execution
```bash
npm run test:e2e -- --headed --grep "mobile"
```

### Generate detailed trace
```bash
npm run test:e2e -- --trace on --grep "mobile"
```

### Check artifacts
- Go to GitHub Actions run
- Download "playwright-report" artifact
- Open `index.html` in browser

## Adding Tests to CI

Mobile tests automatically run via `.github/workflows/ci.yml`.

To add a new mobile test:
1. Edit `e2e/mobile.spec.ts`
2. Add test to `test.describe("Mobile viewport (430px)")`
3. Push - CI runs automatically

To run only your new test locally:
```bash
npm run test:e2e -- --grep "My new test name"
```

## Performance Notes

- Desktop + mobile test suite: ~5-10 min total
- Mobile tests alone: ~2-3 min
- Parallel runs speed up CI execution

## Questions?

Refer to `MOBILE_TESTING.md` for detailed mobile testing guidance.
