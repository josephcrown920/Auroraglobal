## Testing

### Running Tests

```bash
# Run all tests (desktop + mobile)
npm run test:e2e

# Run desktop tests only
npm run test:e2e -- --grep "^(?!.*mobile)"

# Run mobile tests only (430px viewport)
npm run test:e2e -- --grep "mobile"

# Run full production validation gate (lint → types → tests → build)
npm run production:gate
```

### Mobile Testing (430px)

Mobile tests validate the app experience on iPhone SE / low-end Android devices:
- **Home page** — Hero section, CTA, navigation visible at 430px
- **Studio page** — Upload, prompt input, generate button accessible
- **Lipsync page** — Video/audio uploads, sync button accessible  
- **Canvas page** — Node editor, toolbar, run button accessible

For detailed mobile testing guidance, see [`.github/MOBILE_TESTING.md`](.github/MOBILE_TESTING.md).

### Pre-Launch Validation

Before deploying to production, run:
```bash
npm run production:gate  # Passes all deployment checks
npm run test:e2e         # All tests (desktop + mobile) pass
curl http://localhost:8080/api/ready  # Health check responds 200
```

## Deployment

For complete launch procedures, environment setup, and rollback plans, see [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md).

### First Deploy
1. Ensure `main` branch is clean
2. Verify all secrets are set in Lovable Cloud → Project Settings → Secrets
3. Push to main — Lovable Cloud auto-deploys
4. Run smoke tests (see LAUNCH_CHECKLIST.md)

