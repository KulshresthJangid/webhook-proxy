const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const http = require('http');

// Load configurations and models
const Application = require('./src/models/Application');
const WebhookLog = require('./src/models/WebhookLog');

const TEST_MONGODB_URI = 'mongodb://chargemyev:chargemyev123@127.0.0.1:27017/webhook-proxy-test?authSource=admin';
const PROXY_PORT = 3300;
const MOCK_TARGET_PORT = 3400;

async function runVerification() {
  console.log('--- Starting Webhook Proxy Verification Integration Test ---');
  
  // 1. Connect to test database
  console.log(`Connecting to MongoDB at: ${TEST_MONGODB_URI}`);
  await mongoose.connect(TEST_MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Clean databases
  await Application.deleteMany({});
  await WebhookLog.deleteMany({});
  console.log('Cleaned test database collections.');

  // 2. Start Mock Target Webhook Application Server
  let mockTargetReceivedRequest = null;
  const mockTargetApp = express();
  mockTargetApp.use(express.json());
  mockTargetApp.use(express.text({ type: '*/*' }));
  
  mockTargetApp.post('/target-webhook/events', (req, res) => {
    console.log('-> Mock target received request:');
    console.log('   Headers:', req.headers);
    console.log('   Body:', req.body);
    
    mockTargetReceivedRequest = {
      headers: req.headers,
      body: req.body,
      url: req.url,
      method: req.method
    };
    
    res.status(200).json({ success: true, message: 'Received successfully' });
  });

  const mockTargetServer = http.createServer(mockTargetApp);
  await new Promise((resolve) => mockTargetServer.listen(MOCK_TARGET_PORT, resolve));
  console.log(`Mock Target server listening on port ${MOCK_TARGET_PORT}`);

  // 3. Start Webhook Proxy Server
  process.env.MONGODB_URI = TEST_MONGODB_URI;
  process.env.PORT = PROXY_PORT;
  process.env.ADMIN_API_KEY = 'test-secret-key';
  
  const serverModule = require('./src/server.js');
  // Wait a second for server to boot and connect to Mongoose
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`Webhook Proxy server running on port ${PROXY_PORT}`);

  try {
    // 4. Create an Application Config via API
    console.log('Creating application proxy route via API...');
    const appConfigPayload = {
      name: 'Slack Integration Test',
      appType: 'slack-test',
      targetUrl: `http://localhost:${MOCK_TARGET_PORT}/target-webhook`,
      isActive: true,
      headers: [
        { key: 'X-Custom-Forwarded', value: 'AntigravityVerified' }
      ],
      retryConfig: {
        maxRetries: 2,
        delaySeconds: 1
      }
    };

    const configRes = await axios.post(`http://localhost:${PROXY_PORT}/api/apps`, appConfigPayload, {
      headers: {
        'x-api-key': 'test-secret-key'
      }
    });
    
    const createdAppId = configRes.data._id;
    console.log(`Application registered. ID: ${createdAppId}`);
    
    // 5. Send Webhook to the Proxy
    console.log('Sending webhook to proxy receiver...');
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'message_created',
      'X-Test-Sender': 'GitHubWebhook'
    };
    const webhookPayload = {
      text: 'Hello from verification script',
      user: 'antigravity-bot'
    };

    const proxyRes = await axios.post(
      `http://localhost:${PROXY_PORT}/webhook/slack-test/events?foo=bar`,
      webhookPayload,
      { headers: webhookHeaders }
    );

    console.log('Proxy response status:', proxyRes.status);
    console.log('Proxy response body:', proxyRes.data);

    // 6. Perform Assertions
    console.log('\n--- Running Assertions ---');
    
    if (proxyRes.status !== 200) {
      throw new Error(`Expected proxy response status 200, got ${proxyRes.status}`);
    }
    if (proxyRes.data.deliveryStatus !== 'success') {
      throw new Error(`Expected deliveryStatus to be success, got ${proxyRes.data.deliveryStatus}`);
    }

    if (!mockTargetReceivedRequest) {
      throw new Error('Mock target server did not receive the forwarded webhook!');
    }
    console.log('[PASS] Mock target received the webhook.');

    if (mockTargetReceivedRequest.url !== '/target-webhook/events?foo=bar') {
      throw new Error(`Expected url to be "/target-webhook/events?foo=bar", got "${mockTargetReceivedRequest.url}"`);
    }
    console.log('[PASS] Wildcard sub-path and query parameters were forwarded successfully.');

    if (mockTargetReceivedRequest.headers['x-custom-forwarded'] !== 'AntigravityVerified') {
      throw new Error(`Expected custom header "X-Custom-Forwarded" to be "AntigravityVerified", got "${mockTargetReceivedRequest.headers['x-custom-forwarded']}"`);
    }
    console.log('[PASS] Configured custom headers were merged and forwarded successfully.');

    if (mockTargetReceivedRequest.body.text !== 'Hello from verification script') {
      throw new Error(`Expected body to match, got ${JSON.stringify(mockTargetReceivedRequest.body)}`);
    }
    console.log('[PASS] Request payload body was forwarded correctly.');

    // Assert Log Database entry
    const dbLogs = await WebhookLog.find({ applicationId: createdAppId });
    if (dbLogs.length !== 1) {
      throw new Error(`Expected 1 log entry in database, found ${dbLogs.length}`);
    }
    
    const dbLog = dbLogs[0];
    if (dbLog.deliveryStatus !== 'success') {
      throw new Error(`Expected logged deliveryStatus to be "success", got "${dbLog.deliveryStatus}"`);
    }
    if (dbLog.responseStatus !== 200) {
      throw new Error(`Expected logged responseStatus to be 200, got ${dbLog.responseStatus}`);
    }
    console.log('[PASS] Webhook delivery log was saved in MongoDB correctly.');

    console.log('\n=========================================');
    console.log('   VERIFICATION SUCCESSFUL! ALL TESTS PASS ');
    console.log('=========================================\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up resources...');
    await new Promise((resolve) => mockTargetServer.close(resolve));
    await mongoose.connection.close();
    console.log('Closed MongoDB connection.');
    
    setTimeout(() => {
      process.exit();
    }, 500);
  }
}

runVerification();
