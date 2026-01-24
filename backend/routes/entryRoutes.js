const express = require('express');
const router = express.Router();
const entryController = require('./../controllers/entryController');
const { authenticate } = require('./../middleware/auth');

// All entry routes require authentication
router.use(authenticate);

router
    .route('/users/:userId/entries')
    .get(entryController.getAllEntries) // Get all entries for a user
    .post(entryController.createEntry); // Create a new entry for a user

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