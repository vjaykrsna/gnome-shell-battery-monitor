/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

// Constants for power calculations. The values are typically in micro-units.
const MICROWATTS_PER_WATT = 1000000;
const MICROVOLTS_PER_VOLT = 1000000;
const MICROAMPS_PER_AMP = 1000000;

const BatteryMonitorIndicator = GObject.registerClass({
    Properties: {
        'refreshrate': GObject.ParamSpec.int(
            'refreshrate', 'Refresh Rate', 'The refresh rate in seconds',
            GObject.ParamFlags.READWRITE,
            1, 60, 5),
        'decimal-places': GObject.ParamSpec.int(
            'decimal-places', 'Decimal Places', 'The number of decimal places',
            GObject.ParamFlags.READWRITE,
            0, 5, 1),
        'display-mode': GObject.ParamSpec.string(
            'display-mode', 'Display Mode', 'The display mode for the panel',
            GObject.ParamFlags.READWRITE,
            'Both'),
        'smoothing-samples': GObject.ParamSpec.int(
            'smoothing-samples', 'Smoothing Samples', 'The number of samples to average',
            GObject.ParamFlags.READWRITE,
            1, 20, 10),
    },
},
class BatteryMonitorIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _("Battery Monitor"));
        this._extension = extension;
        this._settings = this._extension.getSettings();

        // Main label
        this._label = new St.Label({
            text: "---",
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        // Settings Binding
        this._settings.bind("refreshrate", this, "refreshrate", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("decimal-places", this, "decimal-places", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("display-mode", this, "display-mode", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("smoothing-samples", this, "smoothing-samples", Gio.SettingsBindFlags.DEFAULT);

        // Connect to property changes
        this.connect('notify::refreshrate', () => this._startMonitoring());
        this.connect('notify::decimal-places', () => this._update());
        this.connect('notify::display-mode', () => this._update());
        this.connect('notify::smoothing-samples', () => {
            this._chargingReadings = [];
            this._dischargingReadings = [];
            this._update();
        });

        // Battery variables
        this._batteryPath = null;
        this._chargingReadings = [];
        this._dischargingReadings = [];
        this._decoder = new TextDecoder();

        this._createMenu();
        this._update();
        this._startMonitoring();
    }

    _createMenu() {
        this.menu.removeAll();
        this._powerUsageLabel = new PopupMenu.PopupMenuItem(_('Power usage: ...'));
        this.menu.addMenuItem(this._powerUsageLabel);
        this._percentageRateLabel = new PopupMenu.PopupMenuItem(_('Rate: ...'));
        this.menu.addMenuItem(this._percentageRateLabel);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._statusLabel = new PopupMenu.PopupMenuItem(_('Status: ...'));
        this.menu.addMenuItem(this._statusLabel);
        this._timeLabel = new PopupMenu.PopupMenuItem(_('Time: ...'));
        this.menu.addMenuItem(this._timeLabel);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_('Preferences'), () => this._extension.openPreferences());
    }

    _update() {
        try {
            if (!this._batteryPath) {
                this._batteryPath = this._findBatteryPath();
            }
            if (!this._batteryPath) {
                this._label.set_text("No battery found");
                return;
            }

            const capacity = this._readBatteryFile("capacity");
            const status = this._readBatteryStatus();
            const isCharging = status === "Charging";

            const power = this._calculatePower();
            const rate = this._calculateRate(isCharging, capacity, power);

            this._updateLabel(power, rate, isCharging);
            this._updateMenu(power, rate, isCharging, capacity, status);
        } catch (e) {
            console.error(`[BatteryMonitor] Error during update: ${e}`);
            this._label.set_text("Error");
        }
    }

    _updateLabel(power, rate, isCharging) {
        let text = '';
        const powerStr = `${power.toFixed(this['decimal-places'])}W`;
        const rateStr = `${Math.abs(rate).toFixed(this['decimal-places'])}%`;
        
        let sign = '';
        if (isCharging) {
            sign = '+';
        } else if (power > 0.01) { // Only show discharge sign if power draw is significant
            sign = '−';
        }

        switch (this['display-mode']) {
            case 'Watts':
                text = `${sign}${powerStr}`;
                break;
            case '%/h':
                text = `${sign}${rateStr}`;
                break;
            case 'Both':
                text = `${sign}${powerStr} | ${sign}${rateStr}`;
                break;
            default:
                text = `${sign}${powerStr}`;
        }
        this._label.set_text(text);
    }

    _updateMenu(power, rate, isCharging, capacity, status) {
        let sign = '';
        if (isCharging) {
            sign = '+';
        } else if (power > 0.01) { // Only show discharge sign if power draw is significant
            sign = '−';
        }
        const displayRate = Math.abs(rate);

        this._powerUsageLabel.label.text = `${_('Power usage')}: ${sign}${power.toFixed(this['decimal-places'])} W`;
        this._percentageRateLabel.label.text = `${_('Rate')}: ${sign}${displayRate.toFixed(this['decimal-places'])} %/h`;
        this._statusLabel.label.text = `${_('Status')}: ${status} (${capacity}%)`;

        let time = 0;
        if (displayRate > 0) {
            if (isCharging) {
                time = (100 - capacity) / displayRate;
            } else {
                time = capacity / displayRate;
            }
        }

        if (time > 0 && isFinite(time)) {
            const hours = Math.floor(time);
            const minutes = Math.floor((time - hours) * 60);
            this._timeLabel.label.text = `${_('Time')}: ${hours}h ${minutes}m`;
        } else {
            this._timeLabel.label.text = `${_('Time')}: --`;
        }
    }

    _calculatePower() {
        let power = 0;
        if (GLib.file_test(`${this._batteryPath}/power_now`, GLib.FileTest.EXISTS)) {
            power = this._readBatteryFile('power_now') / MICROWATTS_PER_WATT;
        } else {
            const current = this._readBatteryFile('current_now');
            const voltage = this._readBatteryFile('voltage_now');
            power = (current / MICROAMPS_PER_AMP) * (voltage / MICROVOLTS_PER_VOLT);
        }
        return power;
    }

    _calculateRate(isCharging, capacity, power) {
        let rate = 0;
        // Prioritize current capacity (energy_full) over design capacity for accuracy.
        const energyFull = this._readBatteryFile('energy_full') || this._readBatteryFile('energy_full_design');
        if (energyFull > 0) {
            const powerWatts = power;
            const energyFullWh = energyFull / MICROWATTS_PER_WATT;
            rate = (powerWatts / energyFullWh) * 100;
        } else {
            // Fallback to charge_full (microamp-hours) * voltage_now (microvolts)
            const chargeFull = this._readBatteryFile('charge_full') || this._readBatteryFile('charge_full_design');
            const voltage = this._readBatteryFile('voltage_now');
            if (chargeFull > 0 && voltage > 0) {
                const chargeFullAh = chargeFull / MICROAMPS_PER_AMP;
                const voltageV = voltage / MICROVOLTS_PER_VOLT;
                const energyFullCalcWh = chargeFullAh * voltageV;
                const powerWatts = power;
                if (energyFullCalcWh > 0) {
                    rate = (powerWatts / energyFullCalcWh) * 100;
                }
            }
        }

        if (!isCharging) {
            rate = -rate;
        }

        if (isCharging) {
            this._chargingReadings.push(rate);
            if (this._chargingReadings.length > this['smoothing-samples']) this._chargingReadings.shift();
        } else {
            this._dischargingReadings.push(rate);
            if (this._dischargingReadings.length > this['smoothing-samples']) this._dischargingReadings.shift();
        }

        const readings = isCharging ? this._chargingReadings : this._dischargingReadings;
        if (readings.length === 0) return 0;
        const avgRate = readings.reduce((a, b) => a + b, 0) / readings.length;
        return avgRate;
    }

    _findBatteryPath() {
        const powerSupplyDir = Gio.File.new_for_path("/sys/class/power_supply");
        const enumerator = powerSupplyDir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
            const name = fileInfo.get_name();
            const typeFile = Gio.File.new_for_path(`/sys/class/power_supply/${name}/type`);
            if (typeFile.query_exists(null)) {
                const [success, contents] = typeFile.load_contents(null);
                if (success && this._decoder.decode(contents).trim() === "Battery") {
                    return `/sys/class/power_supply/${name}`;
                }
            }
        }
        if (GLib.file_test("/sys/class/power_supply/BAT0", GLib.FileTest.IS_DIR)) return "/sys/class/power_supply/BAT0";
        if (GLib.file_test("/sys/class/power_supply/BAT1", GLib.FileTest.IS_DIR)) return "/sys/class/power_supply/BAT1";
        return null;
    }

    _readBatteryFile(fileName) {
        const filePath = `${this._batteryPath}/${fileName}`;
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            return 0;
        }
        try {
            const file = Gio.File.new_for_path(filePath);
            const [success, contents] = file.load_contents(null);
            if (success) {
                return parseInt(this._decoder.decode(contents).trim());
            }
        } catch (e) {
            console.error(`Error reading ${fileName}: ${e}`);
        }
        return 0;
    }

    _readBatteryStatus() {
        try {
            const file = Gio.File.new_for_path(`${this._batteryPath}/status`);
            const [success, contents] = file.load_contents(null);
            if (success) {
                return this._decoder.decode(contents).trim();
            }
        } catch (e) {
            console.error(`Error reading status: ${e}`);
        }
        return "Unknown";
    }

    _startMonitoring() {
        this._stopMonitoring();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.refreshrate, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopMonitoring() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    destroy() {
      this._stopMonitoring();
      super.destroy();
    }
});

export default class BatteryMonitorExtension extends Extension {
  enable() {
    this._indicator = new BatteryMonitorIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}
