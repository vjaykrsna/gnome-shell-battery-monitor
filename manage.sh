#!/bin/bash

# manage.sh - Utility script for GNOME Extension management
# Usage: ./manage.sh [pack|install|logs|clean]

UUID=$(grep -Po '(?<="uuid": ")[^"]*' metadata.json)
VERSION=$(grep -Po '(?<="version": )[^,]*' metadata.json)
ZIP_NAME="${UUID}_v${VERSION}.zip"
INSTALL_PATH="$HOME/.local/share/gnome-shell/extensions/$UUID"

function pack() {
    echo "Packing extension into $ZIP_NAME..."
    # Compile schemas just in case
    glib-compile-schemas schemas/
    
    # Create zip excluding development files
    zip -r "$ZIP_NAME" . -x "*.git*" "manage.sh" "*.zip" "README.md" ".vscode/*"
    echo "Done! You can now upload $ZIP_NAME to extensions.gnome.org"
}

function install() {
    echo "Installing extension to $INSTALL_PATH..."
    mkdir -p "$INSTALL_PATH"
    cp -r . "$INSTALL_PATH"
    # Remove dev files from install path
    rm -rf "$INSTALL_PATH/.git" "$INSTALL_PATH/manage.sh" "$INSTALL_PATH/*.zip"
    echo "Installed. Please restart GNOME Shell (Alt+F2, r, Enter) or log out/in."
}

function logs() {
    echo "Showing logs for $UUID (Ctrl+C to stop)..."
    journalctl -f -o cat /usr/bin/gnome-shell | grep "$UUID"
}

function clean() {
    echo "Cleaning up zip files..."
    rm -f *.zip
    echo "Cleaned."
}

case "$1" in
    pack)
        pack
        ;;
    install)
        install
        ;;
    logs)
        logs
        ;;
    clean)
        clean
        ;;
    *)
        echo "Usage: $0 {pack|install|logs|clean}"
        exit 1
        ;;
esac
