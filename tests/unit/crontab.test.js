'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const { createCrontabHarness } = require('../helpers/test-harness');

describe('crontab module (unit)', () => {
  let harness;
  let crontab;

  beforeAll(() => {
    harness = createCrontabHarness();
    crontab = harness.crontab;
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('validateSchedule', () => {
    it('rejects empty schedule', () => {
      expect(crontab.validateSchedule('')).toBe('Cron expression is required.');
      expect(crontab.validateSchedule('   ')).toBe('Cron expression is required.');
    });

    it('rejects too few fields', () => {
      expect(crontab.validateSchedule('* * * *')).toContain('Cron needs 5 fields');
    });

    it('rejects too many fields', () => {
      expect(crontab.validateSchedule('* * * * * sa')).toContain('Too many fields');
    });

    it('accepts valid 5-field cron', () => {
      expect(crontab.validateSchedule('* * * * *')).toBeNull();
      expect(crontab.validateSchedule('0 2 * * *')).toBeNull();
    });

    it('accepts known macros', () => {
      expect(crontab.validateSchedule('@daily')).toBeNull();
      expect(crontab.validateSchedule('@reboot')).toBeNull();
      expect(crontab.validateSchedule('@hourly')).toBeNull();
    });

    it('rejects unknown macros', () => {
      expect(crontab.validateSchedule('@notreal')).toContain('Unknown schedule macro');
    });
  });

  describe('parseCrontabLine', () => {
    it('extracts marker and schedule', () => {
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

    it('returns empty fields for comment lines', () => {
      const parsed = crontab.parseCrontabLine('# this is a comment');
      expect(parsed.schedule).toBe('');
      expect(parsed.command).toBe('');
      expect(parsed.markerId).toBeNull();
    });

    it('parses external crontab lines without markers', () => {
      const parsed = crontab.parseCrontabLine('0 2 * * * /usr/local/bin/backup.sh');
      expect(parsed.markerId).toBeNull();
      expect(parsed.schedule).toBe('0 2 * * *');
      expect(parsed.command).toBe('/usr/local/bin/backup.sh');
    });
  });

  describe('unwrapCronGuiCommand', () => {
    it('extracts the inner shell command', () => {
      const wrapped = '(({ echo "test2"; } | tee /tmp/x.stdout) 3>&1 1>&2 2>&3 | tee /tmp/x.stderr) 3>&1 1>&2 2>&3';
      expect(crontab.unwrapCronGuiCommand(wrapped)).toBe('echo "test2"');
    });

    it('returns null for non-wrapped commands', () => {
      expect(crontab.unwrapCronGuiCommand('echo plain')).toBeNull();
    });
  });
});
