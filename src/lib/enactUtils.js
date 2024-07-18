/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const path = require('path');
const fs = require('fs');
const { execAsync } = require("./runCommand");

const templateList = [
    { name: 'sandstone', id: 'sandstone' },
    { name: 'moonstone', id: 'moonstone' }
];

function getTemplateList() {
    return templateList.map(template => template.name);
}

async function isEnactApp(appDir) {
    if (!appDir) {
        console.log('is Enact: arguments are not fulfilled.');
        return Promise.reject(false)
    }
    let packagePath = path.join(appDir, "package.json");
    if (fs.existsSync(packagePath)) {
        let rawdata = fs.readFileSync(packagePath, 'utf8');
        let packageData = JSON.parse(rawdata);
        if (packageData && Object.prototype.hasOwnProperty.call(packageData, 'enact')) {
            return Promise.resolve(true);
        }
    }
    return Promise.resolve(false);
}

function getEnactPath() {
    let cliPath = "";
    return cliPath;
}

async function create(props, appDir) {
    if (!props || !appDir) {
        return Promise.reject('enact create: arguments are not fulfilled.')
    }
    let cmd = `${path.join("enact create")} -t "${props.template}"  "${appDir}"`,
        option = {};
    return execAsync(cmd, option, (stdout, resolve, reject) => {
        if (stdout.includes('Success')) {
            resolve();
        } else {
            reject('enact create: failed!');
        }
    })
}
async function pack(appDir, minify) {
    if (!appDir) {
        return Promise.reject('enact pack: arguments are not fulfilled.')
    }
    let cmd = "",
        option = { cwd: appDir };
    if (minify) {
        cmd = `${path.join("enact pack -p")}`;
    } else {
        cmd = `${path.join("enact pack")}`;
    }

    return execAsync(cmd, option, (stdout, resolve, reject) => {
        if (stdout.includes('success')) {
          
            resolve();
        } else {
         
            reject('enact pack: failed!');
        }
    }).catch((err) => {
        console.log("failed", err);
    })
}

async function template() {
    let cliPath = await getEnactPath(),
        cmd = `${path.join(cliPath, 'enact template list')}`,
        option = {};
    return execAsync(cmd, option, (stdout, resolve, reject) => {
        if (stdout.includes('Success')) {
            resolve();
        } else {
            reject('enact template list: failed!');
        }
    })
}

module.exports = {
    isEnactApp: isEnactApp,
    getTemplateList: getTemplateList,
    getEnactPath: getEnactPath,
    create: create,
    pack: pack,
    template: template
}
