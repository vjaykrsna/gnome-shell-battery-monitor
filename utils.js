/* utils.js
 *
 * Shared utilities for Battery Monitor extension.
 */

import Gio from "gi://Gio";

const decoder = new TextDecoder();

export function decode(contents) {
    return decoder.decode(contents);
}

export function findBatteryPath() {
    const basePath = '/sys/class/power_supply';
    const powerSupplyDir = Gio.File.new_for_path(basePath);
    try {
        const enumerator = powerSupplyDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
            const name = fileInfo.get_name();
            const path = `${basePath}/${name}`;
            const typeFile = Gio.File.new_for_path(`${path}/type`);
            if (typeFile.query_exists(null)) {
                const [success, contents] = typeFile.load_contents(null);
                if (success && decode(contents).trim() === 'Battery') {
                    return path;
                }
            }
        }
    } catch (e) {
        console.error(`[BatteryMonitor] Error finding battery path: ${e}`);
    }
    return null;
}

export function readBatteryFile(batteryPath, fileName) {
    if (!batteryPath) return null;
    try {
        const file = Gio.File.new_for_path(`${batteryPath}/${fileName}`);
        const [success, contents] = file.load_contents(null);
        return success ? decode(contents).trim() : null;
    } catch (e) {
        return null;
    }
}

export function readBatteryInt(batteryPath, fileName) {
    const val = readBatteryFile(batteryPath, fileName);
    return val ? parseInt(val) : 0;
}

export function getBatteryHealthInfo(batteryPath) {
    const currentFull = readBatteryInt(batteryPath, "charge_full") || readBatteryInt(batteryPath, "energy_full");
    const designFull = readBatteryInt(batteryPath, "charge_full_design") || readBatteryInt(batteryPath, "energy_full_design");

    if (!currentFull || !designFull) return null;

    const healthPercent = ((currentFull / designFull) * 100).toFixed(2);
    let healthStatus;
    if (healthPercent >= 80) healthStatus = "Excellent";
    else if (healthPercent >= 60) healthStatus = "Good";
    else if (healthPercent >= 40) healthStatus = "Fair";
    else healthStatus = "Poor";

    return {
        percent: healthPercent,
        status: healthStatus
    };
}
