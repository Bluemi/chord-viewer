# Deploying behind Apache

Chord Viewer runs as a small Node.js server, built with SvelteKit's `adapter-node`. Apache sits in front of it as a reverse proxy and handles HTTPS. The steps below assume a Debian/Ubuntu-style server. Other distros only differ in package names and paths.

```
Browser ──HTTPS──▶ Apache (:443) ──HTTP──▶ node build (127.0.0.1:3000)
                                              ├─ config.json
                                              └─ data/ (SQLite DB + audio files)
```

> The app must be served from the **root of a (sub)domain**, e.g. `https://songs.example.com/`.
> It can't be served under a sub-path like `https://example.com/songs/`.

## 1. Requirements

- Node.js ≥ 22 (development used Node 26) and pnpm (`corepack enable` or `npm i -g pnpm`).
- Build tools for the native SQLite module, in case no prebuilt binary is available: `apt install build-essential python3`.
- Apache 2.4 with `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_ssl`.
- A DNS name pointing to the server and a TLS certificate (e.g. via certbot).

## 2. Create a service user and install the app

```sh
sudo useradd --system --create-home --home-dir /opt/chord-viewer --shell /usr/sbin/nologin chordviewer
sudo -u chordviewer -s /bin/bash
cd /opt/chord-viewer
git clone <your-repo-url> app
cd app
pnpm install
pnpm build
pnpm prune --prod          # optional: drop dev dependencies after building
```

`build/` contains the server. It still needs `node_modules/` at runtime, mainly for `better-sqlite3`, so keep that directory.

## 3. Configure

```sh
cp config.example.json config.json
chmod 600 config.json
```

Edit `config.json`:

```json
{
	"password": "a long random passphrase",
	"title": "Chord Viewer",
	"statuses": ["Idea", "In progress", "Practicing", "Done"],
	"dataDir": "/opt/chord-viewer/data"
}
```

`dataDir` is created on first start. It holds the SQLite database and all uploaded audio, so it's the only thing you need to back up besides `config.json`.

## 4. systemd service

`/etc/systemd/system/chord-viewer.service`:

```ini
[Unit]
Description=Chord Viewer
After=network.target

[Service]
Type=simple
User=chordviewer
WorkingDirectory=/opt/chord-viewer/app
ExecStart=/usr/bin/node build
Restart=on-failure

Environment=NODE_ENV=production
# Only listen locally; Apache is the public entry point.
Environment=HOST=127.0.0.1
Environment=PORT=3000
# Public URL of the site. Required for SvelteKit's CSRF check (audio upload) and secure cookies.
Environment=ORIGIN=https://songs.example.com
# Max request body size (audio uploads). Keep in sync with Apache's LimitRequestBody.
Environment=BODY_SIZE_LIMIT=500M
# Optional: config file location (defaults to ./config.json in WorkingDirectory)
Environment=CHORD_VIEWER_CONFIG=/opt/chord-viewer/app/config.json

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/chord-viewer/data

[Install]
WantedBy=multi-user.target
```

Adjust `/usr/bin/node` if Node is installed elsewhere (`which node`). Then:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now chord-viewer
sudo systemctl status chord-viewer
curl -I http://127.0.0.1:3000/login     # should return 200
```

## 5. Apache virtual host

Enable the modules:

```sh
sudo a2enmod proxy proxy_http headers ssl
```

`/etc/apache2/sites-available/chord-viewer.conf`:

```apache
<VirtualHost *:80>
    ServerName songs.example.com
    Redirect permanent / https://songs.example.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName songs.example.com

    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/songs.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/songs.example.com/privkey.pem

    # Audio uploads: allow up to 500 MB and give slow uploads time to finish.
    LimitRequestBody 524288000
    ProxyTimeout 600

    ProxyPreserveHost On
    ProxyRequests Off
    RequestHeader set X-Forwarded-Proto "https"

    ProxyPass        / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    Header always set Strict-Transport-Security "max-age=31536000"
    Header always set X-Content-Type-Options "nosniff"

    ErrorLog  ${APACHE_LOG_DIR}/chord-viewer-error.log
    CustomLog ${APACHE_LOG_DIR}/chord-viewer-access.log combined
</VirtualHost>
```

Activate it:

```sh
sudo a2ensite chord-viewer
sudo apachectl configtest
sudo systemctl reload apache2
```

Getting a certificate with certbot: `sudo certbot --apache -d songs.example.com`. If certbot edits the vhost for you, keep the proxy lines above in the `:443` block.

## 6. Updating

```sh
sudo -u chordviewer -s /bin/bash -c 'cd /opt/chord-viewer/app && git pull && pnpm install && pnpm build'
sudo systemctl restart chord-viewer
```

The database schema is created and updated automatically on start. Changes to `config.json`, such as a new password or title, also need a restart.

## Troubleshooting

| Symptom                                                              | Cause / fix                                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `403 Cross-site POST form submissions are forbidden` on audio upload | `ORIGIN` doesn't match the URL in the browser (scheme + host, no trailing slash).                                                                          |
| `413 Payload Too Large` on upload                                    | Raise both `BODY_SIZE_LIMIT` (service) and `LimitRequestBody` (Apache).                                                                                    |
| Upload of large files aborts after a while                           | Increase `ProxyTimeout`.                                                                                                                                   |
| `502 Bad Gateway`                                                    | Node service isn't running. Check `journalctl -u chord-viewer -e`. Common causes are a missing `config.json` or `dataDir` not writable (`ReadWritePaths`). |
| Logged out after every request                                       | Site opened via plain HTTP while `ORIGIN` is `https://…`, so the browser drops the secure cookie. Always use the HTTPS URL.                                |
| Offline download buttons missing                                     | Browsers only allow offline storage (service workers, Cache Storage) on HTTPS. Open the site via its `https://` URL.                                       |
| `better-sqlite3` fails to load after a Node upgrade                  | Rebuild the native module: `pnpm rebuild better-sqlite3`.                                                                                                  |
