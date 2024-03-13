/*
 * Copyright (c) 2020-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const { getDeviceList, getInstalledList } = require('./lib/deviceUtils');
const ares = require('./lib/runCommand');

/**
 * @param {string} appId app ID to inspect
 * @param {string} device target device name
 */
module.exports = async function inspectApp_ipk(appId, device) {
    if (!device) {
        let  deviceList = await getDeviceList();
         deviceList = deviceList.filter((device) => {
             return device.default === true;
         })
 
         device = deviceList[0].name;
     }
    return new Promise((resolve, reject) => {
        
        // ares-inspect
        ares.inspect(appId, device,false)
            .then((rObject) => {
              let  url =rObject[0].toString()
                vscode.window.showInformationMessage(`Web inspector is running on ${url}`);
                // open browser
                ares.openBrowser(url);
                resolve();
            }).catch((err) => {
                console.error(err);
                vscode.window.showErrorMessage(`Error! Failed to run a web inspector.`);
                reject(err);
            });
    });
};