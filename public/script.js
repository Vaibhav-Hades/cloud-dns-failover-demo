document.addEventListener('DOMContentLoaded', () => {
  const healthMessageEl = document.getElementById('health-message');
  const regionEl = document.getElementById('region');
  const roleEl = document.getElementById('role');
  const statusEl = document.getElementById('status');
  const healthEl = document.getElementById('health');
  const versionEl = document.getElementById('version');

  // Helper to show error state
  const showError = (msg) => {
    healthMessageEl.textContent = msg;
    healthMessageEl.style.color = '#ff6b6b'; // red color
  };

  // Fetch health status
  fetch('/health')
    .then((res) => {
      if (!res.ok) throw new Error('Health endpoint error');
      return res.json();
    })
    .then((data) => {
      if (data.status && data.status.toLowerCase() === 'healthy') {
        healthMessageEl.textContent = 'SYSTEM HEALTHY';
        healthMessageEl.style.color = '#90ee90'; // green
      } else {
        showError('Health check failed');
      }
    })
    .catch(() => showError('Cannot reach health endpoint'));

  // Fetch instance info
  fetch('/api/info')
    .then((res) => {
      if (!res.ok) throw new Error('Info endpoint error');
      return res.json();
    })
    .then((info) => {
      regionEl.textContent = info.region ?? '-';
      roleEl.textContent = info.role ?? '-';
      statusEl.textContent = info.status ?? '-';
      healthEl.textContent = info.status === 'online' ? 'PASS' : 'FAIL';
      versionEl.textContent = '1.1 — CI/CD UPDATE';
    })
    .catch(() => {
      regionEl.textContent = roleEl.textContent = statusEl.textContent = healthEl.textContent = versionEl.textContent = 'Error';
    });
});
