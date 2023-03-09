/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const { InputController } = require('./lib/inputController');
const { getDeviceList } = require('./lib/deviceUtils');
const packageApp = require('./packageApp');
const installApp = require('./installApp');
const launchApp = require('./launchApp');
const inspectApp = require('./inspectApp');

async function _getDebugOption(title) {
    const controller = new InputController();
    controller.addStep({
        title: title,
        placeholder: 'Debug in IDE or Browser?',
        items: ['IDE', 'BROWSER'].map(label => ({ label }))
    });
    const results = await controller.start();
    const debugoption = results.shift() === 'IDE';
    return debugoption;
}

module.exports = async function runApp(isDebug) {
    try {
        let device = null;
        let deviceList = await getDeviceList();

        deviceList = deviceList.filter((device) => {
            return device.default === true;
        })

        device = deviceList[0].name;

        if (!device) {
            let controller = new InputController();
            controller.addStep({
                title: isDebug ? 'Debug Application' : 'Run Application',
                placeholder: 'Select Target Device',
                items: deviceList.map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
            });

            let results = await controller.start();
            let deviceName = results.shift();
            deviceName = deviceName.slice(0, deviceName.indexOf(' ('));
            device = deviceName;
        }

        const debugoption = await _getDebugOption('Start Debug Application');

        packageApp()
            .then((ipkPath) => {
                return installApp(ipkPath, device);
            }).then((obj) => {
                if (isDebug) {
                    inspectApp(obj.appId, device, false, debugoption);
                } else {
                    launchApp(obj.appId, device);
                }
            })

    } catch (err) {
        console.error(err);
    }
}
