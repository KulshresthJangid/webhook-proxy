const express = require('express');
const axios = require('axios');
const config = require('../config');

const router = express.Router();

function extractKey(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  if (req.body && typeof req.body.api_key === 'string') {
    return req.body.api_key;
  }
  return null;
}

function requireApiKey(req, res, next) {
  const key = extractKey(req);
  if (!key || key !== config.OLLAMA_PROXY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const UPSTREAM_PATHS = {
  generate: '/api/generate',
  chat: '/api/chat',
  tags: '/api/tags',
};

async function forwardToOllama(req, res, method, upstreamPath) {
  try {
    const { api_key, ...payload } = req.body || {};
    const upstream = await axios({
      method,
      url: `${config.OLLAMA_URL}${upstreamPath}`,
      data: method === 'get' ? undefined : payload,
      responseType: 'stream',
      timeout: 0,
      validateStatus: () => true,
    });

    res.status(upstream.status);
    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    }
    upstream.data.pipe(res);
  } catch (err) {
    console.error('Error proxying to Ollama:', err.message);
    res.status(502).json({ error: 'Bad Gateway', detail: err.message });
  }
}

router.post('/generate', requireApiKey, (req, res) => forwardToOllama(req, res, 'post', UPSTREAM_PATHS.generate));
router.post('/chat', requireApiKey, (req, res) => forwardToOllama(req, res, 'post', UPSTREAM_PATHS.chat));
router.get('/tags', requireApiKey, (req, res) => forwardToOllama(req, res, 'get', UPSTREAM_PATHS.tags));

module.exports = router;
