import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Dev-mode env: routes the OTP endpoints to the testable dev stub
    // (userController.sendOtp/verifyOtp) instead of the real SMS-provider
    // path (factorSendOtp/factorVerifyOtp) — see src/routes/user.route.js.
    env: { NODE_ENV: 'development' },
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    // All test files share ONE in-memory MongoDB instance (see
    // globalSetup.js), and tests/setup.js clears every collection after
    // each test. Running files in parallel let one file's cleanup wipe
    // another file's still-in-flight data — surfaced as a flaky
    // "expected document not to be null" failure once a second test file
    // was added. Sequential execution trades some suite speed for
    // determinism, which matters more at this size.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
