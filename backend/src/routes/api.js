const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const WebhookLog = require('../models/WebhookLog');
const { forwardWebhook } = require('./forwarder');
const config = require('../config');

// Middleware to authenticate requests to the admin API
const adminAuth = (req, res, next) => {
  if (config.ADMIN_API_KEY) {
    const key = req.headers['x-api-key'] || req.query.apiKey;
    if (key !== config.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
  }
  next();
};

// Apply auth middleware to all API routes
router.use(adminAuth);

/* -------------------------------------------------------------------------- */
/*                          Application Configurations                        */
/* -------------------------------------------------------------------------- */

// GET all applications
router.get('/apps', async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create application
router.post('/apps', async (req, res) => {
  const { name, appType, targetUrl, isActive, headers, retryConfig } = req.body;
  try {
    const app = new Application({
      name,
      appType,
      targetUrl,
      isActive,
      headers,
      retryConfig
    });
    await app.save();
    res.status(201).json(app);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: `Application type "${appType}" is already in use.` });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT update application
router.put('/apps/:id', async (req, res) => {
  const { id } = req.params;
  const { name, appType, targetUrl, isActive, headers, retryConfig } = req.body;
  try {
    const app = await Application.findById(id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    app.name = name !== undefined ? name : app.name;
    app.appType = appType !== undefined ? appType : app.appType;
    app.targetUrl = targetUrl !== undefined ? targetUrl : app.targetUrl;
    app.isActive = isActive !== undefined ? isActive : app.isActive;
    app.headers = headers !== undefined ? headers : app.headers;
    app.retryConfig = retryConfig !== undefined ? retryConfig : app.retryConfig;

    await app.save();
    res.json(app);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: `Application type "${appType}" is already in use.` });
    }
    res.status(400).json({ error: error.message });
  }
});

// DELETE application (and its logs)
router.delete('/apps/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const app = await Application.findByIdAndDelete(id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }
    // Delete all associated logs
    await WebhookLog.deleteMany({ applicationId: id });
    res.json({ message: `Successfully deleted application "${app.name}" and all its logs.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/* -------------------------------------------------------------------------- */
/*                                Webhook Logs                                */
/* -------------------------------------------------------------------------- */

// GET logs with filtering and pagination
router.get('/logs', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const query = {};
  
  if (req.query.applicationId) {
    query.applicationId = req.query.applicationId;
  }
  
  if (req.query.status) {
    query.deliveryStatus = req.query.status;
  }

  try {
    const total = await WebhookLog.countDocuments(query);
    const logs = await WebhookLog.find(query)
      .populate('applicationId', 'name appType')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST manual retry for a specific log
router.post('/logs/:id/retry', async (req, res) => {
  const { id } = req.params;
  try {
    const log = await WebhookLog.findById(id).populate('applicationId');
    if (!log) {
      return res.status(404).json({ error: 'Webhook log entry not found' });
    }

    const app = log.applicationId;
    if (!app) {
      return res.status(400).json({ error: 'The parent application for this log has been deleted.' });
    }

    // Reconstruct the request parameters
    const reqInfo = {
      method: log.method,
      urlPath: log.url,
      headers: log.headers,
      query: log.queryParams,
      body: log.body
    };

    // Forward webhook, passing the same log record to append attempts
    const updatedLog = await forwardWebhook(app, reqInfo, log);

    res.json({
      message: 'Retry initiated successfully',
      log: updatedLog
    });
  } catch (error) {
    console.error('Failed to manually retry webhook:', error);
    res.status(500).json({ error: error.message });
  }
});


/* -------------------------------------------------------------------------- */
/*                               Dashboard Stats                              */
/* -------------------------------------------------------------------------- */

router.get('/stats', async (req, res) => {
  try {
    // Total count of apps
    const totalApps = await Application.countDocuments();
    const activeApps = await Application.countDocuments({ isActive: true });

    // Aggregated stats from WebhookLogs
    const logsStats = await WebhookLog.aggregate([
      {
        $group: {
          _id: null,
          totalWebhooks: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$deliveryStatus', 'success'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$deliveryStatus', 'failed'] }, 1, 0] }
          },
          retryingCount: {
            $sum: { $cond: [{ $eq: ['$deliveryStatus', 'retrying'] }, 1, 0] }
          },
          avgLatency: { $avg: '$latencyMs' }
        }
      }
    ]);

    const stats = logsStats[0] || {
      totalWebhooks: 0,
      successCount: 0,
      failedCount: 0,
      retryingCount: 0,
      avgLatency: 0
    };

    // Webhooks in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const webhooksLast24h = await WebhookLog.countDocuments({
      timestamp: { $gte: oneDayAgo }
    });

    // App-by-app success rates
    const appBreakdown = await WebhookLog.aggregate([
      {
        $group: {
          _id: '$applicationId',
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ['$deliveryStatus', 'success'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$deliveryStatus', 'failed'] }, 1, 0] }
          },
          avgLatency: { $avg: '$latencyMs' }
        }
      }
    ]);

    // Populate app details manually from DB or map them
    const apps = await Application.find({}, 'name appType');
    const appMap = {};
    apps.forEach(a => {
      appMap[a._id.toString()] = { name: a.name, appType: a.appType };
    });

    const breakdownWithDetails = appBreakdown.map(item => {
      const appDetails = appMap[item._id?.toString()] || { name: 'Deleted Application', appType: 'deleted' };
      return {
        applicationId: item._id,
        name: appDetails.name,
        appType: appDetails.appType,
        total: item.total,
        success: item.success,
        failed: item.failed,
        successRate: item.total > 0 ? Math.round((item.success / item.total) * 100) : 0,
        avgLatencyMs: Math.round(item.avgLatency || 0)
      };
    });

    res.json({
      overview: {
        totalApps,
        activeApps,
        totalWebhooks: stats.totalWebhooks,
        successCount: stats.successCount,
        failedCount: stats.failedCount,
        retryingCount: stats.retryingCount,
        avgLatencyMs: Math.round(stats.avgLatency || 0),
        webhooksLast24h
      },
      appBreakdown: breakdownWithDetails
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
