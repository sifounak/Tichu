#!/usr/bin/env bash
# Rename a Tichu account username in the SQLite database.
#
# Examples:
#   ./rename-user.sh /files/.www/tichu/data/tichu.sqlite oldName Alice
#   bash code/scripts/rename-user.sh --user-id user_abc123 --new-username Alice
#   bash code/scripts/rename-user.sh --current-username oldName --new-username Alice
#   DATABASE_PATH=/files/.www/tichu/data/tichu.sqlite bash code/scripts/rename-user.sh --email user@example.com --new-username Alice
set -euo pipefail

DEFAULT_DB="/files/.www/tichu/data/tichu.sqlite"
DB_PATH="${DATABASE_PATH:-$DEFAULT_DB}"
USER_ID=""
CURRENT_USERNAME=""
EMAIL=""
NEW_USERNAME=""

usage() {
  cat <<'EOF'
Usage:
  ./rename-user.sh /path/to/tichu.sqlite oldUserName newUserName
  bash code/scripts/rename-user.sh [--db PATH] (--user-id ID | --current-username NAME | --email EMAIL) --new-username NAME

Options:
  --db PATH                 SQLite DB path. Defaults to DATABASE_PATH, then /files/.www/tichu/data/tichu.sqlite
  --user-id ID              Identify the user by users.id
  --current-username NAME   Identify the user by current username, case-insensitive
  --email EMAIL             Identify the user by email
  --new-username NAME       New username/display name
  -h, --help                Show this help

Positional form:
  The second argument is matched against users.username case-insensitively.
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

sql_quote() {
  local value="${1//\'/\'\'}"
  printf "'%s'" "$value"
}

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

validate_username() {
  local username="$1"
  local trimmed
  trimmed="$(trim "$username")"

  if [ -z "$username" ]; then
    die "New username is required."
  fi
  if [ "$trimmed" != "$username" ]; then
    die "Username must not have leading or trailing spaces."
  fi
  if [ "${#username}" -gt 30 ]; then
    die "Username must be 30 characters or less."
  fi

  local reserved=(
    admin administrator system server moderator mod operator root superuser sysadmin
    bot gamebot tichu tichubot autoplay
    host dealer official support helpdesk staff
    player player1 player2 player3 player4
    team1 team2 spectator observer
    empty "empty seat"
  )
  local username_lower
  username_lower="$(lower "$username")"
  for name in "${reserved[@]}"; do
    if [ "$username_lower" = "$name" ]; then
      die "Username \"$username\" is reserved."
    fi
  done
}

if [ "$#" -eq 3 ] && [[ "$1" != -* ]]; then
  DB_PATH="$1"
  CURRENT_USERNAME="$2"
  NEW_USERNAME="$3"
else
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --db)
        DB_PATH="${2:-}"
        shift 2
        ;;
      --user-id)
        USER_ID="${2:-}"
        shift 2
        ;;
      --current-username)
        CURRENT_USERNAME="${2:-}"
        shift 2
        ;;
      --email)
        EMAIL="${2:-}"
        shift 2
        ;;
      --new-username)
        NEW_USERNAME="${2:-}"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
fi

identifier_count=0
[ -n "$USER_ID" ] && identifier_count=$((identifier_count + 1))
[ -n "$CURRENT_USERNAME" ] && identifier_count=$((identifier_count + 1))
[ -n "$EMAIL" ] && identifier_count=$((identifier_count + 1))

if [ "$identifier_count" -gt 1 ]; then
  die "Provide exactly one of --user-id, --current-username, or --email."
fi
[ "$identifier_count" -eq 1 ] || die "Provide exactly one of --user-id, --current-username, or --email."

command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 is not installed or not on PATH."
[ -n "$DB_PATH" ] || die "Database path is empty."
[ -f "$DB_PATH" ] || die "Database not found: $DB_PATH"
validate_username "$NEW_USERNAME"

if [ -n "$USER_ID" ]; then
  where_clause="id = $(sql_quote "$USER_ID")"
elif [ -n "$CURRENT_USERNAME" ]; then
  where_clause="LOWER(username) = LOWER($(sql_quote "$CURRENT_USERNAME"))"
else
  where_clause="email = $(sql_quote "$EMAIL")"
fi

match_count="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE $where_clause;")"
[ "$match_count" = "1" ] || die "Expected exactly one matching user, found $match_count."

resolved_user_id="$(sqlite3 "$DB_PATH" "SELECT id FROM users WHERE $where_clause LIMIT 1;")"
resolved_user_id_sql="$(sql_quote "$resolved_user_id")"
new_username_sql="$(sql_quote "$NEW_USERNAME")"

conflict_count="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER($new_username_sql) AND id <> $resolved_user_id_sql;")"
[ "$conflict_count" = "0" ] || die "Username \"$NEW_USERNAME\" is already taken."

backup_path="$DB_PATH.bak.$(date +%Y%m%d-%H%M%S)"
cp "$DB_PATH" "$backup_path"

echo "Database: $DB_PATH"
echo "Backup:   $backup_path"
echo ""
echo "Before:"
sqlite3 -header -column "$DB_PATH" "SELECT id, username, display_name, email, is_guest FROM users WHERE id = $resolved_user_id_sql;"

sqlite3 "$DB_PATH" "
UPDATE users
SET username = $new_username_sql,
    display_name = $new_username_sql
WHERE id = $resolved_user_id_sql;
"

echo ""
echo "After:"
sqlite3 -header -column "$DB_PATH" "SELECT id, username, display_name, email, is_guest FROM users WHERE id = $resolved_user_id_sql;"
echo ""
echo "Done."
