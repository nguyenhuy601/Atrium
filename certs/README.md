# TLS certs for Traefik (local mkcert)

Do not commit PEMs. Generate:

```bash
# from repo root (requires mkcert installed + CA trusted)
mkcert -cert-file certs/cert.pem -key-file certs/key.pem \
  atrium.dev api.atrium.dev localhost 127.0.0.1
```

Hosts file:

```text
127.0.0.1 atrium.dev api.atrium.dev
```

Then deploy `edge-stack.yml` (mounts `./certs` → `/certs`).
