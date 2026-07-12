'use strict';

/* global describe, it, expect, beforeAll, afterAll, vi */
const path = require('path');
const fs = require('fs');
const { createTestHarness } = require('../helpers/test-harness');

describe('Backup, export, import, restore', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('GET /backup', () => {
    it('should create a backup', async () => {
      await harness.createJob({ name: 'backup-seed' });
      const res = await harness.agent.get('/backup');
      expect(res.status).toBe(200);
      expect(harness.backupFiles().length).toBeGreaterThan(0);
    });
  });

  describe('GET /export', () => {
    it('should export the database', async () => {
      const res = await harness.agent.get('/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('crontab.db');
    });
  });

  describe('GET /backups_list', () => {
    it('should return backup names as JSON', async () => {
      const res = await harness.agent.get('/backups_list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /restore_data', () => {
    it('should return backup jobs as JSON', async () => {
      const backups = harness.backupFiles();
      expect(backups.length).toBeGreaterThan(0);

      const res = await harness.agent.get(`/restore_data?db=${encodeURIComponent(backups[0])}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /restore_backup and /delete', () => {
    it('should restore a backup into the live database', async () => {
      await harness.createJob({ name: 'pre-restore-job', command: 'echo pre-restore' });
      await harness.agent.get('/backup');
      await new Promise((r) => setTimeout(r, 50));

      await harness.createJob({ name: 'post-backup-job', command: 'echo post-backup' });
      const backups = harness.backupFiles();
      expect(backups.length).toBeGreaterThan(0);

      const res = await harness.agent.get(`/restore_backup?db=${encodeURIComponent(backups[0])}`);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 100));
      harness.crontab.reload_db();
      const html = await harness.pageHtml();
      expect(html).toContain('pre-restore-job');
      expect(html).not.toContain('post-backup-job');
    });

    it('should delete a single backup file', async () => {
      await harness.agent.get('/backup');
      await new Promise((r) => setTimeout(r, 50));
      const backups = harness.backupFiles();
      expect(backups.length).toBeGreaterThan(0);

      const target = backups[0];
      const res = await harness.agent.get(`/delete?db=${encodeURIComponent(target)}`);
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 100));
      expect(harness.backupFiles()).not.toContain(target);
    });
  });

  describe('POST /delete_backups', () => {
    it('should delete multiple backup files', async () => {
      const dbFile = path.join(harness.testDbPath, 'crontab.db');
      fs.copyFileSync(dbFile, path.join(harness.testDbPath, 'backup test-delete-a.db'));
      fs.copyFileSync(dbFile, path.join(harness.testDbPath, 'backup test-delete-b.db'));

      const backups = harness.backupFiles();
      expect(backups.length).toBeGreaterThanOrEqual(2);

      const toDelete = backups.slice(0, 2);
      const res = await harness.agent.post('/delete_backups').send({ dbs: toDelete });
      expect(res.status).toBe(200);

      await new Promise((r) => setTimeout(r, 100));
      const remaining = harness.backupFiles();
      toDelete.forEach((name) => {
        expect(remaining).not.toContain(name);
      });
    });

    it('should ignore non-backup filenames', async () => {
      const before = harness.backupFiles().length;
      await harness.agent.post('/delete_backups').send({ dbs: ['crontab.db', '../../etc/passwd'] });
      expect(harness.backupFiles().length).toBe(before);
      expect(fs.existsSync(path.join(harness.testDbPath, 'crontab.db'))).toBe(true);
    });
  });

  describe('GET /import_crontab (auto-backup)', () => {
    it('should create a backup before importing', async () => {
      await harness.createJob({ name: 'import-backup-test', command: 'echo import' });
      await new Promise((r) => setTimeout(r, 1100));

      const backupsBefore = harness.backupFiles().length;
      await harness.agent.get('/import_crontab');
      const backupsAfter = harness.backupFiles().length;
      expect(backupsAfter).toBe(backupsBefore + 1);
    });

    it('should surface crontab -l failures to the client', async () => {
      const childProcess = require('child_process');
      const spy = vi.spyOn(childProcess, 'exec').mockImplementation((cmd, cb) => {
        cb(Object.assign(new Error('no crontab for user'), { code: 1 }), '');
      });

      const res = await harness.agent.get('/import_crontab');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No crontab for this user');
      spy.mockRestore();
    });
  });

  describe('POST /import (auto-backup)', () => {
    it('should create a backup before importing a db file', async () => {
      await new Promise((r) => setTimeout(r, 1100));
      const backupsBefore = harness.backupFiles().length;
      const dbContent = fs.readFileSync(path.join(harness.testDbPath, 'crontab.db'));

      await harness.agent
        .post('/import')
        .attach('file', dbContent, 'crontab.db');

      expect(harness.backupFiles().length).toBe(backupsBefore + 1);
    });
  });
});
