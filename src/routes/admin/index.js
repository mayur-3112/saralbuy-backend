import express from 'express';
import bannerRoute from './banner.route.js';
import authRoute from './auth.route.js';
import dashboardRoute from './dashboard.route.js';
import bidListRoute from './bidList.route.js';
import requirementListRoute from './requirementList.route.js';
const router = express.Router();

router.get('/', (_, res) => {
  res.end('Admin Route...');
});

const routes = [
  { path: '/banner', router: bannerRoute },
  { path: '/auth', router: authRoute },
  { path: '/dashboard', router: dashboardRoute },
  { path: '/bid', router: bidListRoute },
  { path: '/requirement', router: requirementListRoute },
];
routes.forEach(route => {
  router.use(route.path, route.router);
});

export default router;
