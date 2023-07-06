/*
 * Copyright (c) 2020-2023 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const { InputController } = require('./inputController');
const { InputChecker } = require('./inputChecker');
const { getDefaultDevice, getDeviceList } = require('./deviceUtils');
const ares = require('./runCommand');

async function _getDefaultDevice() {
    let device = await getDefaultDevice();
    if (device === 'emulator') {
        vscode.window.showWarningMessage(`Warning! 'emulator' does not need to set up SSH key.`);
        device = null;
    }
    return device;
}

async function _getDevice(title) {
    let deviceList = await getDeviceList();
    deviceList = deviceList.filter(_device => _device.name !== 'emulator');
    if (deviceList.length === 0) return null;

    const controller = new InputController();
    controller.addStep({
        title: title,
        placeholder: 'Select Target Device',
        items: deviceList.map(item => `${item.name} (${item.username}@${item.ip}:${item.port})`).map(label => ({ label }))
    });
    const results = await controller.start();
    const device = results.shift();
    return device.slice(0, device.indexOf(' ('));
}

async function _getPassphrase(title) {
    const controller = new InputController();
    controller.addStep({
        title: title,
        placeholder: 'Enter Passphrase',
        prompt: 'Enter Passphrase',
        validator: InputChecker.checkPassphrase
    });
    const results = await controller.start();
    const passphrase = results.shift();
    return passphrase;
}

/**
 * @param {string} deviceName  target device name to get a private key from
 */
module.exports = async function getKey(deviceName) {
    const title = 'Set Up SSH Key';
    const device = deviceName || await _getDefaultDevice() || await _getDevice(title);
    if (device === null) {
        vscode.window.showErrorMessage(`Error! Add the device before setting up the SSH key.`);
        vscode.commands.executeCommand('webososeDevices.focus');
        return;
    }
    const passphrase = await _getPassphrase(title);

    await ares.novacomGetkey(device, passphrase)
        .then(() => {
            vscode.window.showInformationMessage(`Success! Set the SSH private key from '${device}'.`);
        }).catch(() => {
            vscode.window.showErrorMessage(`Error! Please make sure the 'Key Server' is on and the 'Passphrase' is correct.`);
        });
};