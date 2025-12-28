/* prefs.js
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

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import * as Utils from "./utils.js";

export default class BatteryMonitorPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    // Find battery path
    this._batteryPath = Utils.findBatteryPath();

    const settings = this.getSettings();
    const page = new Adw.PreferencesPage();
    
    const settingsGroup = new Adw.PreferencesGroup({
      title: _("Settings"),
    });
    page.add(settingsGroup);

    // Refresh Rate
    const refreshRateRow = new Adw.SpinRow({
        title: _("Refresh Rate"),
        subtitle: _("How often to update the battery info (in seconds)"),
        adjustment: new Gtk.Adjustment({ lower: 1, upper: 60, step_increment: 1 }),
    });
    settingsGroup.add(refreshRateRow);
    settings.bind("refreshrate", refreshRateRow.adjustment, "value", Gio.SettingsBindFlags.DEFAULT);

    // Decimal Places
    const decimalPlacesRow = new Adw.SpinRow({
        title: _("Decimal Places"),
        subtitle: _("Number of decimal places for displayed values"),
        adjustment: new Gtk.Adjustment({ lower: 0, upper: 5, step_increment: 1 }),
    });
    settingsGroup.add(decimalPlacesRow);
    settings.bind("decimal-places", decimalPlacesRow.adjustment, "value", Gio.SettingsBindFlags.DEFAULT);

    // Smoothing Samples
    const smoothingSamplesRow = new Adw.SpinRow({
        title: _("Smoothing Level"),
        subtitle: _("Number of samples to average. Higher is smoother but less responsive."),
        adjustment: new Gtk.Adjustment({ lower: 1, upper: 20, step_increment: 1 }),
    });
    settingsGroup.add(smoothingSamplesRow);
    settings.bind("smoothing-samples", smoothingSamplesRow.adjustment, "value", Gio.SettingsBindFlags.DEFAULT);

    // Display Mode
    const displayModeRow = new Adw.ComboRow({
        title: _("Panel Display Mode"),
        subtitle: _("What to show in the top panel"),
        model: new Gtk.StringList({ strings: ["Watts", "%/h", "Both"] }),
    });
    settingsGroup.add(displayModeRow);
    settings.bind("display-mode", displayModeRow, "selected", Gio.SettingsBindFlags.DEFAULT);

    // Show Rate Unit Switch
    const showRateUnitRow = new Adw.SwitchRow({
        title: _("Show '%/h' Unit"),
        subtitle: _("Display the '%/h' unit next to the rate value in the panel"),
    });
    settingsGroup.add(showRateUnitRow);
    settings.bind("show-rate-unit", showRateUnitRow, "active", Gio.SettingsBindFlags.DEFAULT);

    // Show Icon Switch
    const showIconRow = new Adw.SwitchRow({
        title: _("Show Battery Icon"),
        subtitle: _("Display a battery icon in the panel"),
    });
    settingsGroup.add(showIconRow);
    settings.bind("show-icon", showIconRow, "active", Gio.SettingsBindFlags.DEFAULT);

    // Use Color Coding Switch
    const useColorCodingRow = new Adw.SwitchRow({
        title: _("Use Color Coding"),
        subtitle: _("Use green for charging and red for low battery"),
    });
    settingsGroup.add(useColorCodingRow);
    settings.bind("use-color-coding", useColorCodingRow, "active", Gio.SettingsBindFlags.DEFAULT);

    // Battery Health Section
    const batteryHealthGroup = new Adw.PreferencesGroup({
        title: _("Battery Health"),
    });
    page.add(batteryHealthGroup);

    // Battery Health Percentage
    const health = Utils.getBatteryHealthInfo(this._batteryPath);
    const healthRow = new Adw.ActionRow({
        title: _("Battery Health"),
        subtitle: health ? `${health.percent}% (${health.status})` : _("Unable to calculate health"),
    });
    batteryHealthGroup.add(healthRow);

    // Cycle Count
    const cycleCountRow = new Adw.ActionRow({
        title: _("Cycle Count"),
        subtitle: Utils.readBatteryFile(this._batteryPath, "cycle_count") || _("Not supported"),
    });
    batteryHealthGroup.add(cycleCountRow);

    // Manufacturer
    const manufacturerRow = new Adw.ActionRow({
        title: _("Manufacturer"),
        subtitle: Utils.readBatteryFile(this._batteryPath, "manufacturer") || _("Not available"),
    });
    batteryHealthGroup.add(manufacturerRow);

    // Model
    const modelRow = new Adw.ActionRow({
        title: _("Model"),
        subtitle: Utils.readBatteryFile(this._batteryPath, "model_name") || _("Not available"),
    });
    batteryHealthGroup.add(modelRow);

    // Technology
    const technologyRow = new Adw.ActionRow({
        title: _("Technology"),
        subtitle: Utils.readBatteryFile(this._batteryPath, "technology") || _("Not available"),
    });
    batteryHealthGroup.add(technologyRow);

    // About Section
    const aboutGroup = new Adw.PreferencesGroup({
        title: _("About"),
    });
    page.add(aboutGroup);

    const aboutRow = new Adw.ActionRow({
        title: _("Battery Monitor"),
        subtitle: _("This extension helps you track power consumption and charging/discharging rates."),
    });
    aboutGroup.add(aboutRow);

    window.add(page);
  }
}
