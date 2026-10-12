#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
domain=${1:?Usage: sh deploy/prepare-env.sh domain email}
email=${2:?ACME email is required}
case "$domain" in *[!a-zA-Z0-9.-]*|*example.com*|localhost|'') echo 'Use a real DNS hostname' >&2; exit 1;; esac
case "$email" in *[!a-zA-Z0-9@._+-]*|'') echo 'Invalid email' >&2; exit 1;; esac
test ! -e .env.production || { echo '.env.production already exists; refusing to overwrite' >&2; exit 1; }
umask 077
db_secret=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 32)
cat > .env.production <<EOF
DOMAIN=$domain
ACME_EMAIL=$email
POSTGRES_DB=lms
POSTGRES_USER=lms
POSTGRES_PASSWORD=$db_secret
JWT_SECRET=$jwt_secret
PRODUCTION_ADMIN_EMAIL=nurdildanurasyl7@gmail.com
BREVO_API_KEY=
BREVO_SENDER_ID=
MAX_USER_FILES=200
MAX_USER_STORAGE_BYTES=524288000
EOF
echo 'Created .env.production; configure the mail key privately before deployment.'
