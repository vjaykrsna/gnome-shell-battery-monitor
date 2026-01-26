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
    return new Promise((resolve) => {
        const basePath = '/sys/class/power_supply';
        const powerSupplyDir = Gio.File.new_for_path(basePath);
        try {
            const enumerator = powerSupplyDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let fileInfo;
            const checkNext = () => {
                fileInfo = enumerator.next_file(null);
                if (!fileInfo) {
                    enumerator.close(null);
                    resolve(null);
                    return;
                }
                const name = fileInfo.get_name();
                const path = `${basePath}/${name}`;
                const typeFile = Gio.File.new_for_path(`${path}/type`);
                if (typeFile.query_exists(null)) {
                    typeFile.load_contents_async(null, (source, result) => {
                        try {
                            const [success, contents] = source.load_contents_finish(result);
                            if (success && decode(contents).trim() === 'Battery') {
                                enumerator.close(null);
                                resolve(path);
                                return;
                            }
                        } catch (e) {
                            // Continue
                        }
                        checkNext();
                    });
                } else {
                    checkNext();
                }
            };
            checkNext();
        } catch (e) {
            resolve(null);
        }
    });
}

export function readBatteryFile(batteryPath, fileName) {
    return new Promise((resolve) => {
        if (!batteryPath) {
            resolve(null);
            return;
        }
        try {
            const file = Gio.File.new_for_path(`${batteryPath}/${fileName}`);
            file.load_contents_async(null, (source, result) => {
                try {
                    const [success, contents] = source.load_contents_finish(result);
                    resolve(success ? decode(contents).trim() : null);
                } catch (e) {
                    resolve(null);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });
}

export function readBatteryInt(batteryPath, fileName) {
    return readBatteryFile(batteryPath, fileName).then(val => val ? parseInt(val) : 0);
}

export async function getBatteryHealthInfo(batteryPath) {
    const currentFull = await readBatteryInt(batteryPath, "charge_full") || await readBatteryInt(batteryPath, "energy_full");
    const designFull = await readBatteryInt(batteryPath, "charge_full_design") || await readBatteryInt(batteryPath, "energy_full_design");

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
