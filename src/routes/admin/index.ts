import { Hono } from 'hono';
import type { AppVariables, Env } from '../../env';
import { sessionAuth } from '../../lib/auth';
import { adminAuth } from './auth';
import { adminRobots } from './robots';
import { adminLogs } from './logs';

type AppEnv = { Bindings: Env; Variables: AppVariables };

export const admin = new Hono<AppEnv>();

// Unauthenticated endpoints
admin.route('/', adminAuth);

// Authenticated subtree
admin.use('/robots/*', sessionAuth);
admin.use('/robots', sessionAuth);
admin.use('/logs/*', sessionAuth);
admin.use('/logs', sessionAuth);

admin.get('/', sessionAuth, (c) => c.redirect('/admin/robots'));

admin.route('/robots', adminRobots);
admin.route('/logs', adminLogs);
