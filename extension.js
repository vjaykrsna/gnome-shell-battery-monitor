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

import { BatteryService } from "./batteryService.js";
import * as Utils from "./utils.js";

// Constants for thresholds and defaults
const POWER_SIGNIFICANCE_THRESHOLD = 0.01;
const MAX_SMOOTHING_SAMPLES = 20;
const MIN_REFRESH_RATE = 1;
const MAX_REFRESH_RATE = 60;

const BatteryMonitorIndicator = GObject.registerClass({
    Properties: {
        'refreshrate': GObject.ParamSpec.int(
            'refreshrate', 'Refresh Rate', 'The refresh rate in seconds',
            GObject.ParamFlags.READWRITE,
            MIN_REFRESH_RATE, MAX_REFRESH_RATE, 5),
        'decimal-places': GObject.ParamSpec.int(
            'decimal-places', 'Decimal Places', 'The number of decimal places',
            GObject.ParamFlags.READWRITE,
            0, 5, 1),
        'display-mode': GObject.ParamSpec.int(
            'display-mode', 'Display Mode', 'The display mode for the panel',
            GObject.ParamFlags.READWRITE,
            0, 2, 2),
        'smoothing-samples': GObject.ParamSpec.int(
            'smoothing-samples', 'Smoothing Samples', 'The number of samples to average',
            GObject.ParamFlags.READWRITE,
            1, MAX_SMOOTHING_SAMPLES, 10),
        'show-rate-unit': GObject.ParamSpec.boolean(
            'show-rate-unit', 'Show Rate Unit', 'Whether to show the %/h unit in the panel',
            GObject.ParamFlags.READWRITE,
            true),
        'show-icon': GObject.ParamSpec.boolean(
            'show-icon', 'Show Icon', 'Whether to show the battery icon in the panel',
            GObject.ParamFlags.READWRITE,
            true),
        'use-color-coding': GObject.ParamSpec.boolean(
            'use-color-coding', 'Use Color Coding', 'Whether to use red/green colors for battery status',
            GObject.ParamFlags.READWRITE,
            true),
    },
},
class BatteryMonitorIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _("Battery Monitor"));
        this._extension = extension;
        this._settings = this._extension.getSettings();
        this._batteryService = new BatteryService();

        // Layout container
        this._box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this.add_child(this._box);

        // Icon
        this._icon = new St.Icon({
            icon_name: 'battery-full-symbolic',
            style_class: 'system-status-icon',
        });
        this._box.add_child(this._icon);

        // Main label
        this._label = new St.Label({
            text: "---",
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._box.add_child(this._label);

        // Settings Binding
        this._settings.bind("refreshrate", this, "refreshrate", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("decimal-places", this, "decimal-places", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("display-mode", this, "display-mode", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("smoothing-samples", this, "smoothing-samples", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("show-rate-unit", this, "show-rate-unit", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("show-icon", this, "show-icon", Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind("use-color-coding", this, "use-color-coding", Gio.SettingsBindFlags.DEFAULT);

        // Connect to property changes
        this.connect('notify::refreshrate', () => this._startMonitoring());
        this.connect('notify::smoothing-samples', () => {
            this._batteryService.resetReadings();
            this._update();
        });

        ['decimal-places', 'display-mode', 'show-rate-unit', 'show-icon', 'use-color-coding'].forEach(prop => {
            this.connect(`notify::${prop}`, () => this._update());
        });

        this._setupFileMonitor();
        this._createMenu();
        this._update();
        this._startMonitoring();
    }

    _setupFileMonitor() {
        if (!this._batteryService.batteryPath) return;

        try {
            const statusFile = Gio.File.new_for_path(`${this._batteryService.batteryPath}/status`);
            this._monitor = statusFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', (m, f, other, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGED || eventType === Gio.FileMonitorEvent.CREATED) {
                    this._update();
                }
            });
        } catch (e) {
            console.error(`[BatteryMonitor] Error setting up file monitor: ${e}`);
        }
    }

    _createMenu() {
        this.menu.removeAll();

        this._powerUsageLabel = this._addMenuItem(_('Power usage: ...'));
        this._percentageRateLabel = this._addMenuItem(_('Rate: ...'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusLabel = this._addMenuItem(_('Status: ...'));
        this._timeLabel = this._addMenuItem(_('Time: ...'));
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        this._voltageLabel = this._addMenuItem(_('Voltage: ...'));
        this._healthLabel = this._addMenuItem(_('Health: ...'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_('Preferences'), () => this._extension.openPreferences());
    }

    _addMenuItem(text) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: true,
            can_focus: false,
        });
        item.activate = () => {};
        item.add_style_class_name('plain-text');
        const label = new St.Label({ text });
        item.add_child(label);
        this.menu.addMenuItem(item);
        return label;
    }

    _update() {
        try {
            const batteryData = this._batteryService.getBatteryData(this['smoothing-samples']);
            if (!batteryData) {
                this._label.set_text(this._batteryService.batteryPath ? "Error" : "No battery");
                return;
            }

            const { capacity, status, power, rate, isCharging } = batteryData;

            this._updateIcon(isCharging, capacity);
            this._updateLabel(power, rate, isCharging);
            this._updateMenu(power, rate, isCharging, capacity, status);
        } catch (e) {
            console.error(`[BatteryMonitor] Error during update: ${e}`);
            this._label.set_text("Error");
        }
    }

    _updateIcon(isCharging, capacity) {
        if (!this['show-icon']) {
            this._icon.hide();
        } else {
            this._icon.show();
            let iconName = 'battery-';
            if (isCharging) {
                iconName += 'charging-';
            }
            
            if (capacity < 10) iconName += 'caution';
            else if (capacity < 30) iconName += 'low';
            else if (capacity < 60) iconName += 'good';
            else if (capacity < 90) iconName += 'full';
            else iconName += 'full-charged';

            this._icon.icon_name = `${iconName}-symbolic`;
        }
        
        // Color coding
        if (this['use-color-coding']) {
            if (isCharging) {
                this._label.set_style('color: #2ec27e;'); // GNOME Green
            } else if (capacity < 20) {
                this._label.set_style('color: #e01b24;'); // GNOME Red
            } else {
                this._label.set_style(null);
            }
        } else {
            this._label.set_style(null);
        }
    }

    _updateLabel(power, rate, isCharging) {
        const decimalPlaces = this['decimal-places'];
        const powerStr = `${power.toFixed(decimalPlaces)}W`;
        const rateUnit = this['show-rate-unit'] ? '%/h' : '%';
        const rateStr = `${Math.abs(rate).toFixed(decimalPlaces)}${rateUnit}`;
        
        const sign = isCharging ? '+' : (power > POWER_SIGNIFICANCE_THRESHOLD ? '−' : '');

        let text;
        switch (this['display-mode']) {
            case 0: text = `${sign}${powerStr}`; break;
            case 1: text = `${sign}${rateStr}`; break;
            case 2:
            default: text = `${sign}${powerStr} | ${sign}${rateStr}`;
        }
        this._label.set_text(text);
    }

    _updateMenu(power, rate, isCharging, capacity, status) {
        const decimalPlaces = this['decimal-places'];
        const sign = isCharging ? '+' : (power > POWER_SIGNIFICANCE_THRESHOLD ? '−' : '');
        const displayRate = Math.abs(rate);

        this._powerUsageLabel.text = `${_('Power usage')}: ${sign}${power.toFixed(decimalPlaces)}W`;
        this._percentageRateLabel.text = `${_('Rate')}: ${sign}${displayRate.toFixed(decimalPlaces)}%/h`;
        this._statusLabel.text = `${_('Status')}: ${status} (${capacity}%)`;

        let timeText = '--';
        if (displayRate > 0) {
            const time = isCharging ? (100 - capacity) / displayRate : capacity / displayRate;
            if (time > 0 && isFinite(time)) {
                const hours = Math.floor(time);
                const minutes = Math.floor((time - hours) * 60);
                timeText = `${hours}h ${minutes}m`;
            }
        }
        this._timeLabel.text = `${_('Time')}: ${timeText}`;

        // Extra info
        const voltage = Utils.readBatteryInt(this._batteryService.batteryPath, 'voltage_now') / 1000000;
        this._voltageLabel.text = `${_('Voltage')}: ${voltage.toFixed(2)}V`;

        const health = Utils.getBatteryHealthInfo(this._batteryService.batteryPath);
        if (health) {
            this._healthLabel.text = `${_('Health')}: ${health.percent}% (${health.status})`;
        } else {
            this._healthLabel.text = `${_('Health')}: Unknown`;
        }
    }

    _startMonitoring() {
        this._stopMonitoring();
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.refreshrate * 1000, () => {
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
      if (this._monitor) {
          this._monitor.cancel();
          this._monitor = null;
      }
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
