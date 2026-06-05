const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const { forwardWebhook } = require('./forwarder');

// Match base endpoint and any sub-path (using regex wildcard in express)
router.all('/:appType*', async (req, res) => {
  const { appType } = req.params;
  
  try {
    // Find application config
    const app = await Application.findOne({ appType: appType.toLowerCase() });
    if (!app) {
      return res.status(404).json({ error: `No configuration found for app type: ${appType}` });
    }
    
    if (!app.isActive) {
      return res.status(403).json({ error: `Webhook proxy for ${app.name} is currently inactive` });
    }
    
    // Extract subpath from req.params[0] (which matches the wildcard '*' in Express)
    const urlPath = req.params[0] || '/';
    
    const reqInfo = {
      method: req.method,
      urlPath,
      headers: req.headers,
      query: req.query,
      body: req.body
    };
    
    // Forward the webhook synchronously and log it
    const log = await forwardWebhook(app, reqInfo);
    
    // Respond back to the sender with the status from the target application,
    // plus metadata about the delivery attempt.
    res.status(log.responseStatus || 502).json({
      deliveryId: log._id,
      deliveryStatus: log.deliveryStatus,
      targetStatus: log.responseStatus,
      latencyMs: log.latencyMs
    });
    
  } catch (error) {
    console.error(`Error in webhook proxy route for ${appType}:`, error);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

module.exports = router;
