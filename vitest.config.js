import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Dev-mode env: routes the OTP endpoints to the testable dev stub
    // (userController.sendOtp/verifyOtp) instead of the real SMS-provider
    // path (factorSendOtp/factorVerifyOtp) — see src/routes/user.route.js.
    env: { NODE_ENV: 'development' },
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
