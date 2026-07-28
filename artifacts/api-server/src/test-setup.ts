/**
 * Global test setup — runs before any test file is loaded.
 * Sets required env vars so module-level captures (e.g. PAYSTACK_SECRET_KEY)
 * see the right values.
 */
process.env.PAYSTACK_SECRET_KEY = "test_paystack_secret_key";
// Suppress pino-http noise during tests
process.env.LOG_LEVEL = "silent";
