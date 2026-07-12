'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const { createTestHarness } = require('../helpers/test-harness');

describe('Deploy and preview', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('GET /preview_crontab', () => {
    let job;

    beforeAll(async () => {
      job = await harness.createJob({ name: 'preview-job', command: 'echo preview' });
    });

    it('should return the crontab preview as plain text', async () => {
      const res = await harness.agent.get('/preview_crontab');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('echo preview');
    });

    it('should include the make_command wrapper (tee pipeline)', async () => {
      const res = await harness.agent.get('/preview_crontab');
      expect(res.text).toContain('tee');
      expect(res.text).toContain('stderr');
    });

    it('should include deploy markers in preview output', async () => {
      const res = await harness.agent.get('/preview_crontab');
      expect(res.text).toContain('# cron-gui:id=');
    });

    it('should only include active (non-stopped) jobs', async () => {
      await harness.agent.post('/stop').send({ _id: job._id });
      const stopped = await harness.agent.get('/preview_crontab');
      expect(stopped.text).not.toContain('echo preview');

      await harness.agent.post('/start').send({ _id: job._id });
      const active = await harness.agent.get('/preview_crontab');
      expect(active.text).toContain('echo preview');
    });

    it('should use env_vars query param when provided', async () => {
      const res = await harness.agent.get('/preview_crontab?env_vars=MAILTO=preview%40test.com');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^MAILTO=preview@test.com/);
    });
  });

  describe('GET /system_crontab', () => {
    it('should return plain text system crontab', async () => {
      const res = await harness.agent.get('/system_crontab');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('Pending deploy after delete', () => {
    it('should flag pending deploy when deleting a deployed job', async () => {
      const job = await harness.createJob({
        name: 'deployed-delete-test',
        command: 'echo deployed-delete',
      });

      await harness.deploy();

      await harness.agent.post('/remove').send({ _id: job._id });
      await new Promise((resolve) => { setTimeout(resolve, 150); });

      const pending = await harness.listPendingDeletes();
      expect(pending.some((entry) => entry._id === job._id)).toBe(true);

      const html = await harness.pageHtml();
      expect(harness.pagePendingDeleteCount(html)).toBe(1);
      expect(html).toContain('deployed-delete-test');
    });

    it('should not flag pending deploy when deleting an unsaved job', async () => {
      const job = await harness.createJob({
        name: 'unsaved-delete-test',
        command: 'echo unsaved-delete',
      });

      await harness.agent.post('/remove').send({ _id: job._id });
      await new Promise((resolve) => { setTimeout(resolve, 150); });

      const jobs = await harness.listJobs();
      expect(jobs.some((entry) => entry._id === job._id)).toBe(false);

      const pending = await harness.listPendingDeletes();
      expect(pending.some((entry) => entry._id === job._id)).toBe(false);
    });
  });

  describe('POST /undelete', () => {
    it('should restore a staged delete before deploy', async () => {
      const job = await harness.createJob({
        name: 'undelete-test',
        command: 'echo undelete',
      });

      await harness.deploy();

      await harness.agent.post('/remove').send({ _id: job._id });
      await new Promise((resolve) => { setTimeout(resolve, 150); });

      let pending = await harness.listPendingDeletes();
      expect(pending.some((entry) => entry._id === job._id)).toBe(true);

      await harness.agent.post('/undelete').send({ _id: job._id });
      await new Promise((resolve) => { setTimeout(resolve, 150); });

      const jobs = await harness.listJobs();
      expect(jobs.some((entry) => entry.name === 'undelete-test')).toBe(true);
      pending = await harness.listPendingDeletes();
      expect(pending.some((entry) => entry._id === job._id)).toBe(false);
    });
  });

  describe('crontab deploy markers', () => {
    it('should skip import for marked jobs already in the database', async () => {
      const job = await harness.createJob({
        name: 'marker-skip-job',
        command: 'echo marker-skip',
      });

      const line = harness.crontab.formatCrontabJobLine({
        _id: job._id,
        schedule: '* * * * *',
        command: 'echo marker-skip',
        logging: 'false',
        mailing: {},
      });

      const countBefore = (await harness.listJobs()).length;
      harness.crontab.processImportLine(line, Date.now(), 0);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      harness.crontab.reload_db();

      const jobs = await harness.listJobs();
      expect(jobs.length).toBe(countBefore);
      expect(jobs.filter((entry) => entry.name === 'marker-skip-job')).toHaveLength(1);
    });

    it('should import external jobs without markers', async () => {
      const prefix = Date.now();
      harness.crontab.processImportLine('0 2 * * * /usr/local/bin/external-backup.sh', prefix, 1);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      harness.crontab.reload_db();

      const jobs = await harness.listJobs();
      expect(jobs.some((entry) => entry.command === '/usr/local/bin/external-backup.sh')).toBe(true);
    });

    it('should recover marked jobs missing from the database', async () => {
      const line = harness.crontab.formatCrontabJobLine({
        _id: 'recovered-marker-id',
        schedule: '15 3 * * *',
        command: 'echo recovered',
        logging: 'false',
        mailing: {},
      });

      harness.crontab.processImportLine(line, Date.now(), 0);
      await new Promise((resolve) => { setTimeout(resolve, 150); });
      harness.crontab.reload_db();

      const jobs = await harness.listJobs();
      const recovered = jobs.find((entry) => entry._id === 'recovered-marker-id');
      expect(recovered).toBeTruthy();
      expect(recovered.command).toBe('echo recovered');
    });
  });
});
