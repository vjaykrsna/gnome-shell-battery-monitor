# Battery Monitor GNOME Shell Extension

A GNOME Shell extension that displays the current battery power consumption (Watts) and charge/discharge rate (%/hour) in the panel.

---

## Features

- **Dual Display:** Shows power usage in Watts and/or charge/discharge rate in %/hour.
- **Configurable:** Customize the refresh rate, number of decimal places, and what information is displayed in the panel.
- **Smoothing:** Uses a configurable number of samples to provide a stable, averaged reading.
- **Detailed Info:** A dropdown menu provides more detailed information, including status, percentage, and estimated time to full/empty.
- **Battery Health:** View battery health percentage, cycle count, and hardware details in the preferences window.
- **Color Coding:** Optional green/red coloring for charging and low battery states.

## Compatibility

- **GNOME Shell:** 46, 47, 48, 49
- **Platform:** Linux (requires `/sys/class/power_supply` support)

## Installation

### From extensions.gnome.org (Recommended)

Once approved, this extension will be available for one-click installation from the [GNOME Extensions Website](https://extensions.gnome.org/extension/8348/battery-monitor/).

### Manual Installation from GitHub

1.  **Install:** Run the following command in your terminal to clone the repository into the correct directory:
    ```bash
    git clone https://github.com/vjaykrsna/gnome-shell-battery-monitor.git ~/.local/share/gnome-shell/extensions/battery-monitor@vjay.github.io
    ```

2.  **Restart GNOME Shell:** Reboot or log out and log back in.

3.  **Enable:** Enable the extension using the Extensions app or by running this command:
    ```bash
    gnome-extensions enable battery-monitor@vjay.github.io
    ```

### Updating a Manual Installation

To update the extension, navigate to the directory and pull the latest changes:
```bash
cd ~/.local/share/gnome-shell/extensions/battery-monitor@vjay.github.io
git pull
```
Then, restart GNOME Shell.

## Development

The project includes a `manage.sh` script to simplify common tasks:

- **Pack for release:** `./manage.sh pack` (creates a zip file for uploading to GNOME Extensions)
- **Local install:** `./manage.sh install` (copies files to the local extension directory)
- **View logs:** `./manage.sh logs` (streams GNOME Shell logs filtered for this extension)
- **Clean:** `./manage.sh clean` (removes generated zip files)

## License

This project is licensed under the GPL-2.0-or-later License - see the file headers for details.
