'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const path = require('path');
const fs = require('fs');
const { createTestHarness } = require('../helpers/test-harness');

describe('Logs', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('GET /logger', () => {
    it('should return no errors message when no log exists', async () => {
      const res = await harness.agent.get('/logger?id=nonexistent');
      expect(res.status).toBe(200);
      expect(res.text).toContain('No errors logged yet');
    });

    it('should return text/plain content type when no log exists', async () => {
      const res = await harness.agent.get('/logger?id=nonexistent');
      expect(res.headers['content-type']).toContain('text/plain');
    });

    it('should return text/plain and no-store when log file exists', async () => {
      const logFile = path.join(harness.testDbPath, 'logs', 'testlog.log');
      fs.writeFileSync(logFile, 'some error output\n');
      const res = await harness.agent.get('/logger?id=testlog');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('some error output');
      fs.unlinkSync(logFile);
    });
  });

  describe('GET /stdout', () => {
    it('should return no output message when no log exists', async () => {
      const res = await harness.agent.get('/stdout?id=nonexistent');
      expect(res.status).toBe(200);
      expect(res.text).toContain('No output logged yet');
    });

    it('should return text/plain content type when no log exists', async () => {
      const res = await harness.agent.get('/stdout?id=nonexistent');
      expect(res.headers['content-type']).toContain('text/plain');
    });

    it('should return text/plain and no-store when stdout log exists', async () => {
      const logFile = path.join(harness.testDbPath, 'logs', 'teststdout.stdout.log');
      fs.writeFileSync(logFile, 'some stdout output\n');
      const res = await harness.agent.get('/stdout?id=teststdout');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('some stdout output');
      fs.unlinkSync(logFile);
    });
  });
});
