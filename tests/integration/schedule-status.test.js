'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const path = require('path');
const fs = require('fs');
const { createTestHarness } = require('../helpers/test-harness');

describe('Invalid schedule status', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should flag jobs with unparsable cron schedules', async () => {
    await harness.seedJobDoc({
      _id: 'invalid-schedule-job',
      name: 'invalid-schedule-job',
      command: 'echo bad',
      schedule: '* * * * * sa',
      stopped: false,
      saved: true,
      logging: 'false',
      mailing: {},
      created: Date.now(),
    });

    const jobs = await harness.listJobs();
    const invalid = jobs.find((job) => job.name === 'invalid-schedule-job');
    expect(invalid).toBeTruthy();
    expect(invalid.next).toBe('invalid');

    const html = await harness.pageHtml();
    expect(html).not.toContain('Failed run');
  });

  it('should show Next Reboot for @reboot schedules', async () => {
    const job = await harness.createJob({
      name: 'reboot-job',
      command: 'echo reboot',
      schedule: '@reboot',
    });
    expect(job.next).toBe('Next Reboot');
  });

  it('should not use stderr logs as a job list status', async () => {
    const job = await harness.createJob({
      name: 'logged-job',
      command: 'echo logged',
      logging: 'true',
    });

    const logFile = path.join(harness.testDbPath, 'logs', `${job._id}.log`);
    fs.writeFileSync(logFile, 'command failed\n');

    const html = await harness.pageHtml();
    expect(html).not.toContain('"hasError"');
    expect(html).not.toContain('Failed run');
  });
});
