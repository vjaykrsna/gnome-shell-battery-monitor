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
import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class BatteryMonitorPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
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
    settings.bind("display-mode", displayModeRow, "selected-item", Gio.SettingsBindFlags.DEFAULT);

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
