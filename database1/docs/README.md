# Infrastructure Documentation - Secure File Sharing Platform

Owned by Abhijith (Database, Storage & DevOps).

| Doc                     | Covers |
|-------------------------|--------|
| [DATABASE.md](DATABASE.md) | Schema, relationships, indexes, DB security |
| [STORAGE.md](STORAGE.md)   | Encrypted storage layout, naming, protections |
| [BACKUP.md](BACKUP.md)     | What/when/how to back up + restore |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production topology, HTTPS, env config, logging |
| [SETUP.md](SETUP.md)       | Install / configure / run for the whole team |

Key entry points:

- Schema: `database/schema.sql`
- Env template: `.env.example`
- Compose: `docker-compose.yml`
- Scripts: `scripts/{init_storage,backup,restore}.sh`