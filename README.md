# Link-in-bio

A dependency-free link-in-bio page with local click tracking. The page is driven by [`links.json`](./links.json), so updating the profile or buttons requires no template editing.

## Run locally

```sh
cp .env.example .env
# edit .env and set a real STATS_PASSWORD
set -a; . ./.env; set +a
npm start
```

Open `http://localhost:3000`. Clicks are appended as newline-delimited JSON to `clicks.log` (created on the first click). The stats dashboard is at `/stats` and uses HTTP Basic Auth from `STATS_USER` and `STATS_PASSWORD`.

## Customize

Edit `links.json`:

```json
{ "slug": "github", "title": "See my code", "url": "https://github.com/you", "emoji": "⌘" }
```

`slug` must be unique. Use `avatarImage` for a local image path such as `/avatar.jpg`, or leave it blank to use the initials in `avatar`.

`public/og.svg` is the generated share image referenced by the OG and Twitter tags. Replace it with a 1200×630 PNG if your sharing target does not accept SVG, then update both image tags in `public/index.html`.

## Deploy on a plain VPS

1. Install Node 18+ and Caddy (or nginx), copy the project to `/opt/link-in-bio`, and create a production `.env` with a strong password.
2. Keep `clicks.log` on persistent storage and back it up. It contains IP addresses and referrers; set a retention policy appropriate for your privacy needs.
3. Run the app under a process manager such as systemd:

```ini
# /etc/systemd/system/link-in-bio.service
[Unit]
After=network.target
[Service]
WorkingDirectory=/opt/link-in-bio
EnvironmentFile=/opt/link-in-bio/.env
ExecStart=/usr/bin/node /opt/link-in-bio/server.js
Restart=always
User=linkbio
[Install]
WantedBy=multi-user.target
```

For Caddy:

```caddyfile
links.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

For nginx:

```nginx
server {
    server_name links.example.com;
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
}
```

Both examples preserve the forwarded IP used in the local log. Use HTTPS in production; Caddy provisions it automatically, while nginx should be paired with your preferred ACME client.
