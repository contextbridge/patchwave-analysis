#!/bin/sh
#
# analyze.test.sh — plain-sh tests for analyze.sh helpers.

set -u

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
export PW_ANALYZE_SH_LIB=1
# shellcheck source=SCRIPTDIR/analyze.sh
# shellcheck disable=SC1091
. "$script_dir/analyze.sh"

pass=0
fail=0

assert_eq() {
  if [ "$1" = "$2" ]; then
    pass=$((pass + 1))
    printf 'ok — %s\n' "$3"
  else
    fail=$((fail + 1))
    printf 'FAIL — %s\n  expected: %s\n  got:      %s\n' "$3" "$2" "$1"
  fi
}

assert_exits_nonzero() {
  if ( $1 ) >/dev/null 2>&1; then
    fail=$((fail + 1))
    printf 'FAIL — %s (expected non-zero exit)\n' "$2"
  else
    pass=$((pass + 1))
    printf 'ok — %s\n' "$2"
  fi
}

# --- detect_platform ---

# shellcheck disable=SC2317,SC2329  # uname redefinition called indirectly via assert_exits_nonzero $1 (SC2317 = shellcheck <0.10, SC2329 = >=0.10)
uname() { case "$1" in -s) echo Darwin ;; -m) echo arm64 ;; esac; }
assert_eq "$(detect_platform)" "darwin arm64" "darwin arm64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Darwin ;; -m) echo x86_64 ;; esac; }
assert_eq "$(detect_platform)" "darwin amd64" "darwin x86_64 maps to amd64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo x86_64 ;; esac; }
assert_eq "$(detect_platform)" "linux amd64" "linux x86_64 maps to amd64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo aarch64 ;; esac; }
assert_eq "$(detect_platform)" "linux arm64" "linux aarch64 maps to arm64"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo Linux ;; -m) echo i386 ;; esac; }
assert_exits_nonzero detect_platform "unsupported arch fails"

# shellcheck disable=SC2317,SC2329
uname() { case "$1" in -s) echo FreeBSD ;; -m) echo amd64 ;; esac; }
assert_exits_nonzero detect_platform "unsupported OS fails"

unset -f uname

# --- release_base_url ---
# PW_VERSION is read by release_base_url (sourced from analyze.sh); export so it
# reaches the command-substitution subshell and reads as used to shellcheck.

export PW_VERSION=""
assert_eq "$(release_base_url)" \
  "https://github.com/contextbridge/patchwave-analysis/releases/latest/download" \
  "no PW_VERSION uses the latest release"

PW_VERSION="v0.1.0"
assert_eq "$(release_base_url)" \
  "https://github.com/contextbridge/patchwave-analysis/releases/download/v0.1.0" \
  "PW_VERSION pins a tag"

PW_VERSION="0.1.0"
assert_eq "$(release_base_url)" \
  "https://github.com/contextbridge/patchwave-analysis/releases/download/v0.1.0" \
  "PW_VERSION without leading v is normalized"

# --- verify_checksum ---

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

printf 'hello\n' > "$tmp/sample.tar.gz"
expected=$(shasum -a 256 "$tmp/sample.tar.gz" 2>/dev/null | awk '{print $1}')
if [ -z "$expected" ]; then expected=$(sha256sum "$tmp/sample.tar.gz" | awk '{print $1}'); fi
printf '%s  sample.tar.gz\nabc  other.tar.gz\n' "$expected" > "$tmp/checksums.txt"

if verify_checksum "$tmp/sample.tar.gz" "sample.tar.gz" "$tmp/checksums.txt" >/dev/null 2>&1; then
  pass=$((pass + 1)); printf 'ok — verify_checksum accepts correct hash\n'
else
  fail=$((fail + 1)); printf 'FAIL — verify_checksum rejected correct hash\n'
fi

printf 'deadbeef  sample.tar.gz\n' > "$tmp/bad.txt"
if ( verify_checksum "$tmp/sample.tar.gz" "sample.tar.gz" "$tmp/bad.txt" ) >/dev/null 2>&1; then
  fail=$((fail + 1)); printf 'FAIL — verify_checksum accepted wrong hash\n'
else
  pass=$((pass + 1)); printf 'ok — verify_checksum rejects wrong hash\n'
fi

# --- summary ---

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
