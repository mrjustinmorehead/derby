    adminOutput.textContent = JSON.stringify(data, null, 2);
    await fetchState();
  });

  unlockHorsesBtn.addEventListener('click', async () => {
    if (!confirm('Unlock horse assignments?')) return;
    const k = adminKey(); if (!k) return;
    const { data } = await api('/api/admin-set-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ horses, lock: false }),
    });
    adminOutput.textContent = JSON.stringify(data, null, 2);
    await fetchState();
  });

  adjustCountPreviewBtn.addEventListener('click', async () => {
    const newCount = parseInt(prompt('New total horses (<= current):'), 10);
    if (!newCount) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-adjust-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ newCount, preview: true }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    if (res.ok) { lastAdjustPreview = { newCount, data: res.data }; applyAdjustCountBtn.disabled = false; }
  });

  applyAdjustCountBtn.addEventListener('click', async () => {
    if (!lastAdjustPreview) { alert('Run preview first.'); return; }
    if (!confirm(`Apply adjust to ${lastAdjustPreview.newCount}? This will remove rows/cols ${lastAdjustPreview.data.removedRowsCols.join(', ')}`)) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-adjust-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ newCount: lastAdjustPreview.newCount, preview: false }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    applyAdjustCountBtn.disabled = true;
    lastAdjustPreview = null;
    await fetchState();
  });

  scratchPreviewBtn.addEventListener('click', async () => {
    const horse = parseInt(scratchInput.value.trim(), 10);
    if (!horse) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-scratch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ horse, preview: true }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    if (res.ok) { lastScratchPreview = { horse, data: res.data }; scratchApplyBtn.disabled = false; }
  });

  scratchApplyBtn.addEventListener('click', async () => {
    if (!lastScratchPreview) { alert('Run scratch preview first.'); return; }
    if (!confirm(`Scratch horse ${lastScratchPreview.horse}?`)) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-scratch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ horse: lastScratchPreview.horse, preview: false }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    scratchApplyBtn.disabled = true;
    lastScratchPreview = null;
    await fetchState();
  });

  setHorsesBtn.addEventListener('click', async () => {
    const labels = horseNames.value.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (labels.length !== gridSize) { alert(`Need exactly ${gridSize} labels`); return; }
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-set-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ horses: labels }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  });

  backupBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const res = await fetch('/api/admin-backup', { headers: { 'x-admin-key': k } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derby-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  restoreBtn.addEventListener('click', async () => {
    const file = restoreFile.files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('Restore from this file? This will overwrite current state.')) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': k },
      body: JSON.stringify({ confirm: true, data }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  });
}

function renderAdminLog(log) {
  adminLogEl.textContent = log.map(e => `${e.ts} – ${e.type} – ${JSON.stringify(e.details)}`).join('\n');
}

window.addEventListener('DOMContentLoaded', async () => {
  await fetchState();
  renderPayPal();
  showAdmin();
});
