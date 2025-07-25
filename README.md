# Battery Monitor GNOME Shell Extension

A GNOME Shell extension that displays the current battery power consumption (Watts) and charge/discharge rate (%/hour) in the panel.

## Features

- **Dual Display:** Shows power usage in Watts and/or charge/discharge rate in %/hour.
- **Configurable:** Customize the refresh rate, number of decimal places, and what information is displayed in the panel.
- **Smoothing:** Uses a configurable number of samples to provide a stable, averaged reading.
- **Detailed Info:** A dropdown menu provides more detailed information, including status, percentage, and estimated time to full/empty.

## Installation

### From extensions.gnome.org (Recommended)

Once approved, this extension will be available for one-click installation from the [GNOME Extensions Website](https://extensions.gnome.org/).

### Manual Installation from GitHub

1.  **Install:** Run the following command in your terminal to clone the repository into the correct directory:
    ```bash
    git clone https://github.com/vjaykrsna/gnome-shell-battery-monitor.git ~/.local/share/gnome-shell/extensions/battery-monitor@vjay.github.io
    ```

2.  **Restart GNOME Shell:** `reboot` or `login/logout`.

3.  **Enable:** Enable the extension using the Extensions app or by running this command:
    ```bash
    gnome-extensions enable battery-monitor@vjay.github.io
    ```

