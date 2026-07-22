import { router, json } from '@appdeploy/sdk';
import { realtimeSubscriptionRoutes } from './realtime-subscribers';
import { appRoutes } from './app-routes';

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  ...appRoutes,
  ...realtimeSubscriptionRoutes,
});
