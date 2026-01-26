#!/bin/bash

# manage.sh - Utility script for GNOME Extension management
# Usage: ./manage.sh [pack|install|compile|logs|clean]

UUID=$(grep -Po '(?<="uuid": ")[^"]*' metadata.json)
VERSION=$(grep -Po '(?<="version": )[^,]*' metadata.json)
ZIP_NAME="${UUID}_v${VERSION}.zip"
INSTALL_PATH="$HOME/.local/share/gnome-shell/extensions/$UUID"

function pack() {
    echo "Packing extension into $ZIP_NAME..."
    
    # Create zip excluding development files
    zip -r "$ZIP_NAME" . -x "*.git*" "manage.sh" "*.zip" "README.md" ".vscode/*"
    echo "Done! You can now upload $ZIP_NAME to extensions.gnome.org"
}

function install() {
    echo "Installing extension to $INSTALL_PATH..."
    
    # If we are already in the install path, don't delete our own .git!
    if [ "$(realpath .)" = "$(realpath "$INSTALL_PATH")" ]; then
        echo "Already in install path. Skipping file copy and cleanup."
        compile
        return
    fi

    mkdir -p "$INSTALL_PATH"
    cp -r . "$INSTALL_PATH"
    # Remove dev files from install path
    rm -rf "$INSTALL_PATH/.git" "$INSTALL_PATH/manage.sh" "$INSTALL_PATH/*.zip"
    
    # Compile schemas in the install path
    glib-compile-schemas "$INSTALL_PATH/schemas/"
    
    echo "Installed. Please restart GNOME Shell (Alt+F2, r, Enter) or log out/in."
}

function compile() {
    echo "Compiling schemas..."
    glib-compile-schemas schemas/
    echo "Done."
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
    compile)
        compile
        ;;
    logs)
        logs
        ;;
    clean)
        clean
        ;;
    *)
        echo "Usage: $0 {pack|install|compile|logs|clean}"
        exit 1
        ;;
esac
