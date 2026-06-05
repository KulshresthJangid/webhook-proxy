const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Application = require('../models/Application');
const { forwardWebhook } = require('./forwarder');

// Match any request under /webhook
router.all('/*', async (req, res, next) => {
  // Parse paths manually to be robust against Express route wildcard quirks
  // req.path is path after /webhook. Example: /john/stripe/payment/success
  const pathParts = req.path.split('/').filter(p => p !== '');
  
  if (pathParts.length < 2) {
    // If it's just /webhook or /webhook/dashboard or /webhook/api
    const firstPart = pathParts[0]?.toLowerCase();
    if (firstPart === 'api' || firstPart === 'dashboard') {
      return next();
    }
    return res.status(400).json({ error: 'Invalid webhook endpoint format. Expected /webhook/:username/:appType' });
  }

  const username = pathParts[0];
  const appType = pathParts[1];

  // Reserve 'api' and 'dashboard' namespaces so they fall through
  if (username.toLowerCase() === 'api' || username.toLowerCase() === 'dashboard') {
    return next();
  }

  try {
    // 1. Resolve User
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(444).json({ error: `User account "${username}" not found.` }); // 444 custom status
    }

    // 2. Resolve Application Config
    const app = await Application.findOne({ 
      userId: user._id, 
      appType: appType.toLowerCase() 
    });

    if (!app) {
      return res.status(404).json({ error: `No configuration found for app type "${appType}" under user "${username}"` });
    }

    if (!app.isActive) {
      return res.status(403).json({ error: `Webhook proxy for ${app.name} is currently inactive` });
    }

    // 3. Extract sub-path (anything after /:username/:appType)
    // Example: parts are ['john', 'stripe', 'payment', 'success'] -> slice(2) is ['payment', 'success']
    const subPathParts = pathParts.slice(2);
    const urlPath = subPathParts.length > 0 ? '/' + subPathParts.join('/') : '/';

    const reqInfo = {
      method: req.method,
      urlPath,
      headers: req.headers,
      query: req.query,
      body: req.body
    };

    // 4. Forward the webhook synchronously and log it
    const log = await forwardWebhook(app, reqInfo);

    // Respond back to the sender
    if (req.method === 'GET' && (req.query['hub.challenge'] || req.query['hub_challenge'])) {
      // It's a Facebook/Meta webhook verification challenge
      res.status(log.responseStatus || 200).send(log.responseBody);
    } else {
      res.status(log.responseStatus || 502).json({
        deliveryId: log._id,
        deliveryStatus: log.deliveryStatus,
        targetStatus: log.responseStatus,
        latencyMs: log.latencyMs
      });
    }

  } catch (error) {
    console.error(`Error in webhook proxy route for /${username}/${appType}:`, error);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

module.exports = router;
