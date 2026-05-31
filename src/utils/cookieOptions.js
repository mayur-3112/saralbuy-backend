  export const authCookieOptions = {
    sameSite: 'None',
    httpOnly: true,
    secure: true,
    path: '/',
    partitioned: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
