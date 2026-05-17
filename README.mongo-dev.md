# Mongo Dev Stack (Docker)

Use [`docker-compose-mongo-dev.yml`](./docker-compose-mongo-dev.yml) for a complete local Mongo setup:
- MongoDB 7 with auth
- App database user auto-created on first boot
- Mongo Express UI on port `8081`
- Persistent named volume (`mongo_data_dev`)

## Start

```bash
docker compose -f docker-compose-mongo-dev.yml up -d
```

## Stop

```bash
docker compose -f docker-compose-mongo-dev.yml down
```

## Reset data (fresh DB)

```bash
docker compose -f docker-compose-mongo-dev.yml down -v
```

## Connect strings

App user (recommended for API):

```txt
mongodb://matching_app:matching_app_dev_password@localhost:27017/matching?authSource=matching
```

Root/admin:

```txt
mongodb://root:root@localhost:27017/admin?authSource=admin
```

Mongo Express:
- URL: http://localhost:8081
- Login: `devadmin` / `devadmin`

## Optional env overrides

You can override defaults from your shell or a `.env` file in the repo root:
- `MONGO_PORT`
- `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`
- `MONGO_APP_DB`, `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD`
- `MONGO_EXPRESS_PORT`, `MONGO_EXPRESS_USERNAME`, `MONGO_EXPRESS_PASSWORD`

## Using multiple env files

Use `--env-file` to choose which env file is used for compose variable substitution:

```bash
docker compose --env-file .env.mongo.dev -f docker-compose-mongo-dev.yml up -d
docker compose --env-file .env.mongo.staging -f docker-compose-mongo-dev.yml up -d
```

If you need layered values, pass multiple `--env-file` flags (later files win):

```bash
docker compose \
  --env-file .env.mongo.base \
  --env-file .env.mongo.local \
  -f docker-compose-mongo-dev.yml up -d
```

Precedence summary:
- Later `--env-file` values override earlier ones
- Shell environment variables override `--env-file` values
