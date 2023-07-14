/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { InputController } = require('./lib/inputController');
const { InputChecker } = require('./lib/inputChecker');
const { getDeviceList, getCurrentDeviceProfile, setCurrentDeviceProfile } = require('./lib/deviceUtils');
const ares = require('./lib/runCommand');

async function _setDeviceInfo(device) {
    let defaultIp = '127.0.0.1'
    let defaultPort = '22'
    let defaultUsername = 'root'
    if (device) {
        defaultIp = device.ip;
        defaultPort = device.port;
        defaultUsername = device.username;
    }

    let controller = new InputController();
    controller.addStep({
        title: 'Define Device Information',
        totalSteps: 3,
        step: 1,
        placeholder: `IP Address (default: ${defaultIp})`,
        prompt: 'Enter IP Address',
        validator: InputChecker.checkIPAddress
    });
    controller.addStep({
        title: 'Define Device Information',
        totalSteps: 3,
        step: 2,
        placeholder: `Port (default: ${defaultPort})`,
        prompt: 'Enter Port',
        validator: InputChecker.checkPort
    });
    controller.addStep({
        title: 'Define Device Information',
        totalSteps: 3,
        step: 3,
        placeholder: `Username (default: ${defaultUsername})`,
        prompt: 'Enter SSH Username'
    });

    let results = await controller.start();
    let info = {};
    info.host = results.shift() || defaultIp;
    info.port = results.shift() || defaultPort;
    info.username = results.shift() || defaultUsername;

    return info;
}

async function addDevice(deviceList) {
    if (deviceList.length > 19) {
        vscode.window.showErrorMessage(`Error! Failed to add the device, you have reached max limit`);
    } else {
        let controller = new InputController();
        controller.addStep({
            title: 'Define Device Information',
            placeholder: 'Enter Device Name',
            prompt: 'Enter Device Name',
            validator: function (value) {
                value = value.trim();
                let result = InputChecker.checkDeviceName(value);
                if (!result) {
                    if (deviceList.map(device => device.name).includes(value)) {
                        return `'${value}' already exists. Please specify another name.`;
                    } else {
                        return null;
                    }
                } else {
                    return result;
                }
            }
        });

        let results = await controller.start();
        let name = results.shift();
        let info = await _setDeviceInfo();

        await ares.setupDeviceAdd(name, info)
            .then(() => {
                vscode.window.showInformationMessage(`Success! Added the device '${name}'.`);
            }).catch((err) => {
                vscode.window.showErrorMessage(`Error! Failed to add the device '${name}'. ${err}`);
            })
    }

}

async function modifyDevice(deviceList, deviceName) {
    let name = deviceName;
    if (!deviceName) {
        let controller = new InputController();
        controller.addStep({
            title: 'Modify Device',
            placeholder: 'Select a Device to Modify',
            items: deviceList.map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
        });

        let results = await controller.start();
        name = results.shift();
        name = name.slice(0, name.indexOf(' ('));
    }

    let device;
    for (let i in deviceList) {
        if (name === deviceList[i].name) {
            device = deviceList[i];
            break;
        }
    }
    let info = await _setDeviceInfo(device);

    await ares.setupDeviceModify(name, info)
        .then(() => {
            vscode.window.showInformationMessage(`Success! Modified the device '${name}'.`);
        }).catch((err) => {
            console.error(err);
            vscode.window.showErrorMessage(`Error! Failed to modify the device '${name}'.`);
        })
}

async function removeDevice(deviceList, deviceName) {
    let name = deviceName;
    let isConfirmed = false;
    if (!deviceName) {
        let controller = new InputController();
        controller.addStep({
            title: 'Remove Device',
            totalSteps: 2,
            step: 1,
            placeholder: 'Select a Device to Remove',
            items: deviceList.filter(device => device.name !== 'emulator').map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
        });
        controller.addStep({
            title: 'Remove Device',
            totalSteps: 2,
            step: 2,
            placeholder: 'Confirm to Remove the Device',
            items: ['Confirm'].map(label => ({ label }))
        });

        let results = await controller.start();
        name = results.shift();
        name = name.slice(0, name.indexOf(' ('));
        let confirm = results.shift();
        if (confirm.match(/(confirm)/i)) {
            isConfirmed = true;
        }
    } else {
        let controller = new InputController();
        controller.addStep({
            title: 'Remove Device',
            placeholder: 'Confirm to Remove the Device',
            items: ['Confirm'].map(label => ({ label }))
        });
        let results = await controller.start();
        let confirm = results.shift();
        if (confirm.match(/(confirm)/i)) {
            isConfirmed = true;
        }
    }

    if (isConfirmed) {
        await ares.setupDeviceRemove(name)
            .then(() => {
                vscode.window.showInformationMessage(`Success! Removed the device '${name}'.`);
            }).catch((err) => {
                console.error(err);
                vscode.window.showErrorMessage(`Error! Failed to remove the device '${name}'.`);
            })
    }
}

async function setupDevice(deviceOption, deviceName) {
    let option;
    let options = [
        'Add Device',
        'Modify Device',
        'Remove Device'
    ];

    if (!deviceOption || !deviceOption.match(/(add|modify|remove)/i)) {
        let controller = new InputController();
        controller.addStep({
            title: 'Set Up Device',
            items: options.map(label => ({ label }))
        });
        let result = await controller.start();
        option = result.shift();
    } else {
        if (deviceOption.match(/(add)/i)) {
            option = options[0];
        } else if (deviceOption.match(/(modify)/i)) {
            option = options[1];
        } else if (deviceOption.match(/(remove)/i)) {
            option = options[2];
        }
    }

    let deviceList = await getDeviceList();
    switch (option) {
        case options[0]:
            await addDevice(deviceList);
            break;
        case options[1]:
            await modifyDevice(deviceList, deviceName);
            break;
        case options[2]:
            await removeDevice(deviceList, deviceName);
            break;
        default:
            break;
    }
}

async function setDeviceProfile(profile) {
    if (typeof profile === 'undefined') {
        const controller = new InputController();
        const profileList = ['ose', 'tv'];
        
        controller.addStep({
            title: 'Choose Device Profile',
            placeholder: `Select Device Profile`,
            items: profileList.map(label => ({ label }))
        });

        const results = await controller.start();
        profile = results.shift();
    }
    const ret = await setCurrentDeviceProfile(profile);
    return {ret, profile};
}       

module.exports = {
    setupDevice: setupDevice,
    setDeviceProfile: setDeviceProfile
}