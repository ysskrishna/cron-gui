'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const { createTestHarness } = require('../helpers/test-harness');

describe('Job CRUD', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('POST /save', () => {
    it('should create a new job', async () => {
      const job = await harness.createJob({ name: 'test-job' });
      expect(job.name).toBe('test-job');
    });

    it('should reject an invalid cron schedule', async () => {
      const res = await harness.agent.post('/save').send({
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

    it('should reject empty schedule', async () => {
      const res = await harness.agent.post('/save').send({
        _id: -1,
        name: 'empty-schedule',
        command: 'echo hello',
        schedule: '',
        logging: 'false',
        mailing: {},
      });
      expect(res.status).toBe(400);
      expect(res.text).toContain('Cron expression is required');
    });

    it('should show the new job on the main page', async () => {
      const jobs = await harness.listJobs();
      expect(jobs.some((job) => job.name === 'test-job')).toBe(true);
      const html = await harness.pageHtml();
      expect(html).toContain('"name":"test-job"');
    });

    it('should update an existing job', async () => {
      const job = await harness.waitForJob('test-job');

      await harness.agent.post('/save').send({
        _id: job._id,
        name: 'renamed-job',
        command: 'echo updated',
        schedule: '0 3 * * *',
        logging: 'false',
        mailing: {},
      });

      const updated = await harness.waitForJob('renamed-job');
      expect(updated.command).toBe('echo updated');
      expect(updated.schedule).toBe('0 3 * * *');
    });

    it('should duplicate an existing job', async () => {
      await harness.createJob({
        name: 'renamed-job (copy)',
        command: 'echo updated',
        schedule: '0 3 * * *',
      });

      const jobs = await harness.listJobs();
      expect(jobs.filter((job) => job.name === 'renamed-job (copy)')).toHaveLength(1);
    });
  });

  describe('POST /stop and /start', () => {
    let job;

    beforeAll(async () => {
      job = await harness.createJob({
        name: 'stop-start-job',
        command: 'echo stop-start',
      });
    });

    it('should stop a job', async () => {
      const res = await harness.agent.post('/stop').send({ _id: job._id });
      expect(res.status).toBe(200);
    });

    it('should start a job', async () => {
      const res = await harness.agent.post('/start').send({ _id: job._id });
      expect(res.status).toBe(200);
    });

    it('should preserve stopped state when editing a job', async () => {
      await harness.agent.post('/stop').send({ _id: job._id });
      await harness.agent.post('/save').send({
        _id: job._id,
        name: 'stop-start-job-edited',
        command: 'echo edited-while-stopped',
        schedule: '* * * * *',
        logging: 'false',
        mailing: {},
      });

      const edited = await harness.waitForJob('stop-start-job-edited');
      expect(edited.stopped).toBe(true);
    });
  });

  describe('POST /runjob', () => {
    it('should accept a run request for an existing job', async () => {
      const jobs = await harness.listJobs();
      expect(jobs.length).toBeGreaterThan(0);

      const res = await harness.agent.post('/runjob').send({ _id: jobs[0]._id });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /remove', () => {
    it('should remove a job', async () => {
      const job = await harness.createJob({ name: 'remove-me', command: 'echo remove' });

      const res = await harness.agent.post('/remove').send({ _id: job._id });
      expect(res.status).toBe(200);

      const jobs = await harness.listJobs();
      expect(jobs.some((entry) => entry._id === job._id)).toBe(false);
    });
  });
});
