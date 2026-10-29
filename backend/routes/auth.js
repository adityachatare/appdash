const { Router } = require('express');
const ctrl = require('../controller/authController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = Router();

router.post('/register', asyncHandler(ctrl.register));
router.post('/login', asyncHandler(ctrl.login));
router.get('/me', requireAuth, asyncHandler(ctrl.me));

module.exports = router;
