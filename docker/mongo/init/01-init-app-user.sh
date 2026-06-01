#!/usr/bin/env bash
set -euo pipefail

APP_DB="${MONGO_APP_DB:-ons}"
APP_USER="${MONGO_APP_USERNAME:-ons_app}"
APP_PASS="${MONGO_APP_PASSWORD:-ons_app_dev_password}"

mongosh --quiet <<EOF
db = db.getSiblingDB("${APP_DB}");
if (!db.getUser("${APP_USER}")) {
  db.createUser({
    user: "${APP_USER}",
    pwd: "${APP_PASS}",
    roles: [{ role: "readWrite", db: "${APP_DB}" }]
  });
  print("Created app user '${APP_USER}' on db '${APP_DB}'");
} else {
  print("App user '${APP_USER}' already exists on db '${APP_DB}'");
}
EOF
