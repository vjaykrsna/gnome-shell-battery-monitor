#!/bin/sh

# This script packages the GNOME Shell extension for distribution.

# Define the extension's UUID from metadata.json
UUID=$(jq -r '.uuid' metadata.json)
VERSION=$(jq -r '.version' metadata.json)
ZIP_FILE="${UUID}-v${VERSION}.zip"

# Remove the old zip file if it exists
if [ -f "$ZIP_FILE" ]; then
    rm "$ZIP_FILE"
fi

# Compile the GSettings schema
glib-compile-schemas schemas/

# Create the zip file
zip -r "$ZIP_FILE" . -x "*.git*" "*node_modules*" "*.zip" "package.sh" ".*"

echo "Extension packaged as $ZIP_FILE"
