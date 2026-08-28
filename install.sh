#!/bin/sh
set -eu

REPOSITORY="B-Divyesh/sf-batch-artifact-export"
BASE="https://github.com/$REPOSITORY/releases/latest/download"

case "$(uname -s)" in
  Darwin) asset="batch-artifact-export-macos-universal.tar.gz" ;;
  Linux)
    case "$(uname -m)" in
      x86_64|amd64) asset="batch-artifact-export-linux-x86_64.tar.gz" ;;
      *) echo "Unsupported Linux architecture: $(uname -m)" >&2; exit 1 ;;
    esac ;;
  *) echo "Unsupported operating system: $(uname -s)" >&2; exit 1 ;;
esac

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/batch-artifact-export.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM

echo "Downloading $asset"
curl -fsSL "$BASE/$asset" -o "$work_dir/$asset"
curl -fsSL "$BASE/SHA256SUMS" -o "$work_dir/SHA256SUMS"
expected=$(awk -v file="$asset" '$2 == file { print $1 }' "$work_dir/SHA256SUMS")
[ -n "$expected" ] || { echo "No checksum published for $asset" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$work_dir/$asset" | awk '{print $1}')
else
  actual=$(shasum -a 256 "$work_dir/$asset" | awk '{print $1}')
fi
[ "$actual" = "$expected" ] || { echo "SHA-256 verification failed" >&2; exit 1; }
echo "Verified SHA-256: $actual"

tar -xzf "$work_dir/$asset" -C "$work_dir"
if [ -n "${BAE_INSTALL_DIR:-}" ]; then
  install_dir=$BAE_INSTALL_DIR
elif [ -w /usr/local/bin ]; then
  install_dir=/usr/local/bin
else
  install_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
fi
mkdir -p "$install_dir"
install -m 755 "$work_dir/batch-artifact-export" "$install_dir/batch-artifact-export"
echo "Installed batch-artifact-export to $install_dir/batch-artifact-export"
case ":$PATH:" in *":$install_dir:"*) ;; *) echo "Add $install_dir to PATH to run it from any directory." ;; esac
"$install_dir/batch-artifact-export" --version
