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
        this.batteryPath = null; // Will be set asynchronously later
        this._chargingReadings = [];
        this._dischargingReadings = [];
        this._lastCharging = null;
    }

    async getBatteryData(smoothingSamples) {
        if (!this.batteryPath) {
            this.batteryPath = await Utils.findBatteryPath();
        }
        if (!this.batteryPath) return null;

        try {
            const capacity = await Utils.readBatteryInt(this.batteryPath, 'capacity');
            const status = await Utils.readBatteryFile(this.batteryPath, 'status') || 'Unknown';
            const isCharging = status === 'Charging';

            const power = await this._calculatePower();
            const rate = await this._calculateRate(isCharging, capacity, power, smoothingSamples);

            return { capacity, status, power, rate, isCharging };
        } catch (e) {
            console.error(`[BatteryMonitor] Error reading battery data: ${e}`);
            return null;
        }
    }

    async _calculatePower() {
        let power = 0;
        try {
            const powerNow = await Utils.readBatteryInt(this.batteryPath, 'power_now');
            if (powerNow > 0) {
                power = powerNow / MICROWATTS_PER_WATT;
            } else {
                const current = await Utils.readBatteryInt(this.batteryPath, 'current_now');
                const voltage = await Utils.readBatteryInt(this.batteryPath, 'voltage_now');
                power = (current / MICROAMPS_PER_AMP) * (voltage / MICROVOLTS_PER_VOLT);
            }
        } catch (e) {
            console.error(`[BatteryMonitor] Error calculating power: ${e}`);
        }
        return power;
    }

    async _calculateRate(isCharging, capacity, power, smoothingSamples) {
        let rate = 0;
        try {
            rate = await this._calculateRateFromEnergy(power);
            if (rate === 0) {
                rate = await this._calculateRateFromCharge(power);
            }

            if (!isCharging) {
                rate = -rate;
            }

            if (this._lastCharging !== null && this._lastCharging !== isCharging) {
                this.resetReadings();
            }
            this._lastCharging = isCharging;

            this._updateSmoothingReadings(rate, isCharging, smoothingSamples);
            rate = this._getSmoothedRate(isCharging);
        } catch (e) {
            console.error(`[BatteryMonitor] Error calculating rate: ${e}`);
        }
        return rate;
    }

    async _calculateRateFromEnergy(power) {
        const energyFull = await Utils.readBatteryInt(this.batteryPath, 'energy_full');
        const energyFullDesign = await Utils.readBatteryInt(this.batteryPath, 'energy_full_design');
        const energyFullValue = energyFull || energyFullDesign;
        if (energyFullValue > 0) {
            const energyFullWh = energyFullValue / MICROWATTS_PER_WATT;
            return (power / energyFullWh) * 100;
        }
        return 0;
    }

    async _calculateRateFromCharge(power) {
        const [chargeFull, chargeFullDesign, voltage] = await Promise.all([
            Utils.readBatteryInt(this.batteryPath, 'charge_full'),
            Utils.readBatteryInt(this.batteryPath, 'charge_full_design'),
            Utils.readBatteryInt(this.batteryPath, 'voltage_now')
        ]);
        const chargeFullValue = chargeFull || chargeFullDesign;
        if (chargeFullValue > 0 && voltage > 0) {
            const chargeFullAh = chargeFullValue / MICROAMPS_PER_AMP;
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
