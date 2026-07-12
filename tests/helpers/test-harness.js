'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

const ROOT = path.join(__dirname, '..', '..');

const MODULES_TO_CLEAR = [
  path.join(ROOT, 'app.js'),
  path.join(ROOT, 'crontab.js'),
  path.join(ROOT, 'restore.js'),
];

function clearModuleCache() {
  for (const resolved of MODULES_TO_CLEAR) {
    delete require.cache[resolved];
  }
}

function promisifyCrontab(fn, ...args) {
  return new Promise((resolve) => {
    fn(...args, resolve);
  });
}

function createTestHarness(options = {}) {
  const testDbPath = path.join(
    os.tmpdir(),
    `cron-gui-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(testDbPath, { recursive: true });
  fs.mkdirSync(path.join(testDbPath, 'logs'), { recursive: true });

  process.env.CRON_DB_PATH = testDbPath;
  process.env.CRON_PATH = testDbPath;
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';
  process.env.CRON_GUI_TEST = '1';

  if (options.auth) {
    process.env.BASIC_AUTH_USER = options.auth.user;
    process.env.BASIC_AUTH_PWD = options.auth.password;
  } else {
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PWD;
  }

  clearModuleCache();

  const app = require('../../app');
  const crontab = require('../../crontab');
  const agent = request(app);

  return {
    app,
    crontab,
    agent,
    testDbPath,
    async cleanup() {
      await new Promise((resolve) => { setTimeout(resolve, 300); });
      clearModuleCache();
      delete process.env.CRON_GUI_TEST;
      fs.rmSync(testDbPath, { recursive: true, force: true });
    },
    listJobs() {
      return promisifyCrontab(crontab.crontabs.bind(crontab));
    },
    listPendingDeletes() {
      return promisifyCrontab(crontab.pending_delete_jobs.bind(crontab));
    },
    async waitForJob(name, timeoutMs = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const jobs = await this.listJobs();
        const job = jobs.find((entry) => entry.name === name);
        if (job) return job;
        await new Promise((resolve) => { setTimeout(resolve, 25); });
      }
      throw new Error(`Job "${name}" not found within ${timeoutMs}ms`);
    },
    async createJob(overrides = {}) {
      const payload = {
        _id: -1,
        name: 'test-job',
        command: 'echo hello',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
        ...overrides,
      };
      const res = await agent.post('/save').send(payload);
      expect(res.status).toBe(200);
      return this.waitForJob(payload.name);
    },
    async pageHtml() {
      const res = await agent.get('/');
      expect(res.status).toBe(200);
      return res.text;
    },
    pagePendingDeleteCount(html) {
      const match = html.match(/pendingDeletes:\s*(\d+)/);
      return match ? Number(match[1]) : 0;
    },
    backupFiles() {
      return fs.readdirSync(testDbPath).filter((f) => f.startsWith('backup'));
    },
    async createBackup() {
      const before = this.backupFiles().length;
      const res = await agent.get('/backup');
      expect(res.status).toBe(200);
      const start = Date.now();
      while (Date.now() - start < 3000) {
        if (this.backupFiles().length > before) return;
        await new Promise((resolve) => { setTimeout(resolve, 25); });
      }
      throw new Error('Backup file was not created');
    },
    async deploy(envVars = '') {
      const childProcess = require('child_process');
      const originalExec = childProcess.exec;
      childProcess.exec = (_cmd, cb) => {
        cb(null, '');
      };
      try {
        const res = await agent.get(`/crontab?env_vars=${encodeURIComponent(envVars)}`);
        await new Promise((resolve) => { setTimeout(resolve, 150); });
        return res;
      } finally {
        childProcess.exec = originalExec;
      }
    },
    async seedJobDoc(doc) {
      const dbFile = path.join(testDbPath, 'crontab.db');
      fs.appendFileSync(dbFile, `${JSON.stringify(doc)}\n`);
      crontab.reload_db();
      await new Promise((resolve) => { setTimeout(resolve, 150); });
    },
  };
}

function createCrontabHarness() {
  const testDbPath = path.join(
    os.tmpdir(),
    `cron-gui-crontab-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(testDbPath, { recursive: true });
  fs.mkdirSync(path.join(testDbPath, 'logs'), { recursive: true });

  process.env.CRON_DB_PATH = testDbPath;
  process.env.CRON_PATH = testDbPath;
  process.env.CRON_GUI_TEST = '1';

  clearModuleCache();
  const crontab = require('../../crontab');

  return {
    crontab,
    testDbPath,
    async cleanup() {
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      clearModuleCache();
      delete process.env.CRON_GUI_TEST;
      fs.rmSync(testDbPath, { recursive: true, force: true });
    },
  };
}

module.exports = { createTestHarness, createCrontabHarness, clearModuleCache };
