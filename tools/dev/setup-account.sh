#!/usr/bin/env bash
# Creates the host account from the command line: the first-run setup endpoint
# only accepts loopback-trusted requests, and a browser served from the public
# port never carries the loopback secret, so in a host-only dev loop (make
# host-svelte) the wizard in the UI cannot complete. The host writes its
# current secret to <data root>/config/loopback-secret precisely for local
# tools like this one. Usage: setup-account.sh <username> <password>
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)

username=${1:?usage: setup-account.sh <username> <password>}
password=${2:?usage: setup-account.sh <username> <password>}

if [[ -z "$username" || -z "$password" ]]; then
	echo "error: the username and the password must not be empty" >&2
	exit 1
fi

loopback_port=${MACRODECK_LOOPBACK_PORT:-5191}

# The dev host roots its data at the working directory it was started from, and
# a `dotnet run --project` child has the project directory as its working
# directory, so both layouts are checked and the freshest secret wins.
secret_file=""
for candidate in \
	"$root/host/src/MacroDeckHost/.data/config/loopback-secret" \
	"$root/.data/config/loopback-secret"; do
	if [[ -f "$candidate" && ( -z "$secret_file" || "$candidate" -nt "$secret_file" ) ]]; then
		secret_file=$candidate
	fi
done

if [[ -z "$secret_file" ]]; then
	echo "error: no loopback-secret file found; is the dev host running?" >&2
	exit 1
fi

secret=$(tr -d '[:space:]' < "$secret_file")
if [[ ${#secret} -lt 64 ]]; then
	echo "error: $secret_file does not hold a 64-character hex secret" >&2
	exit 1
fi

json=$(printf '{"username":"%s","password":"%s"}' "${username//\"/\\\"}" "${password//\"/\\\"}")

response=$(curl -s -m 15 -X POST "http://localhost:${loopback_port}/api/auth/setup" \
	-H "X-MacroDeck-Loopback-Secret: ${secret}" \
	-H "Content-Type: application/json" \
	-d "$json")
status=$?

if [[ $status -ne 0 ]]; then
	echo "error: could not reach http://localhost:${loopback_port} - is the dev host running?" >&2
	exit 1
fi

if [[ -z "$response" ]]; then
	echo "Account '$username' created. Sign in at http://localhost:7193/admin with it."
else
	# The endpoint answers 204 with an empty body; anything else is a problem document.
	echo "error: the host refused the setup:" >&2
	echo "$response" >&2
	exit 1
fi
