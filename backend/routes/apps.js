const { Router } = require('express');
const apps = require('../controller/appController');
const devices = require('../controller/deviceController');
const notifications = require('../controller/notificationController');
const ai = require('../controller/aiController');
const { requireAuth, loadOwnedApp } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = Router();
router.use(requireAuth);

// Apps
router.get('/', asyncHandler(apps.list));
router.post('/', asyncHandler(apps.create));
router.get('/:appId', asyncHandler(loadOwnedApp), asyncHandler(apps.get));
router.patch('/:appId', asyncHandler(loadOwnedApp), asyncHandler(apps.update));
router.delete('/:appId', asyncHandler(loadOwnedApp), asyncHandler(apps.remove));
router.get('/:appId/overview', asyncHandler(loadOwnedApp), asyncHandler(apps.overview));
router.post('/:appId/sdk-key/rotate', asyncHandler(loadOwnedApp), asyncHandler(apps.rotateSdkKey));
router.put('/:appId/fcm', asyncHandler(loadOwnedApp), asyncHandler(apps.setFcmCredentials));
router.delete('/:appId/fcm', asyncHandler(loadOwnedApp), asyncHandler(apps.clearFcmCredentials));

// Devices
router.get('/:appId/devices', asyncHandler(loadOwnedApp), asyncHandler(devices.list));
router.post('/:appId/devices', asyncHandler(loadOwnedApp), asyncHandler(devices.addManual));
router.delete('/:appId/devices/:deviceId', asyncHandler(loadOwnedApp), asyncHandler(devices.remove));

// Notifications
router.get('/:appId/notifications', asyncHandler(loadOwnedApp), asyncHandler(notifications.list));
router.post('/:appId/notifications', asyncHandler(loadOwnedApp), asyncHandler(notifications.create));
router.post('/:appId/notifications/estimate', asyncHandler(loadOwnedApp), asyncHandler(notifications.estimate));
router.post('/:appId/notifications/test', asyncHandler(loadOwnedApp), asyncHandler(notifications.sendTest));
router.get('/:appId/notifications/:notificationId', asyncHandler(loadOwnedApp), asyncHandler(notifications.get));
router.patch('/:appId/notifications/:notificationId', asyncHandler(loadOwnedApp), asyncHandler(notifications.update));
router.delete('/:appId/notifications/:notificationId', asyncHandler(loadOwnedApp), asyncHandler(notifications.remove));
router.post('/:appId/notifications/:notificationId/send', asyncHandler(loadOwnedApp), asyncHandler(notifications.sendNow));
router.post('/:appId/notifications/:notificationId/cancel', asyncHandler(loadOwnedApp), asyncHandler(notifications.cancel));
router.post('/:appId/notifications/:notificationId/duplicate', asyncHandler(loadOwnedApp), asyncHandler(notifications.duplicate));

// AI composer
router.post('/:appId/ai/generate', asyncHandler(loadOwnedApp), asyncHandler(ai.generate));
router.post('/:appId/ai/refine', asyncHandler(loadOwnedApp), asyncHandler(ai.refine));

module.exports = router;
