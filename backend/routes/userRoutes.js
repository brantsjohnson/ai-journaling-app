const express = require('express');
const router = express.Router();
const userController = require('./../controllers/userController');
const { authenticate } = require('./../middleware/auth');

// All user routes require authentication
router.use(authenticate);

router
    .post('/users', userController.createUser); // Get current user info

router
    .route('/users/:userId')
    .get(userController.getUser) // Get a user by ID
    .patch(userController.updateUser) // Update a user by ID
    .delete(userController.deleteUser); // Delete a user by ID

module.exports = router;