const axios = require('axios');
const Application = require('../models/Application');
const WebhookLog = require('../models/WebhookLog');

/**
 * Forwards an incoming webhook request to the target application's endpoint.
 * Handles logging and schedules retries if configured.
 * 
 * @param {Object} app - Mongoose Application Document
 * @param {Object} reqInfo - Object containing { method, urlPath, headers, query, body }
 * @param {Object} [logRecord=null] - Existing Mongoose WebhookLog Document (for retries)
 */
async function forwardWebhook(app, reqInfo, logRecord = null) {
  const startTime = Date.now();
  
  // 1. Construct the destination URL, including sub-path support
  let destUrl = app.targetUrl;
  if (reqInfo.urlPath && reqInfo.urlPath !== '/') {
    const base = destUrl.replace(/\/+$/, '');
    const sub = reqInfo.urlPath.replace(/^\/+/, '');
    destUrl = `${base}/${sub}`;
  }
  
  // 2. Clean and build headers
  const headersToForward = { ...reqInfo.headers };
  
  // Remove host-specific and connection-specific headers to let axios handle them
  const headersToRemove = [
    'host',
    'connection',
    'content-length',
    'accept-encoding',
    'user-agent',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-port'
  ];
  headersToRemove.forEach(h => delete headersToForward[h]);
  
  // Append configured application headers
  if (app.headers && app.headers.length > 0) {
    app.headers.forEach(h => {
      headersToForward[h.key.toLowerCase()] = h.value;
    });
  }

  let responseStatus = null;
  let responseHeaders = null;
  let responseBody = null;
  let errorMsg = null;
  
  // 3. Make HTTP request to target
  try {
    const response = await axios({
      method: reqInfo.method,
      url: destUrl,
      params: reqInfo.query,
      data: reqInfo.body,
      headers: headersToForward,
      timeout: 10000, // 10s timeout
      validateStatus: () => true // Resolve on any status so we capture all error codes in logs
    });
    
    responseStatus = response.status;
    responseHeaders = response.headers;
    responseBody = response.data;
  } catch (error) {
    errorMsg = error.message;
    if (error.response) {
      responseStatus = error.response.status;
      responseHeaders = error.response.headers;
      responseBody = error.response.data;
    } else {
      responseBody = error.message;
    }
  }
  
  const latencyMs = Date.now() - startTime;
  const isSuccess = responseStatus >= 200 && responseStatus < 300;
  
  // Clean responseBody for DB storage
  let savedResponseBody = responseBody;
  if (responseBody && typeof responseBody === 'object') {
    savedResponseBody = responseBody;
  } else if (responseBody !== null && responseBody !== undefined) {
    savedResponseBody = String(responseBody);
  }
  
  const attempt = {
    timestamp: new Date(),
    responseStatus,
    responseBody: savedResponseBody,
    latencyMs,
    error: errorMsg
  };
  
  let currentLog = logRecord;
  if (!currentLog) {
    // 4. Create new Log record
    const maxRetries = app.retryConfig ? app.retryConfig.maxRetries : 3;
    const initialStatus = isSuccess ? 'success' : (maxRetries > 0 ? 'retrying' : 'failed');
    
    currentLog = new WebhookLog({
      applicationId: app._id,
      userId: app.userId,
      method: reqInfo.method,
      url: reqInfo.urlPath || '/',
      headers: reqInfo.headers,
      queryParams: reqInfo.query,
      body: reqInfo.body,
      deliveryStatus: initialStatus,
      attempts: [attempt],
      responseStatus,
      responseHeaders,
      responseBody: savedResponseBody,
      latencyMs
    });
  } else {
    // 5. Update existing Log record
    currentLog.attempts.push(attempt);
    currentLog.responseStatus = responseStatus;
    currentLog.responseHeaders = responseHeaders;
    currentLog.responseBody = savedResponseBody;
    currentLog.latencyMs = latencyMs;
    
    if (isSuccess) {
      currentLog.deliveryStatus = 'success';
    } else {
      const maxRetries = app.retryConfig ? app.retryConfig.maxRetries : 3;
      const attemptsCount = currentLog.attempts.length;
      // Note: attempts[0] is the initial try, subsequent elements are retries
      // So total retries made = attemptsCount - 1
      if (attemptsCount - 1 >= maxRetries) {
        currentLog.deliveryStatus = 'failed';
      } else {
        currentLog.deliveryStatus = 'retrying';
      }
    }
  }
  
  await currentLog.save();
  
  // 6. Schedule retry if failed and status is 'retrying'
  if (!isSuccess && currentLog.deliveryStatus === 'retrying') {
    scheduleRetry(app, reqInfo, currentLog);
  }
  
  return currentLog;
}

/**
 * Asynchronously schedules a retry for a failed webhook.
 */
function scheduleRetry(app, reqInfo, logRecord) {
  const delaySeconds = app.retryConfig ? app.retryConfig.delaySeconds : 5;
  const delayMs = delaySeconds * 1000;
  
  setTimeout(async () => {
    try {
      // Reload application to get the freshest configuration (in case it was deleted/modified)
      const freshApp = await Application.findById(app._id);
      if (!freshApp || !freshApp.isActive) {
        logRecord.deliveryStatus = 'failed';
        logRecord.attempts.push({
          timestamp: new Date(),
          error: 'Application is inactive or was deleted. Aborting retries.'
        });
        await logRecord.save();
        return;
      }
      
      await forwardWebhook(freshApp, reqInfo, logRecord);
    } catch (err) {
      console.error(`Error in scheduled retry for app ${app.name} (${app.appType}):`, err);
    }
  }, delayMs);
}

module.exports = {
  forwardWebhook
};
