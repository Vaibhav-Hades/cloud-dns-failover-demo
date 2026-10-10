document.addEventListener('DOMContentLoaded', () => {
  // Demo Controls
  const btnFail = document.getElementById('simulate-failure');
  const btnRecover = document.getElementById('simulate-recovery');
  const btnReset = document.getElementById('reset-demo');
  const clearLogBtn = document.getElementById('clear-log');
  const terminalLog = document.getElementById('terminal-log');

  // Real Failover Controls
  const realFailoverStatus = document.getElementById('real-failover-status');
  const btnRealFail = document.getElementById('real-fail-btn');
  const btnRealRestore = document.getElementById('real-restore-btn');

  // Top Nav Indicator
  const statusIndicator = document.querySelector('.status-indicator');
  const lastUpdatedDisplay = document.getElementById('last-updated');

  // UI Elements - Top Cards
  const activeRegionName = document.getElementById('active-region-name');
  const activeRegionRole = document.getElementById('active-region-role');
  const activeIp = document.getElementById('active-ip');
  const activeHealth = document.getElementById('active-health');
  const activeTraffic = document.getElementById('active-traffic');
  const dnsStatusTitle = document.getElementById('dns-status-title');
  const backupStatusBadge = document.getElementById('backup-status-badge');

  // UI Elements - Diagram
  const dnsActiveRecord = document.getElementById('dns-active-record');
  const diagMumbai = document.getElementById('diagram-mumbai');
  const diagSingapore = document.getElementById('diagram-singapore');

  // UI Elements - Detail Cards
  const detMumbai = document.getElementById('detail-mumbai');
  const detSingapore = document.getElementById('detail-singapore');

  // UI Elements - Monitor & Decision
  const tblMumbaiResp = document.getElementById('tbl-mumbai-resp');
  const tblMumbaiStatus = document.getElementById('tbl-mumbai-status');
  const tblSingaporeResp = document.querySelectorAll('.monitor-table tbody tr')[1].querySelector('td:nth-child(3)');
  const tblSingaporeStatus = document.querySelectorAll('.monitor-table tbody tr')[1].querySelector('td:nth-child(4)');
  const dnsDecisionBox = document.getElementById('dns-decision-box');
  const dnsTargetIp = document.getElementById('dns-target-ip');

  let simulationActive = false;
  let previousState = null;
  let realTestInProgress = false;

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
  };

  const addLog = (tag, msg, isError = false) => {
    const div = document.createElement('div');
    const colorClass = isError ? 'red' : 'green';
    div.innerHTML = `<span class="t-time">[${getTimestamp()}]</span> <span class="t-tag ${colorClass}">[${tag}]</span> ${msg}`;
    terminalLog.prepend(div);
    
    // Keep max 50 events
    while (terminalLog.children.length > 50) {
      terminalLog.removeChild(terminalLog.lastChild);
    }
  };

  const updateConnectionIndicator = (isLive) => {
    if (isLive) {
      statusIndicator.innerHTML = '<span class="dot active"></span> LIVE';
      lastUpdatedDisplay.textContent = getTimestamp();
    } else {
      statusIndicator.innerHTML = '<span class="dot" style="background: red; box-shadow: 0 0 8px red;"></span> CONNECTION ERROR';
    }
  };

  const updateCardStatus = (card, type) => {
    const headerBadge = card.querySelector('.card-header .badge');
    const healthBadge = card.querySelector('.box-header .badge') || null;
    const trafficFooter = card.querySelector('.traffic-footer span:last-child');
    
    if (type === 'ACTIVE') {
      if (headerBadge) { headerBadge.className = 'badge green-badge float-right'; headerBadge.textContent = '● ACTIVE'; }
      if (healthBadge) { healthBadge.className = 'badge green-badge'; healthBadge.textContent = '● HEALTHY'; }
      if (trafficFooter) { trafficFooter.className = 'green'; trafficFooter.textContent = '● ACTIVE (100% Allocation)'; }
      card.classList.add('active-path');
      card.classList.remove('standby-path');
    } else if (type === 'STANDBY') {
      if (headerBadge) { headerBadge.className = 'badge gray-badge float-right'; headerBadge.textContent = '● STANDBY'; }
      if (healthBadge) { healthBadge.className = 'badge gray-badge'; healthBadge.textContent = '● STANDBY / READY'; }
      if (trafficFooter) { trafficFooter.className = 'gray'; trafficFooter.textContent = '○ STANDBY (0% Allocation)'; }
      card.classList.remove('active-path');
      card.classList.add('standby-path');
    } else if (type === 'UNHEALTHY') {
      if (headerBadge) { headerBadge.className = 'badge red-badge float-right'; headerBadge.textContent = '✕ UNHEALTHY'; }
      if (healthBadge) { healthBadge.className = 'badge red-badge'; healthBadge.textContent = '✕ FAILING'; }
      if (trafficFooter) { trafficFooter.className = 'red'; trafficFooter.textContent = '✕ DRAINED (0% Allocation)'; }
      card.classList.remove('active-path');
      card.classList.remove('standby-path');
    }
  };

  const applyStateToUI = (mumbai, singapore, dns, failover) => {
    // 1. Update Monitor Table
    tblMumbaiResp.textContent = mumbai.httpStatus ? `HTTP ${mumbai.httpStatus}` : 'UNAVAILABLE';
    tblMumbaiResp.className = mumbai.healthy ? 'green' : 'red';
    tblMumbaiStatus.textContent = mumbai.healthy ? '● HEALTHY' : (mumbai.httpStatus ? '✕ UNHEALTHY' : 'UNAVAILABLE');
    tblMumbaiStatus.className = `text-right ${mumbai.healthy ? 'green' : 'red'}`;

    tblSingaporeResp.textContent = singapore.httpStatus ? `HTTP ${singapore.httpStatus}` : 'UNAVAILABLE';
    tblSingaporeResp.className = singapore.healthy ? 'green' : 'red';
    tblSingaporeStatus.textContent = singapore.healthy ? '● HEALTHY' : (singapore.httpStatus ? '✕ UNHEALTHY' : 'UNAVAILABLE');
    tblSingaporeStatus.className = `text-right ${singapore.healthy ? 'green' : 'red'}`;

    // 2. Update Details Cards (Mumbai & Singapore)
    const mDetStatus = detMumbai.querySelector('.data-group:nth-child(4) .val');
    mDetStatus.textContent = mumbai.httpStatus ? `HTTP ${mumbai.httpStatus}` : 'UNAVAILABLE';
    mDetStatus.className = `val ${mumbai.healthy ? 'green' : 'red'}`;

    const sDetStatus = detSingapore.querySelector('.data-group:nth-child(4) .val');
    sDetStatus.textContent = singapore.httpStatus ? `HTTP ${singapore.httpStatus}` : 'UNAVAILABLE';
    sDetStatus.className = `val ${singapore.healthy ? 'green' : 'red'}`;

    // Update diagram responses
    const diagMumbaiResp = diagMumbai.querySelector('.dr:last-child span.green, .dr:last-child span.red');
    if (diagMumbaiResp) {
      diagMumbaiResp.textContent = mumbai.httpStatus ? `HTTP ${mumbai.httpStatus} ${mumbai.healthy ? 'OK' : 'ERR'}` : 'UNAVAILABLE';
      diagMumbaiResp.className = mumbai.healthy ? 'green' : 'red';
    }
    const diagSingResp = diagSingapore.querySelector('.dr:last-child span.green, .dr:last-child span.red');
    if (diagSingResp) {
      diagSingResp.textContent = singapore.httpStatus ? `HTTP ${singapore.httpStatus} ${singapore.healthy ? 'OK' : 'ERR'}` : 'UNAVAILABLE';
      diagSingResp.className = singapore.healthy ? 'green' : 'red';
    }

    // 3. DNS Routing Decision
    if (dns.error) {
      dnsTargetIp.textContent = 'UNAVAILABLE';
      dnsActiveRecord.textContent = 'DNS STATUS: UNAVAILABLE';
      dnsStatusTitle.textContent = 'DNS ERROR';
      dnsStatusTitle.parentElement.querySelector('.dot').className = 'dot';
      dnsStatusTitle.parentElement.querySelector('.dot').style.background = 'red';
    } else {
      dnsTargetIp.textContent = dns.resolvedIp || 'UNKNOWN';
      dnsActiveRecord.textContent = dns.resolvedIp ? `${dns.resolvedIp} (A)` : 'UNKNOWN';
      dnsStatusTitle.parentElement.querySelector('.dot').style.background = ''; // reset inline style
      
      const logicSteps = document.querySelectorAll('.logic-step');
      if (dns.activeRegion === 'Mumbai') {
        dnsDecisionBox.className = 'policy-decision';
        dnsDecisionBox.innerHTML = `
          <div class="decision-title">Current Policy Decision:</div>
          <div class="decision-main green">PRIMARY REGION HEALTHY</div>
          <div class="decision-sub">→ Route Traffic to Mumbai (${mumbai.ip})</div>
        `;
        if(logicSteps.length > 1) {
          logicSteps[0].classList.add('active');
          logicSteps[1].classList.remove('active');
        }
        dnsStatusTitle.textContent = 'PRIMARY ACTIVE';
        dnsStatusTitle.parentElement.querySelector('.dot').className = 'dot cyan-dot';
        
        activeRegionName.innerHTML = 'MUMBAI <span class="tag">asia-south1</span>';
        activeIp.textContent = mumbai.ip;
        activeHealth.className = `value ${mumbai.healthy ? 'green' : 'red'}`;
        activeHealth.textContent = mumbai.healthy ? '● HEALTHY (200 OK)' : '✕ UNHEALTHY';
        
        updateCardStatus(diagMumbai, mumbai.healthy ? 'ACTIVE' : 'UNHEALTHY');
        updateCardStatus(detMumbai, mumbai.healthy ? 'ACTIVE' : 'UNHEALTHY');
        updateCardStatus(diagSingapore, 'STANDBY');
        updateCardStatus(detSingapore, 'STANDBY');
        
        if (realTestInProgress) {
          realFailoverStatus.innerHTML = '<span style="color:var(--green)">✓ Recovery Complete</span>';
          realTestInProgress = false;
        }

      } else if (dns.activeRegion === 'Singapore') {
        dnsDecisionBox.className = 'policy-decision failed';
        dnsDecisionBox.innerHTML = `
          <div class="decision-title">Current Policy Decision:</div>
          <div class="decision-main red">PRIMARY REGION UNHEALTHY</div>
          <div class="decision-sub">→ Route Traffic to Singapore (${singapore.ip})</div>
        `;
        if(logicSteps.length > 1) {
          logicSteps[0].classList.remove('active');
          logicSteps[1].classList.add('active');
        }
        dnsStatusTitle.textContent = 'FAILOVER ACTIVE';
        dnsStatusTitle.parentElement.querySelector('.dot').className = 'dot active'; // Green dot for active
        
        activeRegionName.innerHTML = 'SINGAPORE <span class="tag">asia-southeast1</span>';
        activeIp.textContent = singapore.ip;
        activeHealth.className = `value ${singapore.healthy ? 'green' : 'red'}`;
        activeHealth.textContent = singapore.healthy ? '● HEALTHY (200 OK)' : '✕ UNHEALTHY';
        
        updateCardStatus(diagMumbai, 'UNHEALTHY');
        updateCardStatus(detMumbai, 'UNHEALTHY');
        updateCardStatus(diagSingapore, singapore.healthy ? 'ACTIVE' : 'UNHEALTHY');
        updateCardStatus(detSingapore, singapore.healthy ? 'ACTIVE' : 'UNHEALTHY');

        if (realTestInProgress) {
          realFailoverStatus.innerHTML = 'FAILOVER COMPLETE - Backup Region Active';
        }
      }
    }
  };

  const processEvents = (mumbai, singapore, dns, failover) => {
    if (!previousState) {
      addLog('SYSTEM', 'Monitoring started');
      addLog('HEALTH', `Mumbai → ${mumbai.healthy ? 'HEALTHY' : 'UNHEALTHY'}`, !mumbai.healthy);
      addLog('HEALTH', `Singapore → ${singapore.healthy ? 'HEALTHY' : 'UNHEALTHY'}`, !singapore.healthy);
      if (dns.error) {
        addLog('ERROR', 'DNS Status: UNAVAILABLE', true);
      } else if (dns.activeRegion) {
        addLog('DNS', `Cloud DNS → ${dns.activeRegion}`);
        addLog('ROUTING', failover.state === 'PRIMARY_ACTIVE' ? 'PRIMARY ACTIVE' : 'FAILOVER ACTIVE');
      }
    } else {
      // Health changes
      if (previousState.mumbai.healthy !== mumbai.healthy) {
        addLog('HEALTH', `Mumbai → ${mumbai.healthy ? 'HEALTHY' : 'UNHEALTHY'}`, !mumbai.healthy);
        if (realTestInProgress && !mumbai.healthy && previousState.dns.activeRegion === 'Mumbai') {
          addLog('ROUTING', 'Waiting for Cloud DNS health decision...');
          realFailoverStatus.innerHTML = 'Waiting for Cloud DNS health check...';
        }
      }
      if (previousState.singapore.healthy !== singapore.healthy) {
        addLog('HEALTH', `Singapore → ${singapore.healthy ? 'HEALTHY' : 'UNHEALTHY'}`, !singapore.healthy);
      }
      // DNS / Routing changes
      if (previousState.dns.resolvedIp !== dns.resolvedIp && !dns.error) {
        addLog('DNS', `Target changed: ${previousState.dns.resolvedIp || 'UNKNOWN'} → ${dns.resolvedIp}`, false);
        if (dns.activeRegion === 'Singapore') {
          addLog('FAILOVER', 'Singapore → ACTIVE', true);
          addLog('ROUTING', 'FAILOVER ACTIVE', true);
        } else if (dns.activeRegion === 'Mumbai') {
          addLog('RECOVERY', 'Mumbai → ACTIVE');
          addLog('ROUTING', 'PRIMARY ACTIVE');
        }
      }
      if (!previousState.dns.error && dns.error) {
        addLog('ERROR', 'DNS Status: UNAVAILABLE', true);
      } else if (previousState.dns.error && !dns.error) {
        addLog('SYSTEM', 'DNS Status: RESTORED');
      }
    }

    previousState = {
      mumbai: { ...mumbai },
      singapore: { ...singapore },
      dns: { ...dns },
      failover: { ...failover }
    };
  };

  const fetchStatus = async () => {
    if (simulationActive) return; // Do not poll real data during simulation preview

    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      updateConnectionIndicator(true);
      applyStateToUI(data.regions.mumbai, data.regions.singapore, data.dns, data.failover);
      processEvents(data.regions.mumbai, data.regions.singapore, data.dns, data.failover);
      
    } catch (err) {
      updateConnectionIndicator(false);
    }
  };

  const initDemoControl = async () => {
    try {
      const res = await fetch('/api/demo/status');
      const data = await res.json();
      if (data.enabled) {
        realFailoverStatus.textContent = 'Configured and Ready';
        btnRealFail.disabled = false;
        btnRealRestore.disabled = false;
        if (data.failureActive) {
          realTestInProgress = true;
          realFailoverStatus.textContent = 'FAILOVER IN PROGRESS';
        }
      } else {
        realFailoverStatus.textContent = 'REAL FAILOVER CONTROL NOT CONFIGURED';
      }
    } catch (e) {
      realFailoverStatus.textContent = 'Backend Error';
    }
  };

  // ----------------------------------------------------
  // REAL FAILOVER CONTROLS
  // ----------------------------------------------------
  btnRealFail.addEventListener('click', async () => {
    const confirmTest = confirm("REAL FAILOVER TEST\n\nThis will temporarily mark the Mumbai primary health endpoint as unhealthy.\n\nGoogle Cloud DNS will then perform the configured failover to Singapore.\n\nContinue?");
    if (!confirmTest) return;

    const token = prompt('Enter Demo Control Token:');
    if (!token) return;

    try {
      const res = await fetch('/api/demo/fail-primary', {
        method: 'POST',
        headers: {
          'x-demo-token': token
        }
      });
      const data = await res.json();
      if (res.ok) {
        addLog('SYSTEM', 'Real failover test initiated');
        realTestInProgress = true;
        realFailoverStatus.innerHTML = 'FAILOVER TEST IN PROGRESS - Primary health failing...';
        // Force an immediate status fetch to see the HTTP 503 quickly
        fetchStatus();
      } else {
        alert('Error: ' + (data.error || 'Unknown Error'));
      }
    } catch(e) {
      alert('Request failed');
    }
  });

  btnRealRestore.addEventListener('click', async () => {
    const token = prompt('Enter Demo Control Token:');
    if (!token) return;

    try {
      const res = await fetch('/api/demo/restore-primary', {
        method: 'POST',
        headers: {
          'x-demo-token': token
        }
      });
      const data = await res.json();
      if (res.ok) {
        addLog('SYSTEM', 'Real failover recovery initiated');
        realTestInProgress = true;
        realFailoverStatus.innerHTML = 'RECOVERY IN PROGRESS - Restoring primary health...';
        fetchStatus();
      } else {
        alert('Error: ' + (data.error || 'Unknown Error'));
      }
    } catch(e) {
      alert('Request failed');
    }
  });

  // Start initialization
  initDemoControl();
  fetchStatus();
  setInterval(fetchStatus, 5000);

  // ----------------------------------------------------
  // SIMULATION CONTROLS (Isolated from LIVE state)
  // ----------------------------------------------------
  btnFail.addEventListener('click', () => {
    if (simulationActive || realTestInProgress) return;
    simulationActive = true;
    
    // Create a fake failed state
    const fakeMumbai = { ip: '35.207.252.1', healthy: false, httpStatus: 503 };
    const fakeSingapore = { ip: '34.2.145.135', healthy: true, httpStatus: 200 };
    const fakeDns = { activeRegion: 'Singapore', resolvedIp: '34.2.145.135', error: null };
    const fakeFailover = { state: 'FAILOVER_ACTIVE' };
    
    updateConnectionIndicator(true); // Still connected to frontend technically
    statusIndicator.innerHTML = '<span class="dot" style="background: orange; box-shadow: 0 0 8px orange;"></span> SIMULATION PREVIEW';
    
    // Log fake events (showing sequence)
    addLog('HEALTH', 'Mumbai → UNHEALTHY', true);
    setTimeout(() => {
      addLog('DNS', 'Target changed: 35.207.252.1 → 34.2.145.135', true);
      addLog('FAILOVER', 'Singapore → ACTIVE', true);
      addLog('ROUTING', 'FAILOVER ACTIVE', true);
      applyStateToUI(fakeMumbai, fakeSingapore, fakeDns, fakeFailover);
    }, 1500);
  });

  btnRecover.addEventListener('click', () => {
    if (!simulationActive) return;
    
    const fakeMumbai = { ip: '35.207.252.1', healthy: true, httpStatus: 200 };
    const fakeSingapore = { ip: '34.2.145.135', healthy: true, httpStatus: 200 };
    const fakeDns = { activeRegion: 'Mumbai', resolvedIp: '35.207.252.1', error: null };
    const fakeFailover = { state: 'PRIMARY_ACTIVE' };
    
    addLog('HEALTH', 'Mumbai → HEALTHY');
    setTimeout(() => {
      addLog('DNS', 'Target changed: 34.2.145.135 → 35.207.252.1');
      addLog('RECOVERY', 'Mumbai → ACTIVE');
      addLog('ROUTING', 'PRIMARY ACTIVE');
      applyStateToUI(fakeMumbai, fakeSingapore, fakeDns, fakeFailover);
      
      setTimeout(() => {
        simulationActive = false; // Release lock to allow live polling again
        fetchStatus();
      }, 2000);
    }, 1500);
  });

  btnReset.addEventListener('click', () => {
    location.reload();
  });

  clearLogBtn.addEventListener('click', () => {
    terminalLog.innerHTML = '';
  });
});
