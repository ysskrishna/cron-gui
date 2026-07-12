'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const { createTestHarness } = require('../helpers/test-harness');

describe('GET / (pages)', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should return the main page', async () => {
    const res = await harness.agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Cron GUI');
    expect(res.text).toContain('New job');
  });

  it('should render a textarea for the command field', async () => {
    const res = await harness.agent.get('/');
    expect(res.text).toContain('<textarea');
    expect(res.text).toContain('data-testid="job-command"');
  });

  it('should render deploy cluster in toolbar', async () => {
    const res = await harness.agent.get('/');
    expect(res.text).toContain('data-testid="deploy-cluster"');
    expect(res.text).toContain('data-testid="unsaved-indicator"');
    expect(res.text).toContain('data-testid="preview-deploy-btn"');
    expect(res.text).toContain('pendingDeleteJobs');
    expect(res.text).toContain('system_crontab');
  });
});
