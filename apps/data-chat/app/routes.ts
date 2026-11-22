import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('d/:id', 'routes/dataset.tsx'),
] satisfies RouteConfig;
