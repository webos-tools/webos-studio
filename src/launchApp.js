/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { InputController } = require('./lib/inputController');
const { getDeviceList, getInstalledList } = require('./lib/deviceUtils');
const notify = require('./lib/notificationUtils');
const ares = require('./lib/runCommand');
const { getLaunchParams } = require('./lib/commonInput');
const ga4Util = require('./ga4Util');

module.exports = async function launchApp(id, deviceName, displayId, withParams) {
    const title = withParams ? 'Launch Application with Parameters' : 'Launch Application';
    let appId = id;
    let device = deviceName;
    let deviceList;
    let dp = displayId ? displayId : 0;

    if (!deviceName) {
        // device = await getDefaultDevice();
        device = null;
        deviceList = await getDeviceList();

        // set default device
        deviceList = deviceList.filter((device) => {
            return device.default === true;
        });
        device = deviceList[0].name;

        // check default device is in the device list
        // let deviceNameList = deviceList.map(device => device.name);
        // if (!deviceNameList.includes(device)) {
        //     vscode.window.showWarningMessage(`Warning! The default device(${device}) is not in the device list.`);
        //     device = null;
        // }
    }

    if (!id || !device) {
        let controller = new InputController();
        if (!device) {
            controller.addStep({
                title,
                placeholder: 'Select Target Device',
                items: deviceList.map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
            });
            let results = await controller.start();
            device = results.shift();
            device = device.slice(0, device.indexOf(' ('));
        }

        let controller2 = new InputController();
        let installed = await getInstalledList(device);
        if (installed.length === 0) {
            vscode.window.showErrorMessage(`ERROR! No apps are installed on ${device}.`);
            vscode.commands.executeCommand('webososeDevices.focus');
            return;
        }
        controller2.addStep({
            title,
            placeholder: 'Select App ID',
            items: installed.map(label => ({ label }))
        });
        let results2 = await controller2.start();
        appId = results2.shift();

        let controller3 = new InputController();
        let displayArr = ['display 0', 'display 1'];
        controller3.addStep({
            title,
            placeholder: 'Select Display Id',
            items: displayArr.map(label => ({ label }))
        });
        let results3 = await controller3.start();
        if ((results3.shift()) === displayArr[0]) {
            dp = 0;
        }
        else {
            dp = 1;
        }
    }
    const params = withParams ? await getLaunchParams(title) : {};

    return new Promise((resolve, reject) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                console.log("User canceled the long running operation");
                return Promise.reject("CANCEL! Process ened by user..");
            });
            // let progress = await notify.initProgress("generate application", true);
            await notify.showProgress(progress, 20, `Preparing to launch ${appId}`);
            ga4Util.mpGa4Event("LaunchApp", {category:"Commands", target:device});
            await ares.launch(appId, device, params, dp)
                .then(async () => {
                    const paramsMsg = JSON.stringify(params) === '{}' ? '' : ` with parameters ${JSON.stringify(params)}`;
                    await notify.clearProgress(progress, `Success! Launched ${appId} on ${device}${paramsMsg}.`);
                    resolve();
                }).catch(async (err) => {
                    let errMsg = `Failed to launch ${appId} on ${device}.`
                    if (err.includes(`Connection time out`)) {
                        errMsg = `Please check ${device}'s IP address or port.`
                    }
                    await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                    let erMsg = err.toString();
                    vscode.window.showErrorMessage(`ERROR! ${errMsg}. Details As follows: ${erMsg}`);
                    reject(err);
                });
        });
    })
}
