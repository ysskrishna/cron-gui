'use strict';

const Datastore = require('@seald-io/nedb');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { CronExpressionParser } = require('cron-parser');
const cronstrue = require('cronstrue/i18n');

const humanCronLocale = process.env.HUMANCRON ?? 'en';

const dbFolder = process.env.CRON_DB_PATH || path.join(__dirname, 'crontabs');
console.log(`Cron db path: ${dbFolder}`);

const logFolder = path.join(dbFolder, 'logs');
const envFile = path.join(dbFolder, 'env.db');
const crontabDbFile = path.join(dbFolder, 'crontab.db');

const db = new Datastore({ filename: crontabDbFile, autocompactionInterval: 60000 });

let cronPath = '/tmp';
if (process.env.CRON_PATH !== undefined) {
  console.log(`Path to crond files set using env variables ${process.env.CRON_PATH}`);
  cronPath = process.env.CRON_PATH;
}

db.loadDatabase((err) => {
  if (err) throw err;
});

if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder, { recursive: true });
}

function buildCrontab(name, command, schedule, stopped, logging, mailing) {
  return {
    name,
    command,
    schedule,
    ...(stopped !== null && { stopped }),
    timestamp: new Date().toString(),
    logging,
    mailing: mailing || {},
  };
}

const CRON_MACROS = new Set([
  '@reboot', '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly', '@midnight',
]);

exports.validateSchedule = (schedule) => {
  const trimmed = String(schedule || '').trim();
  if (!trimmed) return 'Cron expression is required.';

  if (trimmed.startsWith('@')) {
    if (CRON_MACROS.has(trimmed.toLowerCase())) return null;
    return `Unknown schedule macro "${trimmed}".`;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    if (parts.length > 5) {
      return 'Too many fields. Cron uses 5 fields only — put your command in the Command field.';
    }
    return 'Cron needs 5 fields: minute hour day month weekday.';
  }

  try {
    CronExpressionParser.parse(trimmed);
    return null;
  } catch (e) {
    return (e.message || 'Invalid cron expression.').replace(/^Error: /, '');
  }
};

function makeCommand(tab) {
  const stderr = path.join(cronPath, `${tab._id}.stderr`);
  const stdout = path.join(cronPath, `${tab._id}.stdout`);
  const logFile = path.join(logFolder, `${tab._id}.log`);
  const logFileStdout = path.join(logFolder, `${tab._id}.stdout.log`);

  let cmd = tab.command;
  if (cmd[cmd.length - 1] !== ';') {
    cmd += ';';
  }

  let result = `({ ${cmd} } | tee ${stdout})`;
  result = `(${result} 3>&1 1>&2 2>&3 | tee ${stderr}) 3>&1 1>&2 2>&3`;
  result = `(${result})`;

  if (tab.logging && tab.logging === 'true') {
    result += `; if test -s ${stderr}; then date >> "${logFile}"; cat ${stderr} >> "${logFile}"; fi`;
    result += `; if test -s ${stdout}; then date >> "${logFileStdout}"; cat ${stdout} >> "${logFileStdout}"; fi`;
  }

  if (tab.mailing && JSON.stringify(tab.mailing) !== '{}') {
    const nodeBin = process.env.NODE_BIN || process.execPath;
    const mailerScript = path.join(__dirname, 'bin', 'cron-gui-mailer.js');
    result += `; ${nodeBin} ${mailerScript} ${tab._id} ${stdout} ${stderr}`;
  }

  return result;
}

function addEnvVars(envVars, command) {
  if (envVars) {
    return `(${envVars.replace(/\s*\n\s*/g, ' ').trim()}; (${command}))`;
  }
  return command;
}

const DEPLOY_MARKER_RE = /#\s*cron-gui:id=([^\s#]+)/;

function deployMarker(jobId) {
  return `# cron-gui:id=${jobId}`;
}

function parseCrontabLine(line) {
  let markerId = null;
  const markerMatch = line.match(DEPLOY_MARKER_RE);
  if (markerMatch) {
    markerId = markerMatch[1];
    line = line.replace(DEPLOY_MARKER_RE, '').trim();
  }

  line = line.replace(/\t+/g, ' ');
  if (!line || line.startsWith('#')) {
    return { schedule: '', command: '', markerId };
  }

  const regex = /^((@[a-zA-Z]+\s+)|(([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+))/;
  const command = line.replace(regex, '').trim();
  const schedule = line.replace(command, '').trim();
  return { schedule, command, markerId };
}

function unwrapCronGuiCommand(command) {
  const match = command.match(/^\(+{\s*([\s\S]+?)\s*;\s*}\s*\|\s*tee\s+/);
  return match ? match[1].trim() : null;
}

function formatCrontabJobLine(tab) {
  return `${tab.schedule} ${makeCommand(tab)} ${deployMarker(tab._id)}`;
}

function isValidSchedule(schedule) {
  try {
    return CronExpressionParser.parse(schedule) !== null;
  } catch (_e) {
    return false;
  }
}

function importMarkedJob(markerId, schedule, wrappedCommand) {
  db.findOne({ _id: markerId }, (err, doc) => {
    if (err || doc) return;
    const bareCommand = unwrapCronGuiCommand(wrappedCommand) || wrappedCommand;
    const tab = buildCrontab(markerId, bareCommand, schedule, false, 'false', {});
    tab._id = markerId;
    tab.created = Date.now();
    tab.saved = false;
    tab.everDeployed = true;
    db.insert(tab);
  });
}

function importExternalJob(name, command, schedule) {
  db.findOne({ command, schedule }, (err, doc) => {
    if (err) throw err;
    if (!doc) {
      exports.create_new(name, command, schedule, 'false');
      return;
    }
    doc.command = command;
    doc.schedule = schedule;
    exports.update(doc);
  });
}

function processImportLine(line, namePrefix, index) {
  const { schedule, command, markerId } = parseCrontabLine(line);
  if (!command || !schedule || !isValidSchedule(schedule)) return;

  if (markerId) {
    importMarkedJob(markerId, schedule, command);
    return;
  }

  importExternalJob(`${namePrefix}_${index}`, command, schedule);
}

exports.db_folder = dbFolder;
exports.log_folder = logFolder;
exports.env_file = envFile;
exports.crontab_db_file = crontabDbFile;

exports.create_new = (name, command, schedule, logging, mailing) => {
  const tab = buildCrontab(name, command, schedule, false, logging, mailing);
  tab.created = Date.now();
  tab.saved = false;
  db.insert(tab);
};

exports.update = (data) => {
  const tab = buildCrontab(data.name, data.command, data.schedule, null, data.logging, data.mailing);
  tab.saved = false;
  db.update({ _id: data._id }, { $set: tab });
};

exports.status = (_id, stopped) => {
  db.update({ _id }, { $set: { stopped, saved: false } });
};

function wasDeployedToCrontab(doc) {
  return !!(doc.everDeployed || doc.saved) && !doc.stopped;
}

exports.remove = (_id) => {
  db.findOne({ _id }, (err, doc) => {
    if (err || !doc) return;
    if (wasDeployedToCrontab(doc)) {
      db.update({ _id }, { $set: { deleted: true, saved: false } }, {});
      return;
    }
    db.remove({ _id }, {});
  });
};

function enrichDocSchedule(doc) {
  if (doc.schedule === '@reboot') {
    doc.next = 'Next Reboot';
  } else {
    try {
      doc.human = cronstrue.toString(doc.schedule, { locale: humanCronLocale });
      doc.next = CronExpressionParser.parse(doc.schedule).next().toString();
    } catch (e) {
      console.error(e);
      doc.next = 'invalid';
    }
  }
  return doc;
}

exports.pendingDeletes = (callback) => {
  db.count({ deleted: true }, (err, count) => {
    if (err) {
      console.error(err);
      callback(0);
      return;
    }
    callback(count || 0);
  });
};

exports.pending_delete_jobs = (callback) => {
  db.find({ deleted: true }).sort({ created: -1 }).exec((err, docs) => {
    if (err) {
      console.error(err);
      return callback([]);
    }
    callback(docs.map(enrichDocSchedule));
  });
};

exports.undelete = (_id) => {
  db.findOne({ _id }, (err, doc) => {
    if (err || !doc || !doc.deleted) return;
    const saved = !!(doc.everDeployed || doc.saved);
    db.update({ _id }, { $unset: { deleted: '' }, $set: { saved } }, {});
  });
};

exports.crontabs = (callback) => {
  db.find({ deleted: { $ne: true } }).sort({ created: -1 }).exec((err, docs) => {
    if (err) {
      console.error(err);
      return callback([]);
    }
    callback(docs.map(enrichDocSchedule));
  });
};

exports.get_crontab = (_id, callback) => {
  db.find({ _id }).exec((err, docs) => {
    callback(docs[0]);
  });
};

exports.runjob = (_id) => {
  db.find({ _id }).exec((err, docs) => {
    if (err || !docs.length) return;
    const res = docs[0];
    const envVars = exports.get_env();
    let cmd = makeCommand(res);
    cmd = addEnvVars(envVars, cmd);

    console.log('Running job');
    console.log(`ID: ${_id}`);
    console.log(`Original command: ${res.command}`);
    console.log(`Executed command: ${cmd}`);

    exec(cmd, (error) => {
      if (error) console.log(error);
    });
  });
};

exports.set_crontab = (envVars, callback) => {
  exports.crontabs((tabs) => {
    let crontabString = '';
    if (envVars) {
      crontabString += `${envVars}\n`;
    }
    for (const tab of tabs) {
      if (!tab.stopped) {
        crontabString += `${formatCrontabJobLine(tab)}\n`;
      }
    }

    fs.writeFile(envFile, envVars, (err) => {
      if (err) {
        console.error(err);
        return callback(err);
      }
      const fileName = process.env.CRON_IN_DOCKER !== undefined ? 'root' : 'crontab';
      fs.writeFile(path.join(cronPath, fileName), crontabString, (err) => {
        if (err) {
          console.error(err);
          return callback(err);
        }
        exec(`crontab ${path.join(cronPath, fileName)}`, (err) => {
          if (err) {
            console.error(err);
            return callback(err);
          }
          db.remove({ deleted: true }, { multi: true }, () => {
            db.update({ deleted: { $ne: true } }, { $set: { saved: true, everDeployed: true } }, { multi: true });
            callback();
          });
        });
      });
    });
  });
};

exports.get_backup_names = () => {
  const backups = fs.readdirSync(dbFolder)
    .filter((file) => file.indexOf('backup') === 0);

  const backupDate = (name) => {
    const t = name.split('backup')[1];
    return new Date(t.substring(0, t.length - 3)).valueOf();
  };

  backups.sort((a, b) => backupDate(b) - backupDate(a));
  return backups;
};

exports.backup = (callback) => {
  const dest = path.join(dbFolder, `backup ${new Date().toString().replace('+', ' ')}.db`);
  fs.copyFile(crontabDbFile, dest, (err) => {
    if (err) {
      console.error(err);
      return callback(err);
    }
    callback();
  });
};

exports.restore = (dbName) => {
  fs.createReadStream(path.join(dbFolder, dbName))
    .pipe(fs.createWriteStream(crontabDbFile));
  db.loadDatabase();
};

exports.reload_db = () => {
  db.loadDatabase();
};

exports.get_env = () => {
  if (fs.existsSync(envFile)) {
    return fs.readFileSync(envFile, 'utf8').replace('\n', '\n');
  }
  return '';
};

exports.import_crontab = () => {
  exec('crontab -l', (error, stdout) => {
    if (error && !stdout) return;
    const lines = (stdout || '').split('\n');
    const namePrefix = Date.now();

    lines.forEach((line, index) => {
      processImportLine(line, namePrefix, index);
    });
  });
};

exports.preview_crontab = (envVars, callback) => {
  exports.crontabs((tabs) => {
    let crontabString = '';
    if (envVars) {
      crontabString += `${envVars}\n`;
    }
    for (const tab of tabs) {
      if (!tab.stopped) {
        crontabString += `${formatCrontabJobLine(tab)}\n`;
      }
    }
    callback(crontabString);
  });
};

exports.system_crontab = (callback) => {
  exec('crontab -l', (error, stdout) => {
    if (error && !stdout) {
      callback(error, '');
      return;
    }
    callback(null, stdout || '');
  });
};

exports.parseCrontabLine = parseCrontabLine;
exports.unwrapCronGuiCommand = unwrapCronGuiCommand;
exports.formatCrontabJobLine = formatCrontabJobLine;
exports.processImportLine = processImportLine;

exports.autosave_crontab = (callback) => {
  const envVars = exports.get_env();
  exports.set_crontab(envVars, callback);
};
