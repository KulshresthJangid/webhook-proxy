const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const proxyRouter = require('./routes/proxy');
const apiRouter = require('./routes/api');

const app = express();

// 1. Configure Middlewares
app.use(cors());

// Custom raw body verification handler (useful if we want rawBody for signature verification)
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(express.json({ limit: '10mb', verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, limit: '10mb', verify: rawBodySaver }));
// Fallback text parser for non-JSON/non-urlencoded webhooks (e.g. XML, plain text)
app.use(express.text({ type: '*/*', limit: '10mb' }));

// 2. Set up Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 3. Register Routes
// Webhook proxy endpoints (Dynamic routing)
app.use('/webhook', proxyRouter);

// Admin / Dashboard configuration endpoints (Moved under /webhook/api to prevent Nginx conflict)
app.use('/webhook/api', apiRouter);

// 4. Serve Static Frontend Files in Production (Moved under /webhook/dashboard)
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use('/webhook/dashboard', express.static(frontendBuildPath));

// Fallback all sub-routes under /webhook/dashboard to index.html for React Router
app.get('/webhook/dashboard*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 5. Connect to MongoDB and start Server
console.log('Connecting to MongoDB...');
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    app.listen(config.PORT, () => {
      console.log(`Webhook Proxy server running on port ${config.PORT}`);
      console.log(`- Webhook receiver base path: http://localhost:${config.PORT}/webhook/:appType`);
      console.log(`- Management dashboard URL:   http://localhost:${config.PORT}/webhook/dashboard`);
      console.log(`- Dashboard configuration API: http://localhost:${config.PORT}/webhook/api`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
