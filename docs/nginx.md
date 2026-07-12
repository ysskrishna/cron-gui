# Nginx Integration

Install [nginx](http://nginx.org/) on your server, then configure it to proxy requests to `cron-gui` on port `8000`.

```bash
sudo vi /etc/nginx/sites-available/default
```

Use a config like this:

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://localhost:8000;
    }
}
```

## Authentication

To enable app-level HTTP basic auth, set:

```bash
BASIC_AUTH_USER=user BASIC_AUTH_PWD=SecretPassword
```

You can also configure authentication at the nginx layer to block unauthorized access before requests reach the app. See [this guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-http-authentication-with-nginx-on-ubuntu-12-10).
