# Issues

Report bugs or feature requests in the [issue tracker](https://github.com/ysskrishna/cron-gui/issues).

## Common Issues

**cron-gui is running but not accessible in browser**
This usually means the installation location is not accessible to your user/network. Fix permissions (recommended), or run with elevated privileges if required.

**It works on localhost but not from outside the server**
Use a reverse proxy like nginx or Apache. See [nginx integration](./nginx.md).

**cron-gui stopped working**
This can happen after invalid job data or malformed schedules. Try:

```bash
cron-gui --reset
```

**Where is the global `node_modules` path?**
Run:

```bash
npm root -g
```

**Long commands are silently truncated**
Crontab lines have a hard length limit (~1000 chars). Logging/mailing wrappers add overhead, leaving less room for your command. Put long commands in a script file and invoke the script from cron.
