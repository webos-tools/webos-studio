/*
 * Copyright (c) 2022-2023 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const { InputController } = require('./inputController');
const { getSimulatorDirPath } = require('./configUtils');
const { getSimulatorList, getCurrentDeviceProfile } = require('./deviceUtils');
const { getAppDir, getLaunchParams } = require('./commonInput');
const ares = require('./runCommand');

async function _getSimulatorVersion(title) {
    const simulatorDir = getSimulatorDirPath();
    const simulatorList = await getSimulatorList();

    if (simulatorList && simulatorList.length > 0) {
        const controller = new InputController();
        controller.addStep({
            title: title,
            placeholder: `Select webOS TV Version of Simulator (Location: ${simulatorDir})`,
            items: simulatorList.map(simulator => simulator.name).map(label => ({ label }))
        });
        const results = await controller.start();
        const simulatorName = results.shift().split('_');
        return simulatorName[2];
    } else {
        return null;
    }
}

async function _runSimulator(selectedDir, selectedVersion, withParams) {
    const title = withParams ? 'Run Application on Simulator with Parameters' : 'Run Application on Simulator';
    const prompt = 'Enter Directory Path to Run';
    const appDir = selectedDir || await getAppDir(title, prompt);
    const simulatorVersion = selectedVersion || await _getSimulatorVersion(title);
    const params = withParams ? await getLaunchParams(title) : null;

    return new Promise((resolve, reject) => {
        if (!simulatorVersion) {
            const errMsg = 'webOS TV Simulator is not installed.';
            reject(errMsg);
        } else {
            resolve({ appDir: appDir, simulatorVersion: simulatorVersion, params: params });
        }
    });
}

/**
 * @param {string} selectedDir directory path to run on the simulator
 * @param {string} selectedVersion webOS TV version of the simulator
 * @param {boolean} withParams whether to run an app with parameters or not
 */
module.exports = function runSimulator(selectedDir = null, selectedVersion = null, withParams = null) {
    require('../ga4Util').mpGa4Event("runSimulator", {category:"Commands"});
    getCurrentDeviceProfile()
            .then((data) => {
                if (data === 'tv') {
                    _runSimulator(selectedDir, selectedVersion, withParams)
                        .then((obj) => {
                            ares.launchSimulator(obj.appDir, obj.simulatorVersion, obj.params)
                                .then(() => {
                                    const paramsMsg = JSON.stringify(obj.params) === '{}' ? '' : ` with parameters ${JSON.stringify(obj.params)}`;
                                    vscode.window.showInformationMessage(`Success! ${obj.appDir} is running on webOS_TV_${obj.simulatorVersion}_Simulator${paramsMsg}.`);
                                }).catch((err) => {
                                    let errMsg = `Failed to run a simulator.`;
                                    if (err) errMsg = err;
                                    vscode.window.showErrorMessage(`Error! ${errMsg}`);
                                });
                        }).catch((err) => {
                            let errMsg = `Failed to run a simulator.`;
                            if (err) errMsg = err;
                            vscode.window.showErrorMessage(`Error! ${errMsg}`);
                        });
                } else {
                    vscode.window.showInformationMessage(`Only TV Profile supports Simulator.`);
                    return;
                }
            });
};