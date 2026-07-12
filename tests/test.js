'use strict';

/* global describe, it, expect, beforeAll, afterAll, vi */
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `cron-gui-test-${Date.now()}`);
fs.mkdirSync(testDbPath, { recursive: true });
fs.mkdirSync(path.join(testDbPath, 'logs'), { recursive: true });

process.env.CRON_DB_PATH = testDbPath;
process.env.CRON_PATH = testDbPath;
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';

const app = require('../app');

describe('Cron GUI', () => {
  afterAll(() => {
    fs.rmSync(testDbPath, { recursive: true, force: true });
  });

  describe('GET /', () => {
    it('should return the main page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Cron GUI');
      expect(res.text).toContain('New job');
    });
  });

  describe('POST /save', () => {
    it('should create a new job', async () => {
      const res = await request(app)
        .post('/save')
        .send({
          _id: -1,
          name: 'test-job',
          command: 'echo hello',
          schedule: '* * * * *',
          logging: 'false',
          mailing: {},
        });
      expect(res.status).toBe(200);
    });

    it('should reject an invalid cron schedule', async () => {
      const res = await request(app)
        .post('/save')
        .send({
          _id: -1,
          name: 'bad-schedule-job',
          command: 'echo hello',
          schedule: '* * * * * sa',
          logging: 'false',
          mailing: {},
        });
      expect(res.status).toBe(400);
      expect(res.text).toContain('Too many fields');
    });

    it('should show the new job on the main page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('test-job');
      expect(res.text).toContain('echo hello');
    });
  });

  describe('POST /stop and /start', () => {
    let jobId;

    beforeAll(async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'stop-start-job',
        command: 'echo stop-start',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });
      const res = await request(app).get('/');
      const match = res.text.match(/data-job-id="([^"]+)"/);
      jobId = match ? match[1] : null;
    });

    it('should stop a job', async () => {
      if (!jobId) return;
      const res = await request(app)
        .post('/stop')
        .send({ _id: jobId });
      expect(res.status).toBe(200);
    });

    it('should start a job', async () => {
      if (!jobId) return;
      const res = await request(app)
        .post('/start')
        .send({ _id: jobId });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /backup', () => {
    it('should create a backup', async () => {
      const res = await request(app).get('/backup');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /export', () => {
    it('should export the database', async () => {
      const res = await request(app).get('/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('crontab.db');
    });
  });

  describe('POST /save (update)', () => {
    it('should preserve stopped state when editing a job', async () => {
      const page = await request(app).get('/');
      const match = page.text.match(/data-job-id="([^"]+)"/);
      const jobId = match ? match[1] : null;
      if (!jobId) return;

      await request(app).post('/stop').send({ _id: jobId });
      await request(app).post('/save').send({
        _id: jobId,
        name: 'updated-name',
        command: 'echo updated',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });

      const after = await request(app).get('/');
      expect(after.text).toContain('updated-name');
      expect(after.text).toContain('data-variant="secondary">Disabled</span>');
    });
  });

  describe('POST /save (duplicate)', () => {
    it('should duplicate an existing job', async () => {
      const page = await request(app).get('/');
      const match = page.text.match(/data-job-id="([^"]+)"/);
      const jobId = match ? match[1] : null;
      if (!jobId) return;

      const jobMatch = page.text.match(/test-job/);
      expect(jobMatch).not.toBeNull();

      const res = await request(app)
        .post('/save')
        .send({
          _id: -1,
          name: 'test-job (copy)',
          command: 'echo hello',
          schedule: '* * * * *',
          logging: 'false',
          mailing: {},
        });
      expect(res.status).toBe(200);

      const afterPage = await request(app).get('/');
      expect(afterPage.text).toContain('test-job (copy)');
    });
  });

  describe('GET /preview_crontab', () => {
    it('should return the crontab preview as plain text', async () => {
      const res = await request(app).get('/preview_crontab');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('echo hello');
    });

    it('should include the make_command wrapper (tee pipeline)', async () => {
      const res = await request(app).get('/preview_crontab');
      expect(res.text).toContain('tee');
      expect(res.text).toContain('stderr');
    });

    it('should include deploy markers in preview output', async () => {
      const res = await request(app).get('/preview_crontab');
      expect(res.text).toContain('# cron-gui:id=');
    });

    it('should only include active (non-stopped) jobs', async () => {
      const page = await request(app).get('/');
      const match = page.text.match(/data-job-id="([^"]+)"/);
      if (!match) return;

      await request(app).post('/stop').send({ _id: match[1] });

      const res = await request(app).get('/preview_crontab');
      const lines = res.text.trim().split('\n').filter((l) => l.includes('echo hello'));
      const activePage = await request(app).get('/');
      const activeCount = (activePage.text.match(/data-variant="outline">Unsaved/g) || []).length
        + (activePage.text.match(/<span class="badge">Active<\/span>/g) || []).length;
      expect(lines.length).toBeLessThanOrEqual(activeCount);

      await request(app).post('/start').send({ _id: match[1] });
    });

    it('should use env_vars query param when provided', async () => {
      const res = await request(app).get('/preview_crontab?env_vars=MAILTO=preview%40test.com');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^MAILTO=preview@test.com/);
    });
  });

  describe('Input validation', () => {
    it('should reject path traversal in db param', async () => {
      const res = await request(app).get('/restore?db=../../etc/passwd');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid db parameter');
    });

    it('should reject invalid characters in id param', async () => {
      const res = await request(app).get('/logger?id=../../../etc/passwd');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid id parameter');
    });

    it('should allow valid db param', async () => {
      const res = await request(app).get('/restore?db=crontab.db');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('restore=crontab.db');
    });

    it('should allow valid id param', async () => {
      const res = await request(app).get('/logger?id=abc123_test-id');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /remove', () => {
    let jobId;

    beforeAll(async () => {
      const res = await request(app).get('/');
      const match = res.text.match(/data-job-id="([^"]+)"/);
      jobId = match ? match[1] : null;
    });

    it('should remove a job', async () => {
      if (!jobId) return;
      const res = await request(app)
        .post('/remove')
        .send({ _id: jobId });
      expect(res.status).toBe(200);
    });

    it('should remove the duplicated job too', async () => {
      const page = await request(app).get('/');
      const match = page.text.match(/data-job-id="([^"]+)"/);
      if (!match) return;
      const res = await request(app)
        .post('/remove')
        .send({ _id: match[1] });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /logger', () => {
    it('should return no errors message when no log exists', async () => {
      const res = await request(app).get('/logger?id=nonexistent');
      expect(res.status).toBe(200);
      expect(res.text).toContain('No errors logged yet');
    });

    it('should return text/plain content type when no log exists', async () => {
      const res = await request(app).get('/logger?id=nonexistent');
      expect(res.headers['content-type']).toContain('text/plain');
    });

    it('should return text/plain and no-store when log file exists', async () => {
      const logFile = path.join(testDbPath, 'logs', 'testlog.log');
      fs.writeFileSync(logFile, 'some error output\n');
      const res = await request(app).get('/logger?id=testlog');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('some error output');
      fs.unlinkSync(logFile);
    });
  });

  describe('GET /stdout', () => {
    it('should return no output message when no log exists', async () => {
      const res = await request(app).get('/stdout?id=nonexistent');
      expect(res.status).toBe(200);
      expect(res.text).toContain('No output logged yet');
    });

    it('should return text/plain content type when no log exists', async () => {
      const res = await request(app).get('/stdout?id=nonexistent');
      expect(res.headers['content-type']).toContain('text/plain');
    });

    it('should return text/plain and no-store when stdout log exists', async () => {
      const logFile = path.join(testDbPath, 'logs', 'teststdout.stdout.log');
      fs.writeFileSync(logFile, 'some stdout output\n');
      const res = await request(app).get('/stdout?id=teststdout');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('some stdout output');
      fs.unlinkSync(logFile);
    });
  });

  describe('GET /import_crontab (auto-backup)', () => {
    it('should create a backup before importing', async () => {
      // ensure a job exists so crontab.db is non-empty
      await request(app).post('/save').send({
        _id: -1, name: 'backup-test', command: 'echo backup',
        schedule: '* * * * *', logging: 'false', mailing: {},
      });
      // small delay so backup filename (based on date) doesn't collide
      await new Promise((r) => setTimeout(r, 1100));
      const backupsBefore = fs.readdirSync(testDbPath)
        .filter((f) => f.startsWith('backup'));
      await request(app).get('/import_crontab');
      const backupsAfter = fs.readdirSync(testDbPath)
        .filter((f) => f.startsWith('backup'));
      expect(backupsAfter.length).toBe(backupsBefore.length + 1);
    });

    it('should surface crontab -l failures to the client', async () => {
      const childProcess = require('child_process');
      const spy = vi.spyOn(childProcess, 'exec').mockImplementation((cmd, cb) => {
        cb(Object.assign(new Error('no crontab for user'), { code: 1 }), '');
      });

      const res = await request(app).get('/import_crontab');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No crontab for this user');
      spy.mockRestore();
    });
  });

  describe('POST /import (auto-backup)', () => {
    it('should create a backup before importing a db file', async () => {
      // small delay so backup filename (based on date) doesn't collide
      await new Promise((r) => setTimeout(r, 1100));
      const backupsBefore = fs.readdirSync(testDbPath)
        .filter((f) => f.startsWith('backup'));
      const dbContent = fs.readFileSync(path.join(testDbPath, 'crontab.db'));
      await request(app)
        .post('/import')
        .attach('file', dbContent, 'crontab.db');
      const backupsAfter = fs.readdirSync(testDbPath)
        .filter((f) => f.startsWith('backup'));
      expect(backupsAfter.length).toBe(backupsBefore.length + 1);
    });
  });

  describe('GET /restore_data', () => {
    it('should return backup jobs as JSON', async () => {
      await request(app).get('/backup');
      const backups = fs.readdirSync(testDbPath).filter((f) => f.startsWith('backup'));
      if (!backups.length) return;
      const res = await request(app).get(`/restore_data?db=${encodeURIComponent(backups[0])}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Pending deploy after delete', () => {
    it('should flag pending deploy when deleting a deployed job', async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'deployed-delete-test',
        command: 'echo deployed-delete',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });

      const created = await request(app).get('/');
      const idMatch = created.text.match(/data-job-id="([^"]+)"[^>]*>[\s\S]*?deployed-delete-test/);
      if (!idMatch) return;
      const jobId = idMatch[1];

      await request(app).get('/crontab?env_vars=');
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      await request(app).post('/remove').send({ _id: jobId });
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const after = await request(app).get('/');
      expect(after.text).toContain('pendingDeletes: 1');
      expect(after.text).toContain('data-pending-removal="true"');
      expect(after.text).toContain('deployed-delete-test');
      expect(after.text).toContain('Pending removal');
    });

    it('should not flag pending deploy when deleting an unsaved job', async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'unsaved-delete-test',
        command: 'echo unsaved-delete',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });

      const created = await request(app).get('/');
      const idMatch = created.text.match(/data-job-id="([^"]+)"[^>]*>[\s\S]*?unsaved-delete-test/);
      if (!idMatch) return;
      const jobId = idMatch[1];

      await request(app).post('/remove').send({ _id: jobId });
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const after = await request(app).get('/');
      expect(after.text).toContain('pendingDeletes: 0');
      expect(after.text).not.toContain('unsaved-delete-test');
    });
  });

  describe('POST /undelete', () => {
    it('should restore a staged delete before deploy', async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'undelete-test',
        command: 'echo undelete',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });

      const created = await request(app).get('/');
      const idMatch = created.text.match(/data-job-id="([^"]+)"[^>]*>[\s\S]*?undelete-test/);
      if (!idMatch) return;
      const jobId = idMatch[1];

      await request(app).get('/crontab?env_vars=');
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      await request(app).post('/remove').send({ _id: jobId });
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const staged = await request(app).get('/');
      expect(staged.text).toContain('data-pending-removal="true"');

      await request(app).post('/undelete').send({ _id: jobId });
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const restored = await request(app).get('/');
      expect(restored.text).toContain('undelete-test');
      expect(restored.text).not.toContain('data-pending-removal="true"');
      expect(restored.text).toContain('pendingDeletes: 0');
    });
  });

  describe('GET /system_crontab', () => {
    it('should return plain text system crontab', async () => {
      const res = await request(app).get('/system_crontab');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('GET /backups_list', () => {
    it('should return backup names as JSON', async () => {
      await request(app).get('/backup');
      const res = await request(app).get('/backups_list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /delete_backups', () => {
    it('should delete multiple backup files', async () => {
      await request(app).get('/backup');
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      await request(app).get('/backup');
      await new Promise((resolve) => { setTimeout(resolve, 50); });

      const backups = fs.readdirSync(testDbPath).filter((f) => f.startsWith('backup'));
      if (backups.length < 2) return;

      const toDelete = backups.slice(0, 2);
      const res = await request(app).post('/delete_backups').send({ dbs: toDelete });
      expect(res.status).toBe(200);

      await new Promise((resolve) => { setTimeout(resolve, 100); });
      const remaining = fs.readdirSync(testDbPath).filter((f) => f.startsWith('backup'));
      toDelete.forEach((name) => {
        expect(remaining).not.toContain(name);
      });
    });
  });

  describe('Command textarea', () => {
    it('should render a textarea for the command field', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('<textarea');
      expect(res.text).toContain('data-testid="job-command"');
    });

    it('should render deploy cluster in toolbar', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('data-testid="deploy-cluster"');
      expect(res.text).toContain('data-testid="unsaved-indicator"');
      expect(res.text).toContain('data-testid="preview-deploy-btn"');
      expect(res.text).toContain('pendingDeleteJobs');
      expect(res.text).toContain('system_crontab');
    });
  });

  describe('crontab deploy markers', () => {
    const crontab = require('../crontab');

    function uniqueJobCount(html) {
      return new Set([...html.matchAll(/data-job-id="([^"]+)"/g)].map((m) => m[1])).size;
    }

    it('parseCrontabLine extracts marker and schedule', () => {
      const line = crontab.formatCrontabJobLine({
        _id: 'marker-job',
        schedule: '* * * * *',
        command: 'echo marker-test',
        logging: 'false',
        mailing: {},
      });
      const parsed = crontab.parseCrontabLine(line);
      expect(parsed.markerId).toBe('marker-job');
      expect(parsed.schedule).toBe('* * * * *');
      expect(parsed.command).toContain('echo marker-test');
    });

    it('unwrapCronGuiCommand extracts the inner shell command', () => {
      const wrapped = '(({ echo "test2"; } | tee /tmp/x.stdout) 3>&1 1>&2 2>&3 | tee /tmp/x.stderr) 3>&1 1>&2 2>&3';
      expect(crontab.unwrapCronGuiCommand(wrapped)).toBe('echo "test2"');
    });

    it('should skip import for marked jobs already in the database', async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'marker-skip-job',
        command: 'echo marker-skip',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });
      const page = await request(app).get('/');
      const idMatch = page.text.match(/marker-skip-job[\s\S]*?data-job-id="([^"]+)"/);
      if (!idMatch) return;
      const jobId = idMatch[1];

      const line = crontab.formatCrontabJobLine({
        _id: jobId,
        schedule: '* * * * *',
        command: 'echo marker-skip',
        logging: 'false',
        mailing: {},
      });

      const before = await request(app).get('/');
      const countBefore = uniqueJobCount(before.text);

      crontab.processImportLine(line, Date.now(), 0);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      crontab.reload_db();

      const after = await request(app).get('/');
      expect(uniqueJobCount(after.text)).toBe(countBefore);
      expect((after.text.match(/marker-skip-job/g) || []).length).toBe(1);
    });

    it('should import external jobs without markers', async () => {
      const prefix = Date.now();
      crontab.processImportLine('0 2 * * * /usr/local/bin/external-backup.sh', prefix, 1);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      crontab.reload_db();

      const res = await request(app).get('/');
      expect(res.text).toContain('/usr/local/bin/external-backup.sh');
    });

    it('should recover marked jobs missing from the database', async () => {
      const line = crontab.formatCrontabJobLine({
        _id: 'recovered-marker-id',
        schedule: '15 3 * * *',
        command: 'echo recovered',
        logging: 'false',
        mailing: {},
      });

      crontab.processImportLine(line, Date.now(), 0);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      crontab.reload_db();

      const res = await request(app).get('/');
      expect(res.text).toContain('"_id":"recovered-marker-id"');
      expect(res.text).toContain('echo recovered');
      expect(res.text).not.toContain('recovered-marker-id.stdout');
    });
  });

  describe('Invalid schedule status', () => {
    it('should flag jobs with unparsable cron schedules', async () => {
      const Datastore = require('@seald-io/nedb');
      const db = new Datastore({ filename: path.join(testDbPath, 'crontab.db') });
      await new Promise((resolve, reject) => {
        db.loadDatabase((err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.insert({
          _id: 'invalid-schedule-job',
          name: 'invalid-schedule-job',
          command: 'echo bad',
          schedule: '* * * * * sa',
          stopped: false,
          saved: true,
          logging: 'false',
          mailing: {},
          created: Date.now(),
        }, (err) => (err ? reject(err) : resolve()));
      });

      const crontab = require('../crontab');
      crontab.reload_db();

      const res = await request(app).get('/');
      expect(res.text).toContain('invalid-schedule-job');
      expect(res.text).toContain('"next":"invalid"');
      expect(res.text).not.toContain('Failed run');
    });

    it('should not use stderr logs as a job list status', async () => {
      await request(app).post('/save').send({
        _id: -1,
        name: 'logged-job',
        command: 'echo logged',
        schedule: '* * * * *',
        logging: 'true',
        mailing: {},
      });
      const page = await request(app).get('/');
      const match = page.text.match(/logged-job[\s\S]*?data-job-id="([^"]+)"/);
      const jobId = match ? match[1] : null;
      if (!jobId) return;

      const logFile = path.join(testDbPath, 'logs', `${jobId}.log`);
      fs.writeFileSync(logFile, 'command failed\n');

      const res = await request(app).get('/');
      expect(res.text).not.toContain('"hasError"');
      expect(res.text).not.toContain('Failed run');
    });
  });
});

describe('Routes module', () => {
  it('should export routes with base_url prefix', () => {
    const { routes, base_url } = require('../routes');
    expect(routes.root).toBe(base_url + '/');
    expect(routes.save).toBe(base_url + '/save');
    expect(routes.backup).toBe(base_url + '/backup');
  });

  it('should export relative routes', () => {
    const { relative } = require('../routes');
    expect(relative.save).toBe('save');
    expect(relative.backup).toBe('backup');
    expect(relative.restore_data).toBe('restore_data');
  });
});
