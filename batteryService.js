/* batteryService.js
 *
 * Logic for battery data calculation.
 */

import * as Utils from "./utils.js";

const MICROWATTS_PER_WATT = 1000000;
const MICROVOLTS_PER_VOLT = 1000000;
const MICROAMPS_PER_AMP = 1000000;

export class BatteryService {
    constructor() {
        this.batteryPath = Utils.findBatteryPath();
        this._chargingReadings = [];
        this._dischargingReadings = [];
    }

    getBatteryData(smoothingSamples) {
        if (!this.batteryPath) return null;

        try {
            const capacity = Utils.readBatteryInt(this.batteryPath, 'capacity');
            const status = Utils.readBatteryFile(this.batteryPath, 'status') || 'Unknown';
            const isCharging = status === 'Charging';

            const power = this._calculatePower();
            const rate = this._calculateRate(isCharging, capacity, power, smoothingSamples);

            return { capacity, status, power, rate, isCharging };
        } catch (e) {
            console.error(`[BatteryMonitor] Error reading battery data: ${e}`);
            return null;
        }
    }

    _calculatePower() {
        let power = 0;
        try {
            const powerNow = Utils.readBatteryInt(this.batteryPath, 'power_now');
            if (powerNow > 0) {
                power = powerNow / MICROWATTS_PER_WATT;
            } else {
                const current = Utils.readBatteryInt(this.batteryPath, 'current_now');
                const voltage = Utils.readBatteryInt(this.batteryPath, 'voltage_now');
                power = (current / MICROAMPS_PER_AMP) * (voltage / MICROVOLTS_PER_VOLT);
            }
        } catch (e) {
            console.error(`[BatteryMonitor] Error calculating power: ${e}`);
        }
        return power;
    }

    _calculateRate(isCharging, capacity, power, smoothingSamples) {
        let rate = 0;
        try {
            rate = this._calculateRateFromEnergy(power);
            if (rate === 0) {
                rate = this._calculateRateFromCharge(power);
            }

            if (!isCharging) {
                rate = -rate;
            }

            this._updateSmoothingReadings(rate, isCharging, smoothingSamples);
            rate = this._getSmoothedRate(isCharging);
        } catch (e) {
            console.error(`[BatteryMonitor] Error calculating rate: ${e}`);
        }
        return rate;
    }

    _calculateRateFromEnergy(power) {
        const energyFull = Utils.readBatteryInt(this.batteryPath, 'energy_full') || Utils.readBatteryInt(this.batteryPath, 'energy_full_design');
        if (energyFull > 0) {
            const energyFullWh = energyFull / MICROWATTS_PER_WATT;
            return (power / energyFullWh) * 100;
        }
        return 0;
    }

    _calculateRateFromCharge(power) {
        const chargeFull = Utils.readBatteryInt(this.batteryPath, 'charge_full') || Utils.readBatteryInt(this.batteryPath, 'charge_full_design');
        const voltage = Utils.readBatteryInt(this.batteryPath, 'voltage_now');
        if (chargeFull > 0 && voltage > 0) {
            const chargeFullAh = chargeFull / MICROAMPS_PER_AMP;
            const voltageV = voltage / MICROVOLTS_PER_VOLT;
            const energyFullCalcWh = chargeFullAh * voltageV;
            if (energyFullCalcWh > 0) {
                return (power / energyFullCalcWh) * 100;
            }
        }
        return 0;
    }

    _updateSmoothingReadings(rate, isCharging, smoothingSamples) {
        const readings = isCharging ? this._chargingReadings : this._dischargingReadings;
        readings.push(rate);
        while (readings.length > smoothingSamples) {
            readings.shift();
        }
    }

    _getSmoothedRate(isCharging) {
        const readings = isCharging ? this._chargingReadings : this._dischargingReadings;
        if (readings.length === 0) return 0;
        return readings.reduce((a, b) => a + b, 0) / readings.length;
    }

    resetReadings() {
        this._chargingReadings = [];
        this._dischargingReadings = [];
    }
}
