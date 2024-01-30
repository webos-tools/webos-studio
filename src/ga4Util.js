/*
 * Copyright (c) 2022-2023 LG Electronics Inc.
 * SPDX-License-Identifier: LicenseRef-LGE-Proprietary
 */
const vscode = require('vscode');
const got = require('got');
const nodeGtag4 = require("node-gtag4");
const path = require('path');
const fs = require('fs');

function getSysType() {
  const js2python = {
    win32_x64: 'windows_amd64',
    win32_x32: 'windows_x86',
    win32_ia32: 'windows_x86',
    darwin_x64: 'darwin_x86_64',
    darwin_x32: 'darwin_i686',
    darwin_arm64: 'darwin_arm64',
    linux_x64: 'linux_x86_64',
    linux_x32: 'linux_i686',
    linux_arm: 'linux_armv6l',
    linux_arm64: 'linux_aarch64',
    freebsd_x64: 'freebsd_amd64',
  };
  const result = `${process.platform}_${process.arch}`;

  /**
   * @param {string} value
   */
  function isValid(value) {
    return value in js2python;
  }
  if (!isValid(result)) {
    throw Error('invalid platform_arch');
  }
  return js2python[result] || result;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// functions for global configuration

const IS_WINDOWS = process.platform.startsWith('win');
const IS_LINUX = process.platform.startsWith('linux');
const IS_MACOSX = process.platform.startsWith('darwin');

function getHomeDir() {
  // fallback
  let userHomeDir = process.env.HOME || '~';
  if (IS_WINDOWS) {
    if (process.env.USERPROFILE) {
      userHomeDir = process.env.USERPROFILE;
    } else if (process.env.HOMEPATH) {
      userHomeDir = path.join(process.env.HOMEDRIVE || '', process.env.HOMEPATH);
    }
  }
  return userHomeDir;
}

class ConfigHandler {
  configs = {};
  constructor(filePath) {
    this.configPath = filePath;
    this.readConfigs();
  }
  getConfigs(key) {
    this.readConfigs();
    return this.configs[key];
  }
  readConfigs() {
    if (fs.existsSync(this.configPath)) {
      try {
        this.configs = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      } catch (e) {
        vscode.window.showErrorMessage(`Error: Unable to find ${this.configPath}.`);
      }
    }
  }
  updateConfigs(key, value) {
    this.configs[key] = value;
    this.writeConfigs();
  }
  writeConfigs() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.configs, null, Number(4)));
  }
  removeConfigs(key) {
    if (this.configs[key] !== undefined) {
      delete this.configs[key];
      this.writeConfigs();
    }
  }
}

const globalConfig = new ConfigHandler(path.join(getHomeDir(), ".webosstudio_configs.json"));

///////////////////////////////////////////////////////////////////////////////////////////////////
// functions for workspace configuration

class LocalStorageService {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.storage = context.workspaceState;
  }
  /**
   * @param {string} key
   */
  getItem(key) {
    return this.storage.get(key);
  }
  /**
   * @param {string} key
   * @param {any} value
   */
  setItem(key, value) {
    this.storage.update(key, value);
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// Support User Data Collection

const GA_CLIENT_ID_KEY = 'ga4_client_id';

const EVENT_KEYS = {
  "LAUNCHED": "launched",
  "INSTALL_IPK": "install_lpk",
  "EMULATOR_LAUNCHED": "launch_emulator"
};

// dev
//const measurement_id = `G-HPNJ31MYF7`;
//const api_secret = `bXLpUiRNRmWm8tw5uTeL8w`;
const ga_debug = false;
// release
const measurement_id = `G-QE3TCKXHJ6`;
const api_secret = `nT6EaHVeTgSjGaNrMqmK6w`;

/**
 * @param {string} eventName
 */
async function mpGa4Event(eventName, params = {}) {
  if (eventName.indexOf('.') >= 0) {
    console.log(`[WARN] eventName ${eventName} contains '.' charactor, it should not be measured.`);
  }
  let debugParam = ga_debug ? "debug/" : "";
  got.post(`https://www.google-analytics.com/${debugParam}mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, {
    method: "POST",
    body: JSON.stringify({
      "client_id": getClientId(GA_CLIENT_ID_KEY),
      "non_personalized_ads":false,
      "events":[{
        "name": eventName,
        "params": params
      }]
    })
  }).then((response) => {
    console.log("sent to ga4 event.");
    console.log({
      "client_id": getClientId(GA_CLIENT_ID_KEY),
      "name": eventName,
      "params": params
    });
    console.log(response.statusCode);
  });
}

// @ts-ignore
const ga4 = nodeGtag4(measurement_id);

/**
 * @param {string} title
 */
function ga4PageView(title) {
  ga4.pv(title);
}

/**
 * @param {import("node-gtag4/types/gtag").eventPayloadType} param
 */
function ga4Event(param) {
  if (vscode.workspace.getConfiguration().get("webosose.enableUserDataCollection") === true) {
    ga4.event(param);
  }
}

/**
 * @param {any} version
 */
function mpGa4EventLaunched(version) {
  if (vscode.workspace.getConfiguration().get("webosose.enableUserDataCollection") !== true) {
    return;
  }
  mpGa4Event(EVENT_KEYS.LAUNCHED, {
    os: getSysType(),
    version: version,
    value: version
  });
}

const clientKey = 'clientId';

/**
 * @type {LocalStorageService}
 */
var localStorage;

/**
 * @param {vscode.ExtensionContext} context
 */
function initLocalStorage(context) {
  localStorage = new LocalStorageService(context);
}

function getRandomId(length = 16) {
  const randomId = `${Math.floor(Math.random() * 1e16)}`;
  length = length > 16 ? 16 : length;
  return randomId.padStart(length, '0').substring(-1, length);
}

function getClientId(key = clientKey) {
  const clientId = `${getRandomId(9)}.${getRandomId(10)}`;
  const storedValue = localStorage.getItem(key);
  if (!storedValue) {
    localStorage.setItem(key, clientId);
    return clientId;
  }
  return storedValue;
}

/**
 * Ask to user for UDC agreement, and show user agreement. It is not necessary as legal review.
 * @param {*} context 
 * @returns 
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkInitialExecution(context) {
  const license_agreement = globalConfig.getConfigs("license_agreement");
  if (license_agreement !== true) {
    getUserAgreement(context);
  }
  if (vscode.workspace.getConfiguration().get("webosose.enableUserDataCollection")) {
    return;
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function getUserAgreement(context) {
  const header = "webOS Studio License Agreement";
  // if modal is true, InformationMessage will be shown as modal dialog.
  const options = {
    detail: "Do you agree to the terms and conditions of this license agreement?",
    modal: true
  }

  // copy agreement file, to do not change original file.
  const agreementFilePath = path.join(getHomeDir(), "agreement");
  fs.copyFileSync(path.join(context.extensionUri.fsPath, "media", "udc", "agreement.txt"), agreementFilePath);
  // load and show agreement file in editor area
  vscode.workspace.openTextDocument(vscode.Uri.file(agreementFilePath).with({ scheme: 'file' })).then(doc => {
    vscode.window.showTextDocument(doc);
  });

  vscode.window.showInformationMessage(header, options, ...[{title: "Yes"}, {title: "No", isCloseAffordance: true}]).then((answer) => {
    if (answer.title === "I agree") {
      // since click "I agree", the dialog will not show.
      globalConfig.updateConfigs("license_agreement", true);
      vscode.workspace.getConfiguration().update("webosose.enableUserDataCollection", true);
    } else {
      // when user click "No", the dialog will show again at next time.
      vscode.workspace.getConfiguration().update("webosose.enableUserDataCollection", false);
    }
  });
  return true;
}

module.exports = {
  initLocalStorage     : initLocalStorage,
  sendLaunchEvent      : mpGa4EventLaunched,
  mpGa4Event           : mpGa4Event,
  sendPageView         : ga4PageView,
  EVENT_KEYS           : EVENT_KEYS,
  checkInitialExecution: checkInitialExecution,
  globalConfig         : globalConfig
};
