const { Router } = require('express');
const devices = require('../controller/deviceController');
const { requireSdkKey } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

/**
 * Public endpoints called by the mobile apps themselves.
 * Auth: `x-api-key: <app sdkApiKey>` header.
 */
const router = Router();
router.use(asyncHandler(requireSdkKey));

router.post('/devices/register', asyncHandler(devices.sdkRegister));
router.post('/devices/unregister', asyncHandler(devices.sdkUnregister));
router.post('/devices/tags', asyncHandler(devices.sdkUpdateTags));

module.exports = router;
