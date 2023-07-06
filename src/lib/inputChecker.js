/*
  * Copyright (c) Samsung Electronics Co.,Ltd.
  * https://github.com/Samsung/vscode-extension-tizentv
  * SPDX-License-Identifier: Apache-2.0
  * Modified from the original to apply to webOS Studio
  */
const fs = require('fs');
const path = require('path');
const { getDefaultDir } = require('./workspaceUtils');

function matchReg(value, reg) {
    let match = value.match(reg);
    if (match != null) {
        if (match.length == 1 && match[0] == value) {
            return true;
        }
    }
    return false;
}

function getAbsolutePath(value) {
    if (!path.isAbsolute(value)) {
        let defaultDir = getDefaultDir();
        if (defaultDir) {
            return path.join(defaultDir, value);
        } else {
            return null;
        }
    } else {
        return value;
    }
}

class InputChecker {
    constructor() { }

    static checkDirectoryName(value) {
        if (!matchReg(value, /[a-zA-Z0-9-._]+/g)) {
            return 'Please include only letters(A-Z,a-z), digits(0-9), underscore & minus signs.';
        }
        return null;
    }

    static checkDirectoryExist(value) {
        let absolutePath = getAbsolutePath(value);
        if (!absolutePath) {
            return 'Please enter an absolute path.';
        }
        if (!fs.existsSync(absolutePath)) {
            return 'Please enter an existing path.';
        } else {
            let stats = fs.statSync(absolutePath);
            if (!stats.isDirectory()) {
                return 'Please enter the directory path.';
            }
        }
        return null;
    }

    static checkAppInfoExists(value) {
        let absolutePath = getAbsolutePath(value);
        if (!fs.existsSync(path.join(absolutePath, 'appinfo.json'))) {
            return "Please select App Directory.";
        }
        return null;
    }
    static checkServiceExists(value) {
        let absolutePath = getAbsolutePath(value);
        if (!fs.existsSync(path.join(absolutePath, 'services.json'))) {
            return "Please select Service Directory.";
        }
        return null;
    }
    static checkAppsService(value, appId) {
        let absolutePath = getAbsolutePath(value);
        let rawdata = fs.readFileSync(path.join(absolutePath, 'services.json'), 'utf8');
        let serviceInfo = JSON.parse(rawdata);
        if (serviceInfo["id"].indexOf(appId) != 0) {
            return "App and service ID not related.";
        }
        return null;
    }

    static checkAppId(value) {
        if (value === '') {
            return null;
        }

        if (value.length < 2) {
            return 'Please enter more than 2 characters.';
        }

        if (!matchReg(value, /[a-z0-9-.]+/g)) {
            return 'Please include only lowercase letters(a-z), digits(0-9), minus signs.';
        }

        if (!matchReg(value, /^[a-z0-9][a-z0-9-.]+/g)) {
            return 'Please start with an alphanumeric character.';
        }

        let idFrags = value.split('.');
        if (idFrags.length >= 2 && idFrags[0] === 'com') {
            let notAllowed = ['palm', 'webos', 'lge', 'palmdts'];
            let usingNotAllowed = null;
            notAllowed.forEach(domain => {
                if (domain === idFrags[1]) {
                    usingNotAllowed = domain;
                    return;
                }
            })
            if (usingNotAllowed) {
                return `Please do not start with 'com.${usingNotAllowed}'`;
            }
        }

        return null;
    }

    static checkVersion(value) {
        if (value === '') {
            return null;
        }

        let verFrags = value.split('.');
        if (verFrags.length !== 3) {
            return 'Please enter the version in format: 1.0.0'
        }

        let errorText = null;
        verFrags.forEach(ver => {
            if (ver.match(/[^0-9]/)) {
                errorText = 'Please enter only non-negative integers in format: 1.0.0'
            } else if (ver.match(/^0\d+/)) {
                errorText = 'Please do not contain leading zeros.';
                return;
            } else if (!matchReg(ver, /^0|^[1-9]\d{0,8}/)) {
                errorText = 'Please enter each number 9 digits or less.';
                return;
            }
        })
        return errorText;
    }

    static checkDeviceName(value) {
        if (value === '') {
            return 'Please enter the device name.';
        }
        if (value.length === 1) {
            return 'Please enter the device name with a minimum of 2 characters.';
        }
        if (!matchReg(value, /[a-z0-9-.]+/g)) {
            return 'Please include only lowercase letters(a-z), digits(0-9), minus signs.';
        }
        if (!matchReg(value, /^[a-z0-9][a-z0-9-.]+/g)) {
            return 'Please start with an alphanumeric character.';
        }

        return null;
    }

    static checkIPAddress(value) {
        if (value === '') {
            return null;
        }

        let ipFrags = value.split('.');
        if (ipFrags.length !== 4) {
            return 'Please enter the IP address in format: 127.0.0.1'
        }

        let invalid = false;
        ipFrags.forEach(ip => {
            if (!matchReg(ip, /25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d/)) {
                invalid = true;
                return;
            }
        })
        if (invalid) {
            return 'Please enter the IP address in format: 127.0.0.1'
        }

        return null;
    }

    static checkPort(value) {
        if (value === '') {
            return null;
        }

        if (value.match(/^0\d+/)) {
            return 'Please do not contain leading zeroes.';
        }
        if (!matchReg(value, /^0|^\d+/)) {
            return 'Please enter only non-negative integers.';
        }

        return null;
    }

    static checkIpkFile(value) {
        if (value === '') {
            return 'Please enter the app file.';
        }

        let absolutePath = getAbsolutePath(value);
        if (!absolutePath) {
            return 'Please enter an absolute path.';
        }
        if (path.extname(absolutePath) !== '.ipk') {
            return 'Please enter a packaged app file in extension: *.ipk';
        }
        if (!fs.existsSync(absolutePath)) {
            return 'Please enter an existing path.';
        }

        return null;
    }

    static checkFileExist(value) {
        if (value === '') {
            return 'Please enter the file path.';
        }

        if (!fs.existsSync(value)) {
            return 'Please enter an existing file path.'
        }

        return null;
    }

    static checkPassphrase(value) {
        if (value === '') {
            return 'Please enter the passphrase.';
        }

        if (!matchReg(value, /[A-Z0-9]{6}/)) {
            return 'Please enter the exact passphrase displayed on the Developer Mode app.';
        }

        return null;
    }

    static checkPassword(value) {
        value = value.trim();
        if (value === '') {
            return 'Please enter the valid password.';
        }
    }

    static checkFromProjectWizard(data) {
        let valueType = data.valueType;
        let value = data.value.trim();

        if (valueType === 'location') {
            return this.checkDirectoryExist(value);
        } else if (valueType === 'name') {
            let location = data.projectLocation;
            let errMsg = this.checkDirectoryExist(location);

            // Check project location Path at fisrt
            if (errMsg) {
               return errMsg;
            }

            errMsg = this.checkDirectoryName(value);
            if (errMsg) {
                return errMsg;
            } else {
                let projectPath = path.join(location, value);
                if (fs.existsSync(projectPath)) {
                    return `The '${value}' directory already exists. Please specify another name.`;
                }
            }
        } else if (valueType === 'id') {
            return this.checkAppId(value);
        } else if (valueType === 'version') {
            return this.checkVersion(value);
        }
        return null;
    }

    static checkJSON(value) {
        if (value === '') {
            return 'Please enter the parameters.';
        }

        try {
            JSON.parse(value);
            return null;
        } catch (err) {
            console.error(err);
            return 'Please enter the stringified JSON format. For example, {"key":"value"}';
        }
    }
}

exports.InputChecker = InputChecker;
