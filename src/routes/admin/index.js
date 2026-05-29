import express from 'express';
import bannerRoute from './banner.route.js';
import authRoute from './auth.route.js';
const router = express.Router();

router.get('/', (_, res) => {
  res.end('Admin Route...');
});

const routes = [
  { path: '/banner', router: bannerRoute },
  { path: '/auth', router: authRoute },
];
routes.forEach(route => {
  router.use(route.path, route.router);
});

export default router;
