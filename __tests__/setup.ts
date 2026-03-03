// Set dummy env vars for testing — no real credentials needed
process.env.NEXT_PUBLIC_LOGIN3_DOMAIN = "https://login3.test.example.com";
process.env.NEXT_PUBLIC_LOGIN3_CLIENT_ID = "test-login3-client-id";
process.env.NEXT_PUBLIC_LOGIN3_REDIRECT_URI =
  "http://localhost:3000/api/auth/callback";
process.env.NEXT_PUBLIC_LOGIN3_SCOPES = "openid profile email wallet";

// CDP dummy env vars (prevent import-time errors)
process.env.CDP_API_KEY_ID = "test-cdp-key-id";
process.env.CDP_API_KEY_SECRET = "test-cdp-key-secret";
process.env.CDP_WALLET_SECRET = "test-cdp-wallet-secret";
