export const authCookieOptions = {
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  ...(process.env.NODE_ENV === 'production' && { partitioned: true }),
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
