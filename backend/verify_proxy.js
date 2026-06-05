const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const http = require('http');

// Load configurations and models
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const WebhookLog = require('./src/models/WebhookLog');

const TEST_MONGODB_URI = 'mongodb://admin:dog8homework%3F@127.0.0.1:27017/webhook-proxy-test?authSource=admin';
const PROXY_PORT = 3300;
const MOCK_TARGET_PORT = 3400;

async function runVerification() {
  console.log('--- Starting Multi-Tenant Webhook Proxy Verification Test ---');
  
  // 1. Connect to test database
  console.log(`Connecting to MongoDB at: ${TEST_MONGODB_URI}`);
  await mongoose.connect(TEST_MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Clean databases
  await User.deleteMany({});
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
  process.env.JWT_SECRET = 'verification-jwt-secret';
  
  const serverModule = require('./src/server.js');
  // Wait a second for server to boot and connect to Mongoose
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`Webhook Proxy server running on port ${PROXY_PORT}`);

  try {
    // 4. Signup User A
    console.log('Registering User A...');
    const userASignup = await axios.post(`http://localhost:${PROXY_PORT}/webhook/api/auth/signup`, {
      username: 'usera',
      email: 'usera@example.com',
      password: 'password123'
    });
    const tokenA = userASignup.data.token;
    const userIdA = userASignup.data.user.id;
    console.log(`User A registered successfully. ID: ${userIdA}`);

    // Signup User B
    console.log('Registering User B...');
    const userBSignup = await axios.post(`http://localhost:${PROXY_PORT}/webhook/api/auth/signup`, {
      username: 'userb',
      email: 'userb@example.com',
      password: 'password123'
    });
    const tokenB = userBSignup.data.token;
    const userIdB = userBSignup.data.user.id;
    console.log(`User B registered successfully. ID: ${userIdB}`);

    // 5. Create an Application Config for User A
    console.log('Registering "slack-test" route for User A...');
    const appConfigPayload = {
      name: 'User A Slack App',
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

    const configRes = await axios.post(`http://localhost:${PROXY_PORT}/webhook/api/apps`, appConfigPayload, {
      headers: {
        'Authorization': `Bearer ${tokenA}`
      }
    });
    
    const createdAppId = configRes.data._id;
    console.log(`Application registered for User A. ID: ${createdAppId}`);
    
    // 6. Send Webhook to User A's Proxy Path
    console.log('Sending webhook to User A\'s proxy path...');
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
      `http://localhost:${PROXY_PORT}/webhook/usera/slack-test/events?foo=bar`,
      webhookPayload,
      { headers: webhookHeaders }
    );

    console.log('Proxy response status:', proxyRes.status);
    console.log('Proxy response body:', proxyRes.data);

    // 7. Verify Isolation (Send webhook to User B's proxy path)
    console.log('Sending webhook to User B\'s (unconfigured) proxy path...');
    let userBErrorStatus = null;
    try {
      await axios.post(
        `http://localhost:${PROXY_PORT}/webhook/userb/slack-test/events?foo=bar`,
        webhookPayload,
        { headers: webhookHeaders }
      );
    } catch (err) {
      userBErrorStatus = err.response.status;
    }
    console.log(`User B endpoint response status (expected 404): ${userBErrorStatus}`);

    // 8. Run Assertions
    console.log('\n--- Running Assertions ---');
    
    // Assert proxy response for User A
    if (proxyRes.status !== 200) {
      throw new Error(`Expected proxy response status 200, got ${proxyRes.status}`);
    }
    if (proxyRes.data.deliveryStatus !== 'success') {
      throw new Error(`Expected deliveryStatus to be success, got ${proxyRes.data.deliveryStatus}`);
    }

    // Assert User B route isolation
    if (userBErrorStatus !== 404) {
      throw new Error(`Expected User B unconfigured path to return 404, got ${userBErrorStatus}`);
    }
    console.log('[PASS] Route isolation verified (User B endpoint returns 404).');

    // Assert mock target received details
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
    if (String(dbLog.userId) !== String(userIdA)) {
      throw new Error(`Expected logged userId to match User A's ID, got ${dbLog.userId}`);
    }
    console.log('[PASS] Webhook delivery log was saved with correct user scoping.');

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
