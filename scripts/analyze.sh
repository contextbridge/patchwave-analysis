#!/bin/sh
#
# analyze.sh — download and run patchwave-analysis as a one-off.
#
# Usage (interactive — it prompts you through everything, no flags needed):
#   bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
#
# Downloads the patchwave-analysis binary for your platform from the latest
# GitHub release into a temp dir, verifies its checksum, runs it, then deletes
# it. The binary runs an interactive session and writes its report into a
# temporary directory, printing the path when it finishes. Nothing is installed.
#
# Use the `bash -c "$(curl ...)"` form rather than `curl ... | bash`: the
# command-substitution form leaves your terminal on stdin so the prompts work.
# As a fallback the script also reconnects the controlling terminal (/dev/tty)
# when running the binary, so a piped invocation still gets a TTY.
#
# Auth is the CLI's job: it reads GITHUB_TOKEN, then GH_TOKEN, then `gh auth
# token`. Export a token first, or be logged in via the gh CLI.
#
# Env vars:
#   PW_VERSION   pin to a release tag (e.g. v0.1.0) instead of the latest release

set -eu

REPO="contextbridge/patchwave-analysis"
BINARY_NAME="patchwave-analysis"

main() {
  _platform=$(detect_platform)
  _os="${_platform% *}"
  _arch="${_platform#* }"

  _asset="${BINARY_NAME}_${_os}_${_arch}.tar.gz"
  _base_url=$(release_base_url)

  _tmp=$(mktemp -d 2>/dev/null || mktemp -d -t pw-analyze)
  # shellcheck disable=SC2064
  trap "rm -rf '$_tmp'" EXIT INT TERM

  info "downloading ${_asset}..."
  http_download "${_base_url}/${_asset}" "$_tmp/$_asset" \
    || fail "download failed: ${_base_url}/${_asset}"

  info "downloading checksums.txt..."
  http_download "${_base_url}/checksums.txt" "$_tmp/checksums.txt" \
    || fail "checksum file download failed: ${_base_url}/checksums.txt"

  verify_checksum "$_tmp/$_asset" "$_asset" "$_tmp/checksums.txt"

  info "extracting..."
  tar -xzf "$_tmp/$_asset" -C "$_tmp" || fail "tarball extraction failed"
  [ -f "$_tmp/$BINARY_NAME" ] || fail "expected '$BINARY_NAME' in tarball, not found"
  chmod +x "$_tmp/$BINARY_NAME"

  # The CLI is an interactive session, so it needs a terminal on stdin.
  # Reconnect the controlling terminal (/dev/tty) so prompts work even when this
  # script was piped into a shell (stdin = the pipe, not your terminal). Where
  # there is no terminal (e.g. CI), run with inherited stdin and let the CLI
  # report that it needs one. Run, don't exec, so the EXIT trap still deletes the
  # temp binary; preserve the CLI's exit code for the caller.
  info "starting ${BINARY_NAME}..."
  set +e
  if (: < /dev/tty) 2>/dev/null; then
    "$_tmp/$BINARY_NAME" "$@" < /dev/tty
  else
    "$_tmp/$BINARY_NAME" "$@"
  fi
  _status=$?
  set -e
  exit "$_status"
}

# Base URL for release assets: the latest release by default, or a pinned tag
# when PW_VERSION is set (with or without a leading `v`).
release_base_url() {
  if [ -n "${PW_VERSION:-}" ]; then
    _ver="$PW_VERSION"
    case "$_ver" in v*) ;; *) _ver="v$_ver" ;; esac
    printf 'https://github.com/%s/releases/download/%s\n' "$REPO" "$_ver"
  else
    printf 'https://github.com/%s/releases/latest/download\n' "$REPO"
  fi
}

detect_platform() {
  _detected_os=""
  _detected_arch=""
  case "$(uname -s)" in
    Darwin) _detected_os=darwin ;;
    Linux) _detected_os=linux ;;
    *) fail "unsupported OS: $(uname -s). patchwave-analysis supports macOS and Linux." ;;
  esac
  case "$(uname -m)" in
    arm64 | aarch64) _detected_arch=arm64 ;;
    x86_64 | amd64) _detected_arch=amd64 ;;
    *) fail "unsupported architecture: $(uname -m). patchwave-analysis supports amd64 and arm64." ;;
  esac
  printf '%s %s\n' "$_detected_os" "$_detected_arch"
}

http_download() {
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --location --output "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet -O "$2" "$1"
  else
    fail "neither curl nor wget is available"
  fi
}

verify_checksum() {
  _file="$1"
  _name="$2"
  _checksums="$3"
  _expected=$(awk -v n="$_name" '$2 == n || $2 == "*"n { print $1; exit }' "$_checksums")
  [ -n "$_expected" ] || fail "could not find checksum for $_name in checksums.txt"

  if command -v sha256sum >/dev/null 2>&1; then
    _actual=$(sha256sum "$_file" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    _actual=$(shasum -a 256 "$_file" | awk '{print $1}')
  else
    fail "neither sha256sum nor shasum is available for checksum verification"
  fi

  [ "$_actual" = "$_expected" ] \
    || fail "checksum mismatch for $_name: expected $_expected, got $_actual"
  info "checksum verified."
}

# Diagnostics go to stderr so the CLI keeps stdout for its own output.
info() { printf '%s\n' "$1" >&2; }
fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

# Tests source this file with PW_ANALYZE_SH_LIB=1 to exercise helpers without
# running main.
if [ "${PW_ANALYZE_SH_LIB:-}" != "1" ]; then
  main "$@"
fi
