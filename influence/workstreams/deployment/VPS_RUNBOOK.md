# VPS bring-up runbook

Authorized by decision-queue ballot `16b63d17` (yes, with note: a resident
agent — "hermes" — will live on the VPS and work through the same API).
Target: stable public URL serving in-browser votes, results tallying to
the operator's inbox. Friendly identity tier; Privy gate before real public.

## 0. Provision
- Any small VPS (1 vCPU / 1–2 GB, ~$5/mo), Ubuntu LTS. Point a DNS A record
  (e.g. `influence.<yourdomain>`) at it before starting — Caddy needs it.

## 1. System
```bash
adduser influence && usermod -aG sudo influence   # no root operation
apt update && apt install -y git caddy
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
```

## 2. App
```bash
su - influence
git clone https://github.com/drnicka/Influence.git app && cd app
npm run install:all && npm run build
cp .env.example .env   # set VOICE_PUBLIC_BASE_URL=https://influence.<yourdomain>
                       # set VOICE_CORS_ORIGIN=https://influence.<yourdomain>
```

## 3. Service (systemd, not `influence serve` — survives reboots properly)
`/etc/systemd/system/influence.service`:
```ini
[Unit]
Description=Influence (semantic ballot voting)
After=network.target

[Service]
User=influence
WorkingDirectory=/home/influence/app
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=VOICE_PORT=3001

[Install]
WantedBy=multi-user.target
```
`systemctl enable --now influence`

## 4. TLS (Caddy — automatic certificates)
`/etc/caddy/Caddyfile`:
```
influence.<yourdomain> {
    reverse_proxy localhost:3001
}
```
`systemctl reload caddy`. Done: share links and QR codes now mint against
the public base URL.

## 5. First members
Register yourself FIRST (empty members dir = auth wide open):
`curl -X POST https://influence.<yourdomain>/api/members -d '{"handle":"<you>"}' ...`
Then one member per agent, including the resident agent.

## 6. Resident agent ("hermes")
The VPS agent is just another member with a key — it runs where the data
is: watching ballots (poll loop per ORIENTATION), closing/tallying public
votes, executing voted actions server-side-adjacent (still agent-side: the
server stays inert). Give it the repo checkout, `influence/ORIENTATION.md`,
and a member key; schedule it (cron or its own runtime). Public votes
close → hermes tallies → results in your inbox even when your laptop is off.

## 7. Care
- Backup: `tar czf backup-$(date +%F).tgz data/` (cron weekly, scp off-box).
- Update: `git pull && npm run install:all && npm run build && systemctl restart influence`.
- Rate limits ship on (30/min anonymous voting). Watch `journalctl -u influence`.

## Known gaps at this tier
Fingerprint dedupe only (name+IP+UA) — friendly rooms, not adversaries.
Flat-file store: single instance only, don't load-balance. Privy before
anything with stakes.
