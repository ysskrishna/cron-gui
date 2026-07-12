'use strict';

/* global window, document, fetch, location, navigator, URL */

const STORAGE_KEY = 'cron-gui-ui-v1';

const QUICK_SCHEDULES = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily', value: '0 0 * * *' },
  { label: 'Weekly', value: '0 0 * * 0' },
  { label: 'Monthly', value: '0 0 1 * *' },
  { label: 'Yearly', value: '0 0 1 1 *' },
  { label: 'Startup', value: '@reboot' },
];

const TOOLTIPS = {
  getFromCrontab: 'Read the system crontab (crontab -l) and merge jobs into the app. Creates a backup first.',
  previewCrontab: 'Preview the crontab text: env vars plus one line per enabled job',
  createBackup: 'Copy crontab.db to a dated backup file on this server',
  manageBackups: 'Browse server backups — restore overwrites crontab.db, or delete a backup file',
  importDb: 'Upload a crontab.db file from your computer. Creates a backup first.',
  exportDb: 'Download crontab.db to your computer',
};

const ICONS = {
  play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  enable: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
  pause: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  more: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
};

let routes = {};
let editingJobId = null;
let confirmCallback = null;

function defaultUiState() {
  return {
    theme: 'light',
    search: '',
    page: 1,
    pageSize: 10,
    sortColumn: 'name',
    sortDir: 'asc',
    statusFilter: 'all',
    selectedIds: [],
    commandColWidth: 28,
  };
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUiState();
    return { ...defaultUiState(), ...JSON.parse(raw) };
  } catch {
    return defaultUiState();
  }
}

function saveUiState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ui));
}

function parseBackupDate(name) {
  const t = name.split('backup')[1];
  if (!t) return Date.now();
  return new Date(t.substring(0, t.length - 3)).valueOf();
}

function mapCrontabToJob(tab) {
  const modifiedAt = tab.created || (tab.timestamp ? new Date(tab.timestamp).getTime() : Date.now());
  return {
    id: tab._id,
    name: tab.name || '',
    command: tab.command,
    schedule: tab.schedule,
    fields: splitSchedule(tab.schedule),
    human: tab.human || describeSchedule(tab.schedule),
    enabled: !tab.stopped,
    saved: !!tab.saved,
    logging: tab.logging === 'true' || tab.logging === true,
    mailing: tab.mailing || {},
    modifiedAt,
    hasError: false,
  };
}

function mapBackups(names) {
  return (names || []).map((name) => ({
    id: name,
    name,
    createdAt: parseBackupDate(name),
  }));
}

function buildInitialState(bootstrap) {
  return {
    envVars: bootstrap.env || '',
    jobs: (bootstrap.crontabs || []).map(mapCrontabToJob),
    backups: mapBackups(bootstrap.backups),
    ui: loadUiState(),
  };
}

let state = buildInitialState(window.__CRON_GUI__ || {});

function routeUrl(key) {
  const path = routes[key];
  if (!path) throw new Error(`Unknown route: ${key}`);
  if (path.startsWith('http')) return path;
  if (key === 'root') return routes.root || '/';
  const base = routes.root || '';
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  return `${base}/${path}`.replace(/\/+/g, '/');
}

async function apiPost(key, body) {
  const res = await fetch(routeUrl(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.statusText || 'Request failed');
}

async function apiGet(key, params) {
  const url = new URL(routeUrl(key), window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(res.statusText || 'Request failed');
  return res;
}

function reloadPage() {
  location.reload();
}

function toast(category, title, description) {
  const toaster = document.getElementById('toaster');
  if (toaster && typeof toaster.toast === 'function') {
    toaster.toast({ category, title, description, cancel: { label: 'Dismiss' } });
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function splitSchedule(schedule) {
  if (schedule.startsWith('@')) return ['@', schedule.slice(1), '*', '*', '*'];
  const parts = schedule.trim().split(/\s+/);
  while (parts.length < 5) parts.push('*');
  return parts.slice(0, 5);
}

function describeSchedule(schedule) {
  const preset = QUICK_SCHEDULES.find((q) => q.value === schedule);
  if (preset) return preset.label;
  if (schedule.startsWith('@')) return schedule.slice(1).replace(/^\w/, (c) => c.toUpperCase());
  return `Custom · ${schedule}`;
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.getElementById('theme-icon-sun').classList.toggle('hidden', isDark);
  document.getElementById('theme-icon-moon').classList.toggle('hidden', !isDark);

  const favicon = document.getElementById('favicon');
  if (favicon) favicon.href = isDark ? 'img/favicon-32-dark.png' : 'img/favicon-32-light.png';

  const appleIcon = document.getElementById('apple-touch-icon');
  if (appleIcon) appleIcon.href = isDark ? 'img/apple-touch-icon-dark.png' : 'img/apple-touch-icon-light.png';
}

function formatModified(ts) {
  return new Date(ts).toLocaleString();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function collapsedCommand(raw) {
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('; ');
}

function buildMailingPayload(transporter, optionsRaw) {
  if (!transporter && !optionsRaw) return {};
  return {
    transporterStr: transporter,
    mailOptions: optionsRaw ? JSON.parse(optionsRaw) : {},
  };
}

function statusCounts() {
  const counts = { all: state.jobs.length, active: 0, unsaved: 0, error: 0, disabled: 0 };
  state.jobs.forEach((job) => { counts[jobStatusKey(job)]++; });
  return counts;
}

function jobStatusKey(job) {
  if (!job.enabled) return 'disabled';
  if (job.hasError) return 'error';
  if (!job.saved) return 'unsaved';
  return 'active';
}

function isSelected(id) {
  return state.ui.selectedIds.includes(id);
}

function sortedJobs(jobs) {
  const { sortColumn, sortDir } = state.ui;
  if (!sortColumn) return jobs;
  const dir = sortDir === 'desc' ? -1 : 1;
  const statusOrder = { active: 0, unsaved: 1, error: 2, disabled: 3 };
  return [...jobs].sort((a, b) => {
    let av;
    let bv;
    switch (sortColumn) {
      case 'name':
        av = (a.name || a.id).toLowerCase();
        bv = (b.name || b.id).toLowerCase();
        break;
      case 'command':
        av = a.command.toLowerCase();
        bv = b.command.toLowerCase();
        break;
      case 'schedule':
        av = a.schedule.toLowerCase();
        bv = b.schedule.toLowerCase();
        break;
      case 'status':
        av = statusOrder[jobStatusKey(a)];
        bv = statusOrder[jobStatusKey(b)];
        break;
      case 'modified':
        av = a.modifiedAt;
        bv = b.modifiedAt;
        break;
      default:
        return 0;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function filteredJobs() {
  const q = state.ui.search.trim().toLowerCase();
  const statusFilter = state.ui.statusFilter || 'all';
  return sortedJobs(state.jobs.filter((job) => {
    if (statusFilter !== 'all' && jobStatusKey(job) !== statusFilter) return false;
    if (!q) return true;
    return [job.name, job.command, job.schedule, job.id].some((v) => String(v).toLowerCase().includes(q));
  }));
}

function paginatedJobs() {
  const jobs = filteredJobs();
  const start = (state.ui.page - 1) * state.ui.pageSize;
  return jobs.slice(start, start + state.ui.pageSize);
}

function hasUnsavedWork() {
  const envDirty = document.getElementById('env-vars').value !== state.envVars;
  const jobsUnsaved = state.jobs.some((job) => !job.saved);
  return envDirty || jobsUnsaved;
}

function paginationItems(current, total) {
  if (total <= 1) return [];
  const items = [];
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  items.push({ type: 'prev', page: current - 1, disabled: current === 1 });
  if (start > 1) {
    items.push({ type: 'page', page: 1 });
    if (start > 2) items.push({ type: 'ellipsis' });
  }
  for (let p = start; p <= end; p++) {
    items.push({ type: 'page', page: p });
  }
  if (end < total) {
    if (end < total - 1) items.push({ type: 'ellipsis' });
    items.push({ type: 'page', page: total });
  }
  items.push({ type: 'next', page: current + 1, disabled: current === total });
  return items;
}

function renderPaginationControls(pagination, totalPages) {
  pagination.innerHTML = '';
  if (totalPages <= 1) return;

  paginationItems(state.ui.page, totalPages).forEach((item) => {
    if (item.type === 'ellipsis') {
      const span = document.createElement('span');
      span.className = 'pagination-ellipsis';
      span.textContent = '…';
      pagination.appendChild(span);
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.dataset.size = 'sm';

    if (item.type === 'page') {
      btn.dataset.variant = item.page === state.ui.page ? 'default' : 'outline';
      btn.textContent = String(item.page);
      btn.disabled = item.page === state.ui.page;
      btn.dataset.testid = 'page-btn';
      btn.onclick = () => { state.ui.page = item.page; saveUiState(); renderJobs(); };
    } else {
      btn.dataset.variant = 'outline';
      btn.textContent = item.type === 'prev' ? 'Prev' : 'Next';
      btn.disabled = item.disabled;
      btn.onclick = () => { state.ui.page = item.page; saveUiState(); renderJobs(); };
    }
    pagination.appendChild(btn);
  });
}

function hasActiveFilters() {
  return !!(state.ui.search.trim() || (state.ui.statusFilter && state.ui.statusFilter !== 'all'));
}

function iconAction(label, onclick, icon, variant = 'outline') {
  return `<button type="button" class="btn" data-variant="${variant}" data-size="icon-sm" aria-label="${label}" title="${label}" onclick="${onclick}">${icon}</button>`;
}

function sortHeaderLabel(label, column) {
  const active = state.ui.sortColumn === column;
  const arrow = active ? (state.ui.sortDir === 'asc' ? '↑' : '↓') : '↕';
  return `<button type="button" class="sortable-header" onclick="App.toggleSort('${column}')">${label}<span class="sort-indicator${active ? ' active' : ''}">${arrow}</span></button>`;
}

function rowPrimaryActions(job) {
  const id = escapeHtml(job.id).replace(/'/g, "\\'");
  if (job.enabled) {
    return `
      ${iconAction('Run now', `App.confirmRunJob('${id}')`, ICONS.play)}
      ${iconAction('Edit', `App.openEditJob('${id}')`, ICONS.edit)}
      ${iconAction('Disable', `App.toggleJob('${id}')`, ICONS.pause, 'ghost')}`;
  }
  return `
      ${iconAction('Enable', `App.toggleJob('${id}')`, ICONS.enable)}
      ${iconAction('Edit', `App.openEditJob('${id}')`, ICONS.edit)}`;
}

function statusBadge(job) {
  if (!job.enabled) return '<span class="badge" data-variant="secondary">Disabled</span>';
  if (job.hasError) return '<span class="badge" data-variant="destructive">Error</span>';
  if (!job.saved) return '<span class="badge" data-variant="outline">Unsaved</span>';
  return '<span class="badge">Active</span>';
}

function statusDot(job) {
  if (!job.enabled) return 'off';
  if (job.hasError) return 'error';
  if (!job.saved) return 'warn';
  return 'ok';
}

function getScheduleValue() {
  return document.getElementById('job-cron').value.trim() || '* * * * *';
}

function setScheduleValue(schedule) {
  document.getElementById('job-cron').value = schedule;
}

function syncSchedulePreset() {
  const schedule = getScheduleValue();
  const select = document.getElementById('schedule-preset');
  const match = QUICK_SCHEDULES.find((q) => q.value === schedule);
  select.value = match ? match.value : '';
}

function renderSchedulePresets() {
  const select = document.getElementById('schedule-preset');
  select.innerHTML = '<option value="">Custom</option>' +
    QUICK_SCHEDULES.map((q) => `<option value="${escapeHtml(q.value)}">${escapeHtml(q.label)}</option>`).join('');
  select.addEventListener('change', () => {
    const value = select.value;
    if (!value) return;
    setScheduleValue(value);
    syncSchedulePreset();
  });
}

function renderStatusFilter() {
  const counts = statusCounts();
  const select = document.getElementById('status-filter');
  const current = select.value || 'all';
  select.innerHTML = `
    <option value="all">All (${counts.all})</option>
    <option value="active">Active (${counts.active})</option>
    <option value="unsaved">Unsaved (${counts.unsaved})</option>
    <option value="error">Error (${counts.error})</option>
    <option value="disabled">Disabled (${counts.disabled})</option>`;
  select.value = current;
}

function updateFilterUI() {
  const active = hasActiveFilters();
  document.getElementById('clear-filters-btn').classList.toggle('hidden', !active);
  document.getElementById('search-input').classList.toggle('filter-active', active);
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = state.ui.selectedIds.length;
  if (count > 0) {
    bar.classList.remove('hidden');
    document.getElementById('bulk-count').textContent = `${count} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

function pruneSelection() {
  const ids = new Set(state.jobs.map((j) => j.id));
  state.ui.selectedIds = state.ui.selectedIds.filter((id) => ids.has(id));
}

function closeRowMenu() {
  const panel = document.getElementById('row-actions-panel');
  if (panel) panel.hidden = true;
}

function positionRowMenu(anchorBtn) {
  const panel = document.getElementById('row-actions-panel');
  panel.hidden = false;
  panel.style.visibility = 'hidden';
  panel.style.display = 'block';

  const rect = anchorBtn.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  let left = rect.left - panelRect.width - 6;
  let top = rect.top;

  if (left < 8) left = rect.right + 6;
  if (top + panelRect.height > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - panelRect.height - 8);
  }

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.visibility = 'visible';
}

function reinitComponents() {
  requestAnimationFrame(() => {
    window.basecoat?.initAll?.({ force: true });
  });
}

function applyCommandColumnWidth() {
  const w = `${state.ui.commandColWidth}%`;
  document.querySelectorAll('.col-command').forEach((el) => {
    el.style.width = w;
  });
}

function attachCommandColumnResize() {
  const handle = document.getElementById('command-col-handle');
  if (!handle || handle.dataset.bound) return;
  handle.dataset.bound = '1';
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const table = handle.closest('table');
    if (!table) return;
    const startX = e.clientX;
    const startWidth = state.ui.commandColWidth;
    const tableWidth = table.getBoundingClientRect().width;

    const onMove = (ev) => {
      const delta = ((ev.clientX - startX) / tableWidth) * 100;
      state.ui.commandColWidth = Math.min(55, Math.max(12, Math.round((startWidth + delta) * 10) / 10));
      applyCommandColumnWidth();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveUiState();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function buildRowMenuItems(job) {
  const id = escapeHtml(job.id).replace(/'/g, "\\'");
  const items = [];
  if (job.logging) {
    items.push(`<div role="menuitem" onclick="closeRowMenu(); App.openLogs('${id}','stdout')">View stdout</div>`);
    items.push(`<div role="menuitem" onclick="closeRowMenu(); App.openLogs('${id}','stderr')">View stderr</div>`);
    items.push('<hr role="separator" />');
  }
  items.push(`<div role="menuitem" onclick="closeRowMenu(); App.duplicateJob('${id}')">Duplicate</div>`);
  items.push('<hr role="separator" />');
  items.push(`<div role="menuitem" data-variant="destructive" onclick="closeRowMenu(); App.confirmDeleteJob('${id}')">Delete</div>`);
  return `<div role="group">${items.join('')}</div>`;
}

function actionMenuItem(label, onclick, tip) {
  return `<div role="menuitem" title="${escapeHtml(tip)}" onclick="${onclick}">${escapeHtml(label)}</div>`;
}

function renderActionsMenu() {
  const menu = document.getElementById('actions-menu-list');
  menu.innerHTML = `
    <div role="group">
      <div class="menu-label">System crontab</div>
      ${actionMenuItem('Get from crontab', 'App.getFromCrontab()', TOOLTIPS.getFromCrontab)}
      ${actionMenuItem('Preview crontab', 'App.openPreview()', TOOLTIPS.previewCrontab)}
      <hr role="separator" />
      <div class="menu-label">Backups</div>
      ${actionMenuItem('Create backup', 'App.createBackup()', TOOLTIPS.createBackup)}
      ${actionMenuItem('Manage backups', 'App.openBackupDialog()', TOOLTIPS.manageBackups)}
      <hr role="separator" />
      <div class="menu-label">Import / export</div>
      ${actionMenuItem('Import', "document.getElementById('import-file').click()", TOOLTIPS.importDb)}
      ${actionMenuItem('Export', 'App.exportData()', TOOLTIPS.exportDb)}
    </div>`;
  window.basecoat?.initAll?.({ force: true });
}

function renderBackupDialog() {
  const list = document.getElementById('backup-list');
  if (!state.backups.length) {
    list.innerHTML = '<div class="alert"><h2>No backups</h2><section>Create a backup to snapshot your current cron configuration.</section></div>';
    return;
  }
  list.innerHTML = state.backups.map((b) => {
    const id = escapeHtml(b.id).replace(/'/g, "\\'");
    return `
      <div class="backup-item">
        <div class="backup-meta">
          <strong>${escapeHtml(b.name)}</strong>
          <span>${new Date(b.createdAt).toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button type="button" class="btn" data-variant="outline" data-size="sm" onclick="App.openRestorePreview('${id}')">Restore</button>
          <button type="button" class="btn" data-variant="destructive" data-size="sm" onclick="App.deleteBackup('${id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function openConfirm(title, desc, bodyHtml, onConfirm, destructive) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-desc').textContent = desc || '';
  document.getElementById('confirm-body').innerHTML = bodyHtml || '';
  const okBtn = document.getElementById('confirm-ok');
  okBtn.textContent = destructive ? 'Delete' : 'Confirm';
  okBtn.dataset.variant = destructive ? 'destructive' : 'default';
  confirmCallback = onConfirm;
  document.getElementById('confirm-dialog').showModal();
}

function renderJobs() {
  pruneSelection();
  renderStatusFilter();
  updateFilterUI();
  updateBulkBar();

  const container = document.getElementById('jobs-container');
  const jobs = paginatedJobs();
  const total = filteredJobs().length;
  const totalPages = Math.max(1, Math.ceil(total / state.ui.pageSize));
  const colW = `${state.ui.commandColWidth}%`;

  if (state.ui.page > totalPages) state.ui.page = totalPages;

  if (state.jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" data-testid="empty-state">
        <h2>No cron jobs yet</h2>
        <p>Create your first scheduled task or import an existing configuration.</p>
        <button type="button" class="btn" data-testid="create-job-empty" onclick="App.openNewJob()">Create job</button>
      </div>`;
  } else if (total === 0) {
    container.innerHTML = `
      <div class="filter-empty">
        <h2>No jobs match your filters</h2>
        <p>Try adjusting your search or status filter.</p>
        <button type="button" class="btn" data-variant="outline" onclick="App.clearFilters()">Clear filters</button>
      </div>`;
  } else {
    const pageIds = jobs.map((j) => j.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => isSelected(id));
    const somePageSelected = pageIds.some((id) => isSelected(id)) && !allPageSelected;

    container.innerHTML = `
      <div class="table-scroll">
      <table class="table" data-testid="jobs-table">
        <thead>
          <tr>
            <th style="width:2.5rem">
              <input type="checkbox" class="row-select" aria-label="Select all on page"
                ${allPageSelected ? 'checked' : ''}
                onclick="App.toggleSelectAll(this.checked)" />
            </th>
            <th style="width:2.5rem">#</th>
            <th>${sortHeaderLabel('Name', 'name')}</th>
            <th class="col-command col-resize-handle" id="command-col-handle" style="width:${colW}">${sortHeaderLabel('Command', 'command')}</th>
            <th>${sortHeaderLabel('Schedule', 'schedule')}</th>
            <th>${sortHeaderLabel('Status', 'status')}</th>
            <th>${sortHeaderLabel('Modified', 'modified')}</th>
            <th style="width:10rem">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map((job, i) => {
    const rowNum = (state.ui.page - 1) * state.ui.pageSize + i + 1;
    const scheduleTip = escapeHtml(job.human || describeSchedule(job.schedule));
    const modifiedTip = escapeHtml(formatModified(job.modifiedAt));
    const safeId = escapeHtml(job.id).replace(/'/g, "\\'");
    return `
              <tr data-testid="job-row" data-job-id="${escapeHtml(job.id)}">
                <td>
                  <input type="checkbox" class="row-select" aria-label="Select ${escapeHtml(job.name || job.id)}"
                    ${isSelected(job.id) ? 'checked' : ''}
                    onchange="App.toggleSelect('${safeId}', this.checked)" />
                </td>
                <td>${rowNum}</td>
                <td>
                  <div class="job-name">
                    <span class="status-dot ${statusDot(job)}" title="Status"></span>
                    <span class="job-name-text">${escapeHtml(job.name || job.id)}</span>
                  </div>
                </td>
                <td class="col-command" style="width:${colW}"><div class="job-command" title="${escapeHtml(job.command)}">${escapeHtml(job.command)}</div></td>
                <td><code class="schedule-cell" title="${scheduleTip}">${escapeHtml(job.schedule)}</code></td>
                <td>${statusBadge(job)}</td>
                <td title="${modifiedTip}">${timeAgo(job.modifiedAt)}</td>
                <td class="actions-cell">
                  <div class="row-actions">
                    ${rowPrimaryActions(job)}
                    ${iconAction('More actions', `event.stopPropagation(); App.openRowMenu('${safeId}', this)`, ICONS.more, 'ghost')}
                  </div>
                </td>
              </tr>`;
  }).join('')}
        </tbody>
      </table>
      </div>`;

    const selectAll = container.querySelector('thead input[type="checkbox"]');
    if (selectAll) selectAll.indeterminate = somePageSelected;

    attachCommandColumnResize();
    applyCommandColumnWidth();
    reinitComponents();
  }

  const selectedCount = state.ui.selectedIds.length;
  document.getElementById('table-summary').textContent = selectedCount
    ? `${selectedCount} of ${total} row${total === 1 ? '' : 's'} selected`
    : total
      ? `Showing ${(state.ui.page - 1) * state.ui.pageSize + 1}–${Math.min(state.ui.page * state.ui.pageSize, total)} of ${total} jobs`
      : 'Showing 0 jobs';

  const pagination = document.getElementById('pagination');
  renderPaginationControls(pagination, totalPages);
}

const App = {
  toggleSort(column) {
    if (state.ui.sortColumn === column) {
      state.ui.sortDir = state.ui.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.ui.sortColumn = column;
      state.ui.sortDir = 'asc';
    }
    state.ui.page = 1;
    saveUiState();
    renderJobs();
  },

  openRowMenu(jobId, anchorBtn) {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const panel = document.getElementById('row-actions-panel');
    panel.innerHTML = buildRowMenuItems(job);
    positionRowMenu(anchorBtn);
  },

  init() {
    const bootstrap = window.__CRON_GUI__ || {};
    routes = bootstrap.routes || {};
    state = buildInitialState(bootstrap);
    state.ui.theme = state.ui.theme || 'light';

    applyTheme(state.ui.theme);
    document.getElementById('env-vars').value = state.envVars;
    document.getElementById('search-input').value = state.ui.search;
    document.getElementById('status-filter').value = state.ui.statusFilter || 'all';
    document.getElementById('page-size').value = String(state.ui.pageSize);
    renderSchedulePresets();
    renderStatusFilter();
    renderJobs();
    renderActionsMenu();
    reinitComponents();

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('row-actions-panel');
      if (panel.hidden) return;
      if (panel.contains(e.target) || e.target.closest('.actions-cell button')) return;
      closeRowMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeRowMenu();
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
      state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark';
      applyTheme(state.ui.theme);
      saveUiState();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      state.ui.search = e.target.value;
      state.ui.page = 1;
      saveUiState();
      renderJobs();
    });

    document.getElementById('status-filter').addEventListener('change', (e) => {
      state.ui.statusFilter = e.target.value;
      state.ui.page = 1;
      saveUiState();
      renderJobs();
    });

    document.getElementById('page-size').addEventListener('change', (e) => {
      state.ui.pageSize = Number(e.target.value);
      state.ui.page = 1;
      saveUiState();
      renderJobs();
    });

    document.getElementById('job-cron').addEventListener('input', syncSchedulePreset);

    document.getElementById('confirm-ok').addEventListener('click', () => {
      document.getElementById('confirm-dialog').close();
      if (confirmCallback) confirmCallback();
      confirmCallback = null;
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      const input = e.target;
      const file = input.files[0];
      if (!file) return;
      openConfirm(
        'Import database',
        'A backup will be created automatically before importing.',
        `<p>${escapeHtml(file.name)}</p>`,
        () => {
          document.getElementById('import-form').submit();
          input.value = '';
        }
      );
    });

    const restoreParam = new URLSearchParams(window.location.search).get('restore');
    if (restoreParam) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
      App.openRestorePreview(restoreParam);
    }
  },

  saveEnvVars() {
    state.envVars = document.getElementById('env-vars').value;
    document.getElementById('settings-drawer').close();
    toast('success', 'Environment updated', 'Variables will be saved when you deploy to crontab.');
  },

  clearFilters() {
    state.ui.search = '';
    state.ui.statusFilter = 'all';
    state.ui.page = 1;
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all';
    saveUiState();
    renderJobs();
  },

  toggleSelect(id, checked) {
    if (checked) {
      if (!state.ui.selectedIds.includes(id)) state.ui.selectedIds.push(id);
    } else {
      state.ui.selectedIds = state.ui.selectedIds.filter((x) => x !== id);
    }
    saveUiState();
    renderJobs();
  },

  toggleSelectAll(checked) {
    const pageIds = paginatedJobs().map((j) => j.id);
    if (checked) {
      state.ui.selectedIds = [...new Set([...state.ui.selectedIds, ...pageIds])];
    } else {
      const remove = new Set(pageIds);
      state.ui.selectedIds = state.ui.selectedIds.filter((id) => !remove.has(id));
    }
    saveUiState();
    renderJobs();
  },

  clearSelection() {
    state.ui.selectedIds = [];
    saveUiState();
    renderJobs();
  },

  async bulkEnable() {
    const ids = [...state.ui.selectedIds];
    if (!ids.length) return;
    try {
      for (const id of ids) {
        await apiPost('start', { _id: id });
      }
      reloadPage();
    } catch (err) {
      toast('error', 'Bulk enable failed', err.message);
    }
  },

  async bulkDisable() {
    const ids = [...state.ui.selectedIds];
    if (!ids.length) return;
    try {
      for (const id of ids) {
        await apiPost('stop', { _id: id });
      }
      reloadPage();
    } catch (err) {
      toast('error', 'Bulk disable failed', err.message);
    }
  },

  bulkDelete() {
    const ids = [...state.ui.selectedIds];
    if (!ids.length) return;
    openConfirm(
      'Delete selected jobs',
      `Permanently remove ${ids.length} selected job${ids.length === 1 ? '' : 's'}?`,
      '',
      async () => {
        try {
          for (const id of ids) {
            await apiPost('remove', { _id: id });
          }
          reloadPage();
        } catch (err) {
          toast('error', 'Bulk delete failed', err.message);
        }
      },
      true
    );
  },

  confirmRunJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    openConfirm(
      'Run job now',
      `Execute "${job.name || id}" immediately?`,
      `<p style="margin:0;font-family:var(--font-mono);font-size:0.8125rem;color:var(--muted-foreground);word-break:break-all">${escapeHtml(job.command)}</p>`,
      () => App.runJob(id)
    );
  },

  openNewJob() {
    editingJobId = null;
    document.getElementById('job-dialog-title').textContent = 'New job';
    document.getElementById('job-name').value = '';
    document.getElementById('job-command').value = '';
    document.getElementById('job-logging').checked = false;
    document.getElementById('mail-transporter').value = '';
    document.getElementById('mail-options').value = '';
    if (window.config) {
      document.getElementById('mail-transporter').placeholder = window.config.transporterStr || '';
      document.getElementById('mail-options').placeholder = window.config.mailOptions
        ? JSON.stringify(window.config.mailOptions, null, 2)
        : '';
    }
    setScheduleValue('* * * * *');
    syncSchedulePreset();
    document.getElementById('job-advanced').open = false;
    document.getElementById('job-dialog').showModal();
  },

  openEditJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    editingJobId = id;
    document.getElementById('job-dialog-title').textContent = 'Edit job';
    document.getElementById('job-name').value = job.name || '';
    document.getElementById('job-command').value = job.command;
    document.getElementById('job-logging').checked = job.logging;
    const mailing = job.mailing || {};
    document.getElementById('mail-transporter').value = mailing.transporterStr || mailing.transporter || '';
    document.getElementById('mail-options').value = mailing.mailOptions
      ? JSON.stringify(mailing.mailOptions, null, 2)
      : (mailing.options ? JSON.stringify(mailing.options, null, 2) : '');
    setScheduleValue(job.schedule);
    syncSchedulePreset();
    const hasMailing = !!(mailing.transporterStr || mailing.transporter || mailing.mailOptions || mailing.options);
    document.getElementById('job-advanced').open = hasMailing;
    document.getElementById('job-dialog').showModal();
  },

  async saveJob() {
    const commandRaw = document.getElementById('job-command').value;
    const command = collapsedCommand(commandRaw);
    if (!command) {
      toast('error', 'Validation error', 'Command is required.');
      return;
    }
    const schedule = getScheduleValue();
    const transporter = document.getElementById('mail-transporter').value.trim();
    const optionsRaw = document.getElementById('mail-options').value.trim();
    let mailing = {};
    if (transporter || optionsRaw) {
      try {
        mailing = buildMailingPayload(transporter, optionsRaw);
      } catch {
        toast('error', 'Invalid mail config', 'Mail options must be valid JSON.');
        return;
      }
    }

    const payload = {
      name: document.getElementById('job-name').value.trim(),
      command,
      schedule,
      _id: editingJobId || -1,
      logging: document.getElementById('job-logging').checked ? 'true' : 'false',
      mailing,
    };

    try {
      await apiPost('save', payload);
      document.getElementById('job-dialog').close();
      reloadPage();
    } catch (err) {
      toast('error', 'Save failed', err.message);
    }
  },

  async toggleJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    try {
      if (job.enabled) {
        await apiPost('stop', { _id: id });
      } else {
        await apiPost('start', { _id: id });
      }
      reloadPage();
    } catch (err) {
      toast('error', 'Status update failed', err.message);
    }
  },

  async duplicateJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    const mailing = job.mailing || {};
    try {
      await apiPost('save', {
        _id: -1,
        name: job.name ? `${job.name} (copy)` : '',
        command: job.command,
        schedule: job.schedule,
        logging: job.logging ? 'true' : 'false',
        mailing,
      });
      reloadPage();
    } catch (err) {
      toast('error', 'Duplicate failed', err.message);
    }
  },

  confirmDeleteJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    openConfirm('Delete job', `This will permanently remove "${job?.name || id}".`, '', async () => {
      try {
        await apiPost('remove', { _id: id });
        reloadPage();
      } catch (err) {
        toast('error', 'Delete failed', err.message);
      }
    }, true);
  },

  async runJob(id) {
    try {
      await apiPost('run', { _id: id });
      reloadPage();
    } catch (err) {
      toast('error', 'Run failed', err.message);
    }
  },

  async openLogs(id, tab) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    document.getElementById('logs-title').textContent = job.name || job.id;
    document.getElementById('logs-subtitle').textContent = job.command;

    try {
      const [stdoutRes, stderrRes] = await Promise.all([
        apiGet('stdout', { id }),
        apiGet('logger', { id }),
      ]);
      document.getElementById('stdout-content').textContent = await stdoutRes.text();
      document.getElementById('stderr-content').textContent = await stderrRes.text();
    } catch (err) {
      toast('error', 'Failed to load logs', err.message);
      return;
    }

    document.getElementById('logs-drawer').showModal();
    const tabEl = document.getElementById(tab === 'stderr' ? 'logs-tab-stderr' : 'logs-tab-stdout');
    requestAnimationFrame(() => {
      const tabsEl = document.getElementById('logs-tabs');
      if (tabsEl?.tabs?.select && tabEl) tabsEl.tabs.select(tabEl);
      else tabEl?.click();
    });
  },

  createBackup() {
    openConfirm('Create backup', 'Copy the current jobs database to a dated backup file?', '', async () => {
      try {
        await apiGet('backup');
        reloadPage();
      } catch (err) {
        toast('error', 'Backup failed', err.message);
      }
    });
  },

  openBackupDialog() {
    renderBackupDialog();
    document.getElementById('backup-dialog').showModal();
  },

  deleteBackup(id) {
    openConfirm('Delete backup', `Delete backup "${id}"?`, '', async () => {
      try {
        await apiGet('delete_backup', { db: id });
        reloadPage();
      } catch (err) {
        toast('error', 'Delete backup failed', err.message);
      }
    }, true);
  },

  async openRestorePreview(id) {
    try {
      const res = await apiGet('restore_data', { db: id });
      const docs = await res.json();
      document.getElementById('restore-desc').textContent = `Backup "${id}" contains ${docs.length} jobs.`;
      document.getElementById('restore-table-body').innerHTML = docs.map((j) => `
        <tr>
          <td>${escapeHtml(j.name || j._id)}</td>
          <td><span class="job-command">${escapeHtml(j.command)}</span></td>
          <td>${escapeHtml(j.schedule)}</td>
          <td>${j.stopped ? 'Disabled' : 'Enabled'}</td>
        </tr>`).join('');
      document.getElementById('restore-confirm-btn').onclick = () => App.restoreBackup(id);
      document.getElementById('restore-dialog').showModal();
    } catch (err) {
      toast('error', 'Failed to load backup', err.message);
    }
  },

  async restoreBackup(id) {
    try {
      await apiGet('restore_backup', { db: id });
      reloadPage();
    } catch (err) {
      toast('error', 'Restore failed', err.message);
    }
  },

  exportData() {
    window.location.href = routeUrl('export');
  },

  getFromCrontab() {
    openConfirm(
      'Get from crontab',
      'Import jobs from the system crontab?',
      '<p>A backup will be created automatically before importing.</p>',
      async () => {
        try {
          await apiGet('import_crontab');
          reloadPage();
        } catch (err) {
          toast('error', 'Import failed', err.message);
        }
      }
    );
  },

  confirmSaveToCrontab() {
    openConfirm(
      'Save to crontab',
      'Deploy environment variables and all enabled jobs to the system crontab?',
      '<p>This writes to the system crontab and marks jobs as saved.</p>',
      async () => {
        try {
          const envVars = document.getElementById('env-vars').value;
          await apiGet('crontab', { env_vars: envVars });
          reloadPage();
        } catch (err) {
          toast('error', 'Deploy failed', err.message);
        }
      }
    );
  },

  async openPreview() {
    try {
      const res = await apiGet('preview_crontab');
      const text = await res.text();
      document.getElementById('preview-content').textContent = text || '# (empty crontab)';
      document.getElementById('preview-unsaved-alert').classList.toggle('hidden', !hasUnsavedWork());
      document.getElementById('preview-dialog').showModal();
    } catch (err) {
      toast('error', 'Preview failed', err.message);
    }
  },

  copyPreview() {
    navigator.clipboard.writeText(document.getElementById('preview-content').textContent).then(() => {
      toast('success', 'Copied', 'Crontab preview copied to clipboard.');
    });
  },
};

window.App = App;
window.closeRowMenu = closeRowMenu;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window.basecoat?.initAll?.();
});
