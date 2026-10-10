require('dotenv').config(); // optional, will ignore if .env not present
const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const dns = require('dns');

const app = express();

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// GET / – serve index.html (handled by static middleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  if (process.env.FAILOVER_MODE === 'unhealthy') {
    return res.status(503).json({ status: 'unhealthy' });
  }
  res.json({ status: 'healthy' });
});

// Demo Control Auth Middleware
const checkDemoAuth = (req, res, next) => {
  const token = process.env.DEMO_CONTROL_TOKEN;
  if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Demo control not configured' });
  
  const providedToken = req.headers['x-demo-token'];
  if (providedToken !== token) return res.status(401).json({ error: 'Unauthorized' });
  
  next();
};

const { GoogleAuth } = require('google-auth-library');

async function setFailoverMode(mode) {
  const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
  let client;
  try {
    client = await auth.getClient();
  } catch (err) {
    throw new Error('Google Cloud credentials not available locally.');
  }

  const projectId = 'cloud-dns-failover-demo-511215';
  const url = `https://run.googleapis.com/v2/projects/${projectId}/locations/asia-south1/services/failover-primary`;

  const getRes = await client.request({ url, method: 'GET' });
  const service = getRes.data;

  if (!service.template.containers[0].env) {
    service.template.containers[0].env = [];
  }
  let envs = service.template.containers[0].env;
  let found = false;
  for (let env of envs) {
    if (env.name === 'FAILOVER_MODE') {
      env.value = mode;
      found = true;
      break;
    }
  }
  if (!found) {
    envs.push({ name: 'FAILOVER_MODE', value: mode });
  }

  const patchRes = await client.request({
    url: `${url}?updateMask=template.containers`,
    method: 'PATCH',
    data: { template: { containers: service.template.containers } }
  });

  const opName = patchRes.data.name;
  let done = false;
  while (!done) {
    await new Promise(r => setTimeout(r, 2000));
    const opRes = await client.request({
      url: `https://run.googleapis.com/v2/${opName}`,
      method: 'GET'
    });
    if (opRes.data.done) {
      if (opRes.data.error) throw new Error(opRes.data.error.message);
      done = true;
    }
  }
}

app.post('/api/demo/fail-primary', checkDemoAuth, async (req, res) => {
  try {
    await setFailoverMode('unhealthy');
    res.json({ success: true, message: 'Mumbai unhealthy revision deployed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update Cloud Run' });
  }
});

app.post('/api/demo/restore-primary', checkDemoAuth, async (req, res) => {
  try {
    await setFailoverMode('healthy');
    res.json({ success: true, message: 'Mumbai healthy revision deployed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update Cloud Run' });
  }
});

app.get('/api/demo/status', (req, res) => {
  const enabled = !!process.env.DEMO_CONTROL_TOKEN;
  res.json({
    enabled,
    configured: enabled,
    region: 'asia-south1',
    service: 'failover-primary',
    reason: enabled ? 'Configured and Ready' : 'Control not configured (Token missing)'
  });
});

// Info endpoint – reads env vars with defaults
app.get('/api/info', (req, res) => {
  const region = process.env.REGION || 'Mumbai';
  const role = process.env.ROLE || 'PRIMARY';
  const version = process.env.VERSION || '1.0';
  res.json({
    region,
    role,
    version,
    status: 'online',
  });
});

// Status endpoint – checks regional health and DNS resolution
app.get('/api/status', async (req, res) => {
  const timeoutMs = 4000;

  const checkHealth = (url) => {
    return new Promise((resolve) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, (resp) => {
        const { statusCode } = resp;
        resp.resume(); // consume response data to free memory
        resolve({
          healthy: statusCode === 200,
          status: statusCode === 200 ? 'healthy' : 'unhealthy',
          httpStatus: statusCode,
        });
      });
      req.on('error', () => {
        resolve({ healthy: false, status: 'unhealthy', httpStatus: null });
      });
      req.setTimeout(timeoutMs, () => {
        req.abort();
        resolve({ healthy: false, status: 'unhealthy', httpStatus: null });
      });
    });
  };

  const [mumbaiHealth, singaporeHealth] = await Promise.all([
    checkHealth('http://35.207.252.1/health'),
    checkHealth('http://34.2.145.135/health'),
  ]);

  // DNS resolution using authoritative nameserver
  let dnsResult = {
    hostname: 'app.failover-demo-511215.com.',
    nameserver: 'ns-cloud-e1.googledomains.com',
    resolvedIp: null,
    activeRegion: null,
    error: null,
  };
  try {
    // Resolve the authoritative nameserver to an IP address first
    const nsAddrs = await dns.promises.resolve4('ns-cloud-e1.googledomains.com');
    const nsIp = nsAddrs[0];
    const resolver = new dns.promises.Resolver();
    resolver.setServers([nsIp]);
    const addresses = await resolver.resolve4('app.failover-demo-511215.com');
    dnsResult.resolvedIp = addresses[0] || null;
    dnsResult.activeRegion = dnsResult.resolvedIp === '35.207.252.1' ? 'Mumbai' : dnsResult.resolvedIp === '34.2.145.135' ? 'Singapore' : null;
  } catch (e) {
    dnsResult.error = e.message;
  }

  const response = {
    timestamp: new Date().toISOString(),
    regions: {
      mumbai: {
        name: 'Mumbai',
        role: 'PRIMARY',
        ip: '35.207.252.1',
        healthy: mumbaiHealth.healthy,
        status: mumbaiHealth.status,
        httpStatus: mumbaiHealth.httpStatus,
      },
      singapore: {
        name: 'Singapore',
        role: 'BACKUP',
        ip: '34.2.145.135',
        healthy: singaporeHealth.healthy,
        status: singaporeHealth.status,
        httpStatus: singaporeHealth.httpStatus,
      },
    },
    dns: dnsResult,
    failover: {
      active: dnsResult.activeRegion !== 'Mumbai',
      state: dnsResult.activeRegion === 'Mumbai' ? 'PRIMARY_ACTIVE' : dnsResult.activeRegion === 'Singapore' ? 'FAILOVER_ACTIVE' : 'UNKNOWN',
    },
  };

  res.json(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
