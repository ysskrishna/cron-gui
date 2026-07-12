'use strict';

const baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '').trim();

const routes = {
  root: '/',
  save: '/save',
  run: '/runjob',
  crontab: '/crontab',
  stop: '/stop',
  start: '/start',
  remove: '/remove',
  backup: '/backup',
  restore: '/restore',
  delete_backup: '/delete',
  restore_backup: '/restore_backup',
  export: '/export',
  import: '/import',
  import_crontab: '/import_crontab',
  logger: '/logger',
  stdout: '/stdout',
  preview_crontab: '/preview_crontab',
  system_crontab: '/system_crontab',
  restore_data: '/restore_data',
  backups_list: '/backups_list',
  undelete: '/undelete',
  delete_backups: '/delete_backups',
};

exports.base_url = baseUrl;

exports.routes = Object.fromEntries(
  Object.entries(routes).map(([k, v]) => [k, baseUrl + v])
);

exports.relative = Object.fromEntries(
  Object.entries(routes).map(([k, v]) => [k, v.replace(/^\//, '')])
);
exports.relative.root = baseUrl;
