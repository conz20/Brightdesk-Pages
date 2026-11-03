#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$1"
PLATFORM="$2"
RELEASE_DIR="$PROJECT_DIR/release"
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"

if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" ]]; then
  echo "Brightdesk installer smoke test received an invalid project directory." >&2
  exit 2
fi

case "$PLATFORM" in
  linux)
    DEB_FILE="$(find "$RELEASE_DIR" -maxdepth 1 -type f -name 'brightdesk-*.deb' -print -quit)"
    INSTALL_HELPER="$RELEASE_DIR/Brightdesk-Install-Linux.sh"
    if [[ -z "$DEB_FILE" || ! -f "$INSTALL_HELPER" ]]; then
      echo "Linux installer smoke test could not find the DEB package and consent helper." >&2
      exit 2
    fi

    PACKAGE_NAME="$(dpkg-deb -f "$DEB_FILE" Package)"
    cleanup_linux() {
      sudo apt-get remove -y "$PACKAGE_NAME" >/dev/null 2>&1 || true
    }
    trap cleanup_linux EXIT

    export DEBIAN_FRONTEND=noninteractive
    printf 'yes\n' | bash "$INSTALL_HELPER"
    DESKTOP_FILE="$(dpkg-query -L "$PACKAGE_NAME" | grep -E '/usr/share/applications/[^/]+\.desktop$' | head -n 1 || true)"
    if [[ -z "$DESKTOP_FILE" || ! -f "$DESKTOP_FILE" ]]; then
      echo "Installed Linux package did not register a desktop application." >&2
      exit 1
    fi
    APP_BINARY="$(sed -n 's/^Exec=\([^[:space:]]*\).*/\1/p' "$DESKTOP_FILE" | head -n 1)"
    if [[ "$APP_BINARY" != /* ]]; then
      APP_BINARY="$(command -v "$APP_BINARY" || true)"
    fi
    if [[ -z "$APP_BINARY" || ! -x "$APP_BINARY" ]]; then
      echo "Installed Linux application executable was not found in the desktop entry or PATH." >&2
      exit 1
    fi
    if "$APP_BINARY" --no-sandbox --version; then
      :
    else
      launch_status=$?
      echo "Installed application launch check failed with exit code $launch_status." >&2
      if command -v ldd >/dev/null 2>&1; then
        missing_libraries="$(ldd "$APP_BINARY" 2>/dev/null | awk '/not found/ {print $1}' | sort -u)"
        if [[ -n "$missing_libraries" ]]; then
          echo "Missing system runtime libraries: $missing_libraries" >&2
        fi
      fi
      exit "$launch_status"
    fi
    sudo apt-get remove -y "$PACKAGE_NAME"
    trap - EXIT
    ;;
  mac)
    PKG_FILE="$(find "$RELEASE_DIR" -maxdepth 1 -type f -name '*.pkg' -print -quit)"
    DMG_FILE="$(find "$RELEASE_DIR" -maxdepth 1 -type f -name '*.dmg' -print -quit)"
    if [[ -z "$PKG_FILE" || -z "$DMG_FILE" ]]; then
      echo "macOS installer smoke test could not find both the PKG and DMG packages." >&2
      exit 2
    fi

    TEMP_ROOT="$RUNNER_TEMP"
    MOUNT_DIR="$TEMP_ROOT/brightdesk-dmg-mount-$$"
    DMG_APP="$TEMP_ROOT/Brightdesk-dmg-smoke-$$.app"
    APP_PATH="/Applications/Brightdesk.app"
    mkdir -p "$MOUNT_DIR"
    cleanup_macos() {
      hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || true
      sudo rm -rf "$APP_PATH" >/dev/null 2>&1 || true
      rm -rf "$MOUNT_DIR" "$DMG_APP"
    }
    trap cleanup_macos EXIT

    hdiutil attach -quiet -nobrowse -mountpoint "$MOUNT_DIR" "$DMG_FILE"
    DMG_APP_SOURCE="$(find "$MOUNT_DIR" -maxdepth 3 -name 'Brightdesk.app' -type d -print -quit)"
    if [[ -z "$DMG_APP_SOURCE" ]]; then
      echo "The macOS DMG did not contain Brightdesk.app." >&2
      exit 1
    fi
    ditto "$DMG_APP_SOURCE" "$DMG_APP"
    DMG_EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$DMG_APP/Contents/Info.plist")"
    "$DMG_APP/Contents/MacOS/$DMG_EXECUTABLE" --version
    hdiutil detach "$MOUNT_DIR" -quiet

    sudo installer -allowUntrusted -pkg "$PKG_FILE" -target / -agreeToLicense
    if [[ ! -d "$APP_PATH" ]]; then
      echo "The macOS PKG completed without installing Brightdesk.app." >&2
      exit 1
    fi
    APP_EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")"
    "$APP_PATH/Contents/MacOS/$APP_EXECUTABLE" --version
    sudo rm -rf "$APP_PATH"
    rm -rf "$MOUNT_DIR" "$DMG_APP"
    trap - EXIT
    ;;
  win)
    if command -v pwsh >/dev/null 2>&1; then
      pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$SCRIPT_DIR/verify-private-install.ps1" -ProjectDir "$PROJECT_DIR"
    elif command -v powershell.exe >/dev/null 2>&1; then
      powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$SCRIPT_DIR/verify-private-install.ps1" -ProjectDir "$PROJECT_DIR"
    else
      echo "Windows installer smoke test requires PowerShell." >&2
      exit 2
    fi
    ;;
  *)
    echo "Unsupported installer smoke-test platform: $PLATFORM" >&2
    exit 2
    ;;
esac

echo "Brightdesk $PLATFORM installer installation and launch smoke test passed."
