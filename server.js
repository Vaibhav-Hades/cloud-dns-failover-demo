require('dotenv').config(); // optional, will ignore if .env not present
const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// GET / – serve index.html (handled by static middleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
