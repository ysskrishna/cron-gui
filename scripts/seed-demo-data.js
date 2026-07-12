#!/usr/bin/env node
'use strict';

/**
 * Seeds realistic demo data for README screenshots.
 * Usage: node scripts/seed-demo-data.js
 */

const fs = require('fs');
const path = require('path');

const dbFolder = process.env.CRON_DB_PATH || path.join(__dirname, '..', 'crontabs');
const logFolder = path.join(dbFolder, 'logs');
const crontabDbFile = path.join(dbFolder, 'crontab.db');
const envFile = path.join(dbFolder, 'env.db');

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const jobs = [
  {
    _id: 'demo01dbBackup',
    name: 'nightly-db-backup',
    command: '/usr/local/bin/pg_dump production | gzip > /var/backups/app-$(date +%F).sql.gz',
    schedule: '0 2 * * *',
    stopped: false,
    logging: 'true',
    mailing: {},
    created: now - 14 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 2 * day).toString(),
  },
  {
    _id: 'demo02health',
    name: 'api-health-check',
    command: 'curl -sf https://api.example.com/health || echo "API unreachable" >&2',
    schedule: '*/5 * * * *',
    stopped: false,
    logging: 'true',
    mailing: { onError: true, to: 'ops@example.com' },
    created: now - 30 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 1 * day).toString(),
  },
  {
    _id: 'demo03sync',
    name: 'sync-cdn-assets',
    command: 'aws s3 sync /var/www/static s3://cdn.example.com/assets --delete --quiet',
    schedule: '*/15 * * * *',
    stopped: false,
    logging: 'false',
    mailing: {},
    created: now - 21 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 5 * day).toString(),
  },
  {
    _id: 'demo04purge',
    name: 'purge-old-logs',
    command: 'find /var/log/myapp -name "*.log" -mtime +30 -delete',
    schedule: '0 3 * * 0',
    stopped: false,
    logging: 'true',
    mailing: {},
    created: now - 60 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 10 * day).toString(),
  },
  {
    _id: 'demo05report',
    name: 'weekly-sales-report',
    command: 'node /opt/reports/generate-weekly.js --email finance@example.com',
    schedule: '0 8 * * 1',
    stopped: false,
    logging: 'true',
    mailing: { onSuccess: true, to: 'finance@example.com' },
    created: now - 3 * day,
    saved: false,
    everDeployed: false,
    timestamp: new Date(now - 3 * day).toString(),
  },
  {
    _id: 'demo06ssl',
    name: 'renew-ssl-certs',
    command: 'certbot renew --quiet --deploy-hook "systemctl reload nginx"',
    schedule: '@reboot',
    stopped: false,
    logging: 'true',
    mailing: {},
    created: now - 90 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 45 * day).toString(),
  },
  {
    _id: 'demo07cache',
    name: 'warm-redis-cache',
    command: 'node /opt/cache/warm.js --keys homepage,products,pricing',
    schedule: '0 */6 * * *',
    stopped: false,
    logging: 'false',
    mailing: {},
    created: now - 7 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 7 * day).toString(),
  },
  {
    _id: 'demo08legacy',
    name: 'legacy-cron-import',
    command: '/opt/legacy/run-import.sh --mode incremental',
    schedule: '0 0 * * *',
    stopped: true,
    logging: 'false',
    mailing: {},
    created: now - 120 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 30 * day).toString(),
  },
  {
    _id: 'demo09rotate',
    name: 'rotate-app-secrets',
    command: 'vault write -field=token auth/approle/role/app/secret-id',
    schedule: '0 4 1 * *',
    stopped: false,
    logging: 'true',
    mailing: {},
    created: now - 1 * day,
    saved: false,
    everDeployed: false,
    timestamp: new Date(now - 6 * 60 * 60 * 1000).toString(),
  },
  {
    _id: 'demo10metrics',
    name: 'push-prometheus-metrics',
    command: 'node /opt/metrics/push-gateway.js --job batch',
    schedule: '0 * * * *',
    stopped: false,
    logging: 'true',
    mailing: {},
    created: now - 5 * day,
    saved: true,
    everDeployed: true,
    timestamp: new Date(now - 12 * 60 * 60 * 1000).toString(),
  },
];

const envVars = [
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'MAILTO=ops@example.com',
  'SHELL=/bin/bash',
  'NODE_ENV=production',
].join('\n');

const healthStdout = [
  'Sun Jul 12 14:00:01 IST 2026',
  '{"status":"ok","latency_ms":42,"version":"2.4.1"}',
  '',
  'Sun Jul 12 14:05:01 IST 2026',
  '{"status":"ok","latency_ms":38,"version":"2.4.1"}',
  '',
  'Sun Jul 12 14:10:01 IST 2026',
  '{"status":"ok","latency_ms":45,"version":"2.4.1"}',
].join('\n');

const backupStdout = [
  'Sun Jul 12 02:00:01 IST 2026',
  'pg_dump: last built-in OID is 16383',
  'pg_dump: reading extensions',
  'pg_dump: dumping contents of table "public.users"',
  'Backup complete: /var/backups/app-2026-07-12.sql.gz (48 MB)',
].join('\n');

const metricsStderr = [
  'Sun Jul 12 13:00:02 IST 2026',
  'Warning: push gateway unreachable, retrying in 30s',
  '',
  'Sun Jul 12 13:00:32 IST 2026',
  'Metrics pushed: 142 series',
].join('\n');

function resetFolder() {
  fs.mkdirSync(dbFolder, { recursive: true });
  fs.mkdirSync(logFolder, { recursive: true });

  for (const file of fs.readdirSync(dbFolder)) {
    if (file.startsWith('backup') || file.endsWith('.db')) {
      fs.unlinkSync(path.join(dbFolder, file));
    }
  }

  for (const file of fs.readdirSync(logFolder)) {
    fs.unlinkSync(path.join(logFolder, file));
  }
}

function writeDb() {
  const lines = jobs.map((job) => JSON.stringify(job)).join('\n') + '\n';
  fs.writeFileSync(crontabDbFile, lines, 'utf8');
  fs.writeFileSync(envFile, envVars, 'utf8');
}

function writeLogs() {
  fs.writeFileSync(path.join(logFolder, 'demo02health.stdout.log'), healthStdout);
  fs.writeFileSync(path.join(logFolder, 'demo01dbBackup.stdout.log'), backupStdout);
  fs.writeFileSync(path.join(logFolder, 'demo10metrics.log'), metricsStderr);
}

function writeBackups() {
  const makeBackupName = (date) => `backup ${date.toString().replace('+', ' ')}.db`;

  const recent = new Date('2026-07-11T02:00:00');
  const older = new Date('2026-07-04T02:00:00');

  fs.copyFileSync(crontabDbFile, path.join(dbFolder, makeBackupName(recent)));
  fs.copyFileSync(crontabDbFile, path.join(dbFolder, makeBackupName(older)));
}

resetFolder();
writeDb();
writeLogs();
writeBackups();

console.log(`Seeded ${jobs.length} jobs in ${dbFolder}`);
console.log('Created env vars, log files, and 2 backup snapshots.');
