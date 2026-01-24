const express = require('express');
const router = express.Router();
const entryController = require('./../controllers/entryController');
const { authenticate } = require('./../middleware/auth');

// #region agent log
const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
dbgLog('entryRoutes.js:setup', 'Entry routes setup', { hasAuthenticate: !!authenticate, hasEntryController: !!entryController }, 'H6');
// #endregion

// All entry routes require authentication
// #region agent log
dbgLog('entryRoutes.js:use-auth', 'Applying auth middleware', {}, 'H6');
// #endregion
router.use(authenticate);

router
    .route('/users/:userId/entries')
    .get((req, res, next) => {
      // #region agent log
      dbgLog('entryRoutes.js:get-entries-route', 'GET /users/:userId/entries matched', { method: req.method, url: req.url, params: req.params, userId: req.params.userId }, 'H6');
      console.log('[DEBUG] EntryRoutes: GET /users/:userId/entries matched', req.params);
      // #endregion
      entryController.getAllEntries(req, res, next);
    })
    .post((req, res, next) => {
      // #region agent log
      const dbgLog2 = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
      dbgLog2('entryRoutes.js:post-entries-route:matched', 'POST /users/:userId/entries ROUTE MATCHED', { method: req.method, url: req.url, originalUrl: req.originalUrl, path: req.path, params: req.params, userId: req.params.userId, hasBody: !!req.body, bodyKeys: req.body ? Object.keys(req.body) : [], hasUser: !!req.user, userType: req.user ? (req.user.supabaseUser ? 'supabase' : 'jwt') : 'none' }, 'H1,H2,H3,H4');
      console.log('[DEBUG] EntryRoutes: POST /users/:userId/entries matched', { params: req.params, body: req.body, url: req.url, path: req.path });
      // #endregion
      entryController.createEntry(req, res, next);
    });

router
    .route('/users/:userId/entries/:entryId')
    .get(entryController.getEntry) // Get an entry by ID
    .patch(entryController.updateEntry) // Update an entry by ID
    .delete(entryController.deleteEntry); // Delete an entry by ID

router
    .get('/users/:userId/entries/date/:date', entryController.getEntriesByDate); // Get entries by date for a user

// Per-day Google Drive sync settings (placeholder for future implementation)
router
    .patch(
        '/users/:userId/days/:date/sync-settings',
        entryController.updateDaySyncSettings
    );

module.exports = router;