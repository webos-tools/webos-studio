/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { generateApp, generateAppFromProjectWizard, removeApp } = require('./src/generateApp');
const previewApp = require('./src/previewApp');
const { runWithoutInstall} = require('./src/runWithoutInstallation');
const reloadWebAppPreview = require('./src/reloadWebApp');
const packageApp = require('./src/packageApp');
const { setupDevice, setDeviceProfile } = require('./src/setupDevice');
const getKey = require('./src/lib/getKey');
const runApp = require('./src/runApp');
const installApp = require('./src/installApp');
const launchApp = require('./src/launchApp');
const inspectApp = require('./src/inspectApp');
const lintApp = require('./src/lintApp');
const installLibrary = require('./src/installLibrary');
const { installGlobalLibrary, installEmulatorLauncher } = require('./src/installGlobalLibrary');
const runSimulator = require('./src/lib/runSimulator');
const { DeviceProvider, SimulatorProvider } = require('./src/webososeDevices');
const { AppsProvider } = require('./src/webososeApps');
const { uninstallApp, closeApp, getDeviceInfo, setDefaultDevice } = require('./src/contextMenus');
const { InstanceWebviewProvider } = require('./src/instanceWebviewProvider');
const { ExplorerMenuMgr } = require('./src/explorerMenuMgr');
const { getDefaultDir, isAppDir } = require('./src/lib/workspaceUtils');
const { InputChecker } = require('./src/lib/inputChecker');
const { HelpProvider, renderReadMe, renderChangeLog } = require('./src/helpProvider');
const { IPK_ANALYZER } = require('./src/ipkAnalyzer');
const { logger, createOutPutChannel } = require('./src/lib/logger');
const { InputController } = require('./src/lib/inputController');
const launchResourceMonitoring = require('./src/resourceMonitoring');
const fs = require('fs');
const path = require('path');
const setLogLevel = require('./src/setLogLevel');
const { getCurrentDeviceProfile, setCurrentDeviceProfile } = require('./src/lib/deviceUtils');
const { PackageManagerSidebar } = require('./src/packageManagerSidebar');
const { getSimulatorDirPath } = require('./src/lib/configUtils');
const extensionPath = __dirname;
const ga4Util = require('./src/ga4Util');

let apiObjArray = [];
let apiObjArrayIndex = 0;
let myStatusBarItem;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    createOutPutChannel();
    ga4Util.initLocalStorage(context);
    ga4Util.sendLaunchEvent(context.extension.packageJSON.version);
    ga4Util.sendPageView(`webOSStudio ${context.extension.packageJSON.version}`);
   
    let previewPanelInfo = { "webPanel": null, appDir: null, childProcess: null, isEnact: null };
    let packageManagerObj = {webPanel :null};
    const serviceProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'],
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                if (!linePrefix.endsWith('luna://')) {
                    return undefined;
                }

                apiObjArrayIndex = setFromConvertCacheAPI();
                const returnItemArray = [];

                const apiServiceArray = apiObjArray[apiObjArrayIndex].service;

                for (const i in apiServiceArray) {
                    const serviceItemName = apiServiceArray[i].name;
                    let urlServiceName = replaceAll(serviceItemName, ".", "-");
                    urlServiceName = urlServiceName.toLocaleLowerCase();
                    const urlName = `http://www.webosose.org/docs/reference/ls2-api/${urlServiceName}`;
                    const urlServiceSite = `<a href='${urlName}'>Site link of service(${serviceItemName})</a>`

                    const serviceItemInterface = { label: serviceItemName, description: "Luna API Service" };
                    const serviceItemSummary = apiServiceArray[i].summary + urlServiceSite;
                    const commitCharacterCompletion = new vscode.CompletionItem(serviceItemInterface, vscode.CompletionItemKind.Method);
                    commitCharacterCompletion.sortText = "0";

                    const content = new vscode.MarkdownString(serviceItemSummary);
                    content.supportHtml = true;
                    content.isTrusted = true;
                    commitCharacterCompletion.documentation = content;

                    returnItemArray.push(commitCharacterCompletion);
                }
                // too many event rised
                //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "service_name"});
                return returnItemArray;
            }
        },
        '/' // triggered whenever a '/' is being typed
    );

    const methodProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'],
        {
            provideCompletionItems(document, position) {
                let serviceName = "";
                const returnItemArray = [];
                const linePrefix = document.lineAt(position).text.substring(0, position.character);

                const apiServiceArray = apiObjArray[apiObjArrayIndex].service;

                let found = false;

                for (const i in apiServiceArray) {
                    serviceName = apiServiceArray[i].name;
                    const endKeyword = serviceName.split(".");
                    const endService = endKeyword[endKeyword.length - 1];

                    if (linePrefix.endsWith(`${endService}/`)) {
                        found = true;
                        break;
                    }
                }

                if (found === false) {
                    return undefined;
                }

                const [methodNameArr, methodDescArr] = findMethodInArray(serviceName);
                for (const i in methodNameArr) {
                    const methodItemName = methodNameArr[i].substring(1);
                    // eslint-disable-next-line no-async-promise-executor
                    const [paramNameArr, paramDescArr, methodParamDesc] = findParamInArray(serviceName, methodItemName);
                    const methodItemInterface = { label: methodItemName, description: "Luna API Method" };
                    const methodItemDesc = methodDescArr[i] + methodParamDesc;
                    const commitCharacterCompletion = new vscode.CompletionItem(methodItemInterface, vscode.CompletionItemKind.Method);
                    commitCharacterCompletion.sortText = "0";

                    const content = new vscode.MarkdownString(methodItemDesc);
                    content.supportHtml = true;
                    content.isTrusted = true;
                    commitCharacterCompletion.documentation = content;
                    returnItemArray.push(commitCharacterCompletion);
                }
                // too many event rised
                //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "method_name"});
                return returnItemArray;
            }
        },
        '/' // triggered whenever a '/' is being typed
    );

    const paramProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'], {

        provideCompletionItems(document, position) {
            const returnItemArray = [];
            let serviceName = "";
            let methodName = "";

            const linePrefix = document.lineAt(position).text;

            if (linePrefix.includes("luna://com.webos")) {
                const lineSplit = linePrefix.split("/");
                const linelength = lineSplit.length;
                serviceName = lineSplit[2];

                if (linelength > 4) { //case : method (a/b) linelength:5
                    const blankSplit = lineSplit[4].split(" ");
                    methodName = [lineSplit[3], blankSplit[0]].join("/");
                }
                else {
                    const blankSplit = lineSplit[3].split(" ");
                    methodName = blankSplit[0];
                }
                //remove ' or " in methodName
                methodName = methodName.split("\"")[0];
                methodName = methodName.split("'")[0];

                // eslint-disable-next-line no-async-promise-executor
                const [paramNameArr, paramDescArr, methodParamDesc] = findParamInArray(serviceName, methodName);
                for (const i in paramNameArr) {
                    const paramItemName = paramNameArr[i];
                    const paramItemInterface = { label: paramItemName, description: "Luna API Param" };
                    const paramItemDesc = paramDescArr[i];
                    const commitCharacterCompletion = new vscode.CompletionItem(paramItemInterface, vscode.CompletionItemKind.Method);
                    commitCharacterCompletion.sortText = "0";

                    const content = new vscode.MarkdownString(paramItemDesc);
                    content.supportHtml = true;
                    content.isTrusted = true;
                    commitCharacterCompletion.documentation = content;
                    returnItemArray.push(commitCharacterCompletion);
                }
            }

            // too many event rised
            //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "params_name"});
            return returnItemArray;
        }
    });

    const snippetServiceProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'], {

        provideCompletionItems() {
            const stringFirstMain = 'new LS2Request()';
            const snippetFirstItemInterface = { label: stringFirstMain, description: "Luna API Snippet" };
            const firstSnippetCompletion = new vscode.CompletionItem(snippetFirstItemInterface, vscode.CompletionItemKind.Snippet);
            firstSnippetCompletion.sortText = "1";

            let snippetDesc = "<p>Example)</p><p>new LS2Request().send({ \
                        <br>&emsp;service: 'luna://com.webos.applicationManager/', \
                        <br>&emsp;method: 'launch', \
                        <br>&emsp;parameters: {\"id\":\"com.sample.app\"} \
                        <br>});<p>";

            let content = new vscode.MarkdownString(snippetDesc);
            content.supportHtml = true;
            content.isTrusted = true;
            firstSnippetCompletion.documentation = content;
            firstSnippetCompletion.detail = "Need to insert 'import LS2Request from '@enact/webos/LS2Request';' "

            const stringFirstSub = 'new LS2Request().send({' + '\n'
                + '\t' + 'service: \'luna://' + '${1}\',' + '\n'
                + '\t' + 'method: \'${2}\',' + '\n'
                + '\t' + 'parameters: {${3}}' + '\n'
                + '});';

            firstSnippetCompletion.insertText = new vscode.SnippetString(stringFirstSub);

            const stringSecondMain = 'webOS.service.request()';
            const snippetSecondItemInterface = { label: stringSecondMain, description: "Luna API Snippet" };
            const secondSnippetCompletion = new vscode.CompletionItem(snippetSecondItemInterface, vscode.CompletionItemKind.Snippet);
            //secondSnippetCompletion.sortText = "2";

            snippetDesc = "<p>Example)</p><p>function checkMenuLanguage(){\
                    <br>&emsp;webOS.service.request('luna://com.webos.service.settings/', { \
                    <br>&emsp;&emsp;method: \"getSystemSettings\", \
                    <br>&emsp;&emsp;parameters: {\"keys\":[\"localeInfo\"]}, \
                    <br>&emsp;&emsp;onSuccess: function (res) {setMenuLanguage(res.settings.localeInfo.locales);}, \
                    <br>&emsp;&emsp;onFailure: function (res) {setMenuLanguage({});}, \
                    <br>&emsp;}); \
                    <br>}</p>";
            content = new vscode.MarkdownString(snippetDesc);
            content.supportHtml = true;
            content.isTrusted = true;
            secondSnippetCompletion.documentation = content;
            const stringSecondSub = 'webOS.service.request(\'luna://' + '${1}\', {' + '\n'
                + '\t' + 'method: \'${2}\',' + '\n'
                + '\t' + 'parameters: {${3}},' + '\n'
                + '\t' + 'onSuccess: {},' + '\n'
                + '\t' + 'onFailure: {},' + '\n'
                + '});';

            secondSnippetCompletion.insertText = new vscode.SnippetString(stringSecondSub);

            // too many event rised
            //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "snippet_service"});
            return [
                firstSnippetCompletion,
                secondSnippetCompletion
            ];
        }
    });

    const snippetMethodProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'], {

        provideCompletionItems(document, position) {
            const returnItemArray = [];
            let serviceName = "";

            const linePrefix = document.lineAt(position.line - 1).text;

            if (linePrefix.includes("service:") || linePrefix.includes("webOS.service.request")) {
                const lineSplit = linePrefix.split("luna://");
                const lineSplitEnd = lineSplit[lineSplit.length - 1];
                if (lineSplitEnd.includes('/')) {
                    serviceName = lineSplitEnd.split("/")[0];
                }
                else {
                    serviceName = lineSplitEnd.split("'")[0];
                }

                const [methodNameArr, methodDescArr] = findMethodInArray(serviceName);
                for (const i in methodNameArr) {
                    const methodItemName = methodNameArr[i].substring(1);
                    // eslint-disable-next-line no-async-promise-executor
                    const [paramNameArr, paramDescArr, methodParamDesc] = findParamInArray(serviceName, methodItemName);
                    const methodItemInterface = { label: methodItemName, description: "Luna API Method" };
                    const methodItemDesc = methodDescArr[i] + methodParamDesc;
                    const commitCharacterCompletion = new vscode.CompletionItem(methodItemInterface, vscode.CompletionItemKind.Method);

                    const content = new vscode.MarkdownString(methodItemDesc);
                    commitCharacterCompletion.sortText = "0";
                    content.supportHtml = true;
                    content.isTrusted = true;
                    commitCharacterCompletion.documentation = content;
                    returnItemArray.push(commitCharacterCompletion);
                }
            }

            // too many event rised
            //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "snippet_method"});
            return returnItemArray;
        }
    });

    const snippetParamProvider = vscode.languages.registerCompletionItemProvider(
        ['plaintext', 'javascript', 'typescript', 'html'], {

        provideCompletionItems(document, position) {

            const returnItemArray = [];
            let serviceName = "";
            let methodName = "";

            const linePrefix = document.lineAt(position.line - 1).text;
            const linePrefix2 = document.lineAt(position.line - 2).text;

            if (linePrefix.includes("method:")) {
                if (linePrefix2.includes("service:") || linePrefix2.includes("webOS.service.request")) {
                    const lineSplit = linePrefix2.split("luna://");
                    const lineSplitEnd = lineSplit[lineSplit.length - 1];

                    if (lineSplitEnd.includes('/')) {
                        serviceName = lineSplitEnd.split("/")[0];
                    }
                    else {
                        serviceName = lineSplitEnd.split("'")[0];
                    }
                }
                const lineSplit = linePrefix.split("method: ");
                const lineSplitEnd = lineSplit[lineSplit.length - 1];

                methodName = lineSplitEnd.split("'")[1];

                // eslint-disable-next-line no-async-promise-executor
                const [paramNameArr, paramDescArr, methodParamDesc] = findParamInArray(serviceName, methodName);
                for (const i in paramNameArr) {
                    const paramItemName = paramNameArr[i];
                    const paramItemInterface = { label: paramItemName, description: "Luna API Param" };
                    const paramItemDesc = paramDescArr[i];
                    const commitCharacterCompletion = new vscode.CompletionItem(paramItemInterface, vscode.CompletionItemKind.Method);
                    const content = new vscode.MarkdownString(paramItemDesc);
                    commitCharacterCompletion.sortText = "0";
                    content.supportHtml = true;
                    content.isTrusted = true;
                    commitCharacterCompletion.documentation = content;
                    returnItemArray.push(commitCharacterCompletion);
                }
            }

            // too many event rised
            //ga4Util.mpGa4Event("autoCompletion", {category:"features", type: "snippet_params"});
            return returnItemArray;
        }
    });

    // statusbar from https://github.com/microsoft/vscode-extension-samples/blob/main/statusbar-sample/src/extension.ts
    // register a command that is invoked when the status bar
    // item is selected
    const myCommandId = 'webos.setProfile';
    context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
        setProfile();
    }));

    // create a new status bar item that we can now manage
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    myStatusBarItem.command = myCommandId;
    context.subscriptions.push(myStatusBarItem);

	// update status bar item once at start
	updateStatusBarItem();

    context.subscriptions.push(serviceProvider, methodProvider, paramProvider, snippetServiceProvider, snippetMethodProvider, snippetParamProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('webosose.projectWizard', () => {
            const panel = vscode.window.createWebviewPanel('Wizard', 'Create Project', vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(extensionPath)
                ]
            })

            let apiLevel, deviceProfile, appType, appSubType, appTypeIndex, enactTemplate, htmlType, disposeFinish = false;
            let projectLocation, projectName, prop = {}, addWebOSlib = false;
            let checkAllValid, projectLocationValid;
            let msg = 'webOS Project Wizard';

            const resource = getResourcePath();

            panel.title = msg;
            panel.webview.html = getWebviewHome(resource);

            panel.webview.onDidReceiveMessage(async message => {
                switch (message.command) {
                    case 'Generate':
                        appTypeIndex = 0;
                        apiLevel = message.apiLevel;
                        deviceProfile = message.deviceProfile;
                        msg = 'Create Project';
                        panel.title = msg;
                        panel.webview.html = getWebviewCreateProject(appTypeIndex, resource); // page2
                        vscode.workspace.getConfiguration().update("webosose.lunaApiLevel", apiLevel);
                        break;
                    case 'Next':
                        appType = message.appType;
                        appSubType = message.appSubType;
                        appTypeIndex = message.appTypeIndex;
                        msg = 'Set ' + appSubType + ' of ' + appType + ' property';
                        panel.title = msg;
                        if (appType === 'Enact App') {
                            // Enact App type's sub Type is one of 'Sandstone' and 'Moonstone'
                            enactTemplate = appSubType.toLowerCase();
                        }
                        panel.webview.html = getWebviewPropertyPage(appSubType, appTypeIndex, resource);
                        break;
                    case 'Back':
                        htmlType = message.htmlType;
                        if (htmlType === 'home') {
                            msg = 'webOS Project Wizard';
                            panel.title = msg;
                            panel.webview.html = getWebviewHome(resource); // page1
                        } else if (htmlType === 'createproject') {
                            appTypeIndex = message.appTypeIndex;
                            msg = 'Create Project';
                            panel.title = msg;
                            panel.webview.html = getWebviewCreateProject(appTypeIndex, resource);
                        }
                        break;
                    case 'CheckNavi':
                        htmlType = message.htmlType;
                        if (htmlType === 'createproject') {
                            appTypeIndex = message.appTypeIndex;
                            msg = message.msg;
                            if (msg) {
                                vscode.window.showWarningMessage(msg);
                            }
                            msg = "Create Project";
                            panel.title = msg;
                            panel.webview.html = getWebviewCreateProject(appTypeIndex, resource);
                        }
                        break;
                    case 'ShowOpenDialog':
                        vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true
                        }).then(fileUri => {
                            if (fileUri && fileUri[0]) {
                                panel.webview.postMessage({ command: 'SetLocation', location: fileUri[0].fsPath });
                            }
                        });
                        break;
                    case 'Finish':
                        // Check validation at first
                        checkAllValid = true;
                        projectLocationValid = true;

                        for (const i in message['validcheckList']) {
                            msg = '';
                            if (!projectLocationValid && message['validcheckList'][i].valueType === 'name') {
                                // Set project name text color to origin color
                                await panel.webview.postMessage({
                                    command: 'UpdateValidList',
                                    valueType: message['validcheckList'][i].valueType,
                                    validResult: true
                                });
                                continue;
                            } else {
                                msg = InputChecker.checkFromProjectWizard(message['validcheckList'][i]);
                            }
                            if (msg) {
                                checkAllValid = false;

                                if (message['validcheckList'][i].valueType === 'location') {
                                    projectLocationValid = false;
                                }
                                let headerType = (message['validcheckList'][i].valueType).toUpperCase();
                                msg = `[${headerType}] ${msg}`;
                                vscode.window.showErrorMessage(msg);
                            }
                            await panel.webview.postMessage({
                                command: 'UpdateValidList',
                                valueType: message['validcheckList'][i].valueType,
                                validResult: (!msg ? true : false)
                            });
                        }

                        // All values are valid. Generate Appp
                        if (checkAllValid) {
                            projectName = message.projectName;
                            projectLocation = message.projectLocation;

                            if (message.appId) {
                                prop.id = message.appId;
                            }
                            if (message.appVersion) {
                                prop.version = message.appVersion;
                            }
                            if (message.appTitle) {
                                prop.title = message.appTitle;
                            }
                            if (message.hostedUrl) {
                                prop.url = message.hostedUrl;
                            }
                            if (message.addWebOSlib) {
                                addWebOSlib = message.addWebOSlib;
                            }
                            if (appType === 'Enact App') {
                                appSubType = 'Basic Enact App';
                                prop.template = enactTemplate;
                            }

                            disposeFinish = true;
                            panel.dispose();
                        }
                        break;
                    case 'Cancel':
                        disposeFinish = false;
                        panel.dispose();
                        break;
                }
            }, undefined, this.disposable)

            panel.onDidDispose(() => {
                // Handle user closing panel after 'finish' botton clicked on Project Wizard
                if (disposeFinish) {
                    (async () => {
                        let result = await setProfile(deviceProfile.toLowerCase());
                        if (result === 0) {
                            ga4Util.mpGa4Event("LaunchProjectWizard", {category:"Commands", type: appSubType, apiLevel: apiLevel});
                            generateAppFromProjectWizard(appSubType, projectLocation, projectName, prop, addWebOSlib, deviceProfile)
                                .then(() => {
                                    let apiLevelStatus = "", apiLevelNo = "";
                                    let apiLevelStatusSplit = [];

                                    apiLevelStatus = apiLevel;

                                    apiLevelStatusSplit = apiLevelStatus.split("_");
                                    apiLevelNo = apiLevelStatusSplit[apiLevelStatusSplit.length - 1];
                                    const webosConfig = {
                                        api_level: apiLevelNo,
                                        // profile: deviceProfile
                                    }
                                    const webosConfigJSON = JSON.stringify(webosConfig, null, 2);
                                    const jsonPath = path.join(projectLocation, `${projectName}/.webosstudio.config`);
                                    fs.writeFileSync(jsonPath, webosConfigJSON);

                                    webososeAppsProvider.refresh(null, context);
                                });
                        }
                    })();
                }
            },
                null,
                context.subscriptions
            );
        })
    );

    context.subscriptions.push(vscode.commands.registerCommand('webosose.resourceMonitoring', () => {
        launchResourceMonitoring(extensionPath, context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webosose.installGlobal', () => {
        installGlobalLibrary();
        vscode.commands.executeCommand('webos.updateProfile');
        ga4Util.mpGa4Event("installGlobal", {category:"Commands"});
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webosose.installEmulator', () => {
        ga4Util.mpGa4Event("installEmulator", {category:"Commands"});
        installEmulatorLauncher();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webos.setDeviceProfile', () => {
        ga4Util.mpGa4Event("setDeviceProfile", {category:"Commands"});
        setProfile();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webos.runSimulator', (file) => {
        console.log("runSimulator!");
        if (file && file.label) {
            runSimulator(file.label);
        }
        else if (file && fs.statSync(file).isDirectory()) {
            runSimulator(file);
        } else {
            runSimulator();
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webos.updateProfile', () => {
        updateStatusBarItem();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webos.updateSDKPath', (sdkPath) => {
        getSimulatorDirPath(sdkPath);
        webosSimulatorProvider.refresh();
    }));
    context.subscriptions.push(
        vscode.commands.registerCommand('webos.runSimulatorParams', () => {
            runSimulator(null, null, true);
        })
    );

    // Help Provide
    const helpPanels = new Map();
    const readmeCommand = vscode.commands.registerCommand('quickLauncher.readme', async () => {
        ga4Util.mpGa4Event("quickLauncher_readme", {category:"Commands"});
        renderReadMe(helpPanels);
    });
    const changeLogCommand = vscode.commands.registerCommand('quickLauncher.changeLog', async () => {
        ga4Util.mpGa4Event("quickLauncher_changeLog", {category:"Commands"});
        renderChangeLog(helpPanels);
    });
    const initHelpCommand = vscode.commands.registerCommand('quickLauncher.initHelp', async () => {
        ga4Util.mpGa4Event("quickLauncher_refresh", {category:"Commands"});
        await webososeHelpProvider.refresh();
    })

    context.subscriptions.push(readmeCommand);
    context.subscriptions.push(changeLogCommand);
    context.subscriptions.push(initHelpCommand);

    const webososeHelpProvider = new HelpProvider([
        { "label": "Resource Monitoring", "onSelectCommand": "webosose.resourceMonitoring", "icon": "resource_monitoring" },
        { "label": "Readme", "onSelectCommand": "quickLauncher.readme", "icon": "info" },
        { "label": "Change Log", "onSelectCommand": "quickLauncher.changeLog", "icon": "versions" }        
    ]);
    vscode.window.registerTreeDataProvider('quickLauncher', webososeHelpProvider);

    // comment out unused command registration, webosose.generateApp
    /*context.subscriptions.push(vscode.commands.registerCommand('webosose.generateApp', async () => {
        await generateApp();
        await webososeAppsProvider.refresh();
        webososeAppsProvider.storeContextOnExtnLaunch(context);
    }));*/
    context.subscriptions.push(vscode.commands.registerCommand('webosose.setloglevel', () => {
        ga4Util.mpGa4Event("setLogLevel", {category:"Commands"});
        setLogLevel();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.previewApp', () => {
        previewApp(null, previewPanelInfo);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.runWithoutInstall', () => {
        runWithoutInstall(null, context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webosose.packageApp', () => { packageApp(); }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.setupDevice', () => { setupDevice(); }));
    context.subscriptions.push(vscode.commands.registerCommand('webos.getKey', () => {
        getCurrentDeviceProfile()
            .then((data) => {
                if (data === 'tv') {
                    getKey();
                } else {
                    vscode.window.showInformationMessage(`Only TV Profile supports Set Up SSH Key.`);
                }
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.installApp', () => {
        installApp()
            .then(() => {
                webososeDevicesProvider.refresh();
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.launchApp', () => {
        launchApp()
            .then(() => {
                webososeDevicesProvider.refresh();
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webos.launchParams', () => {
		launchApp(null, null, null, true)
            .then(() => {
                webososeDevicesProvider.refresh();
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.inspectApp', () => { inspectApp(); }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.runApp', () => { runApp(); }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.debugApp', () => { runApp(true); }));

    const webososeDevicesProvider = new DeviceProvider();
    const webosSimulatorProvider = new SimulatorProvider();
    vscode.window.registerTreeDataProvider('webososeDevices', webososeDevicesProvider);
    vscode.window.registerTreeDataProvider('webosSimulator', webosSimulatorProvider);

    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.refreshList', () => {
        webososeDevicesProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.addDevice', async () => {
        await setupDevice('add');
        webososeDevicesProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.modifyDevice', async (device) => {
        device = deviceClone(device);
        if (device != null) {
            await setupDevice('modify', device.label);
            webososeDevicesProvider.refresh();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.removeDevice', async (device) => {
        device = deviceClone(device);
        if (device != null) {
            if (device.label === 'emulator') {
                vscode.window.showInformationMessage(`The emulator cannot be removed.`);
                return;
            }
            else {
                await setupDevice('remove', device.label);
                webososeDevicesProvider.refresh();
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.getDeviceInfo', (device) => {

        device = deviceClone(device);
        if (device != null) {
            getDeviceInfo(device.label);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.setDefaultDevice', async (device) => {

        device = deviceClone(device);
        if (device != null) {
            await setDefaultDevice(device.label);
            webososeDevicesProvider.refresh();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.refreshDevice', (device) => {
        device = deviceClone(device);
        if (device != null) {
            webososeDevicesProvider.refresh(device);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.installApp', (device) => {
        device = deviceClone(device);
        if (device != null) {
            installApp(null, device.label)
                .then(() => {
                    webososeDevicesProvider.refresh(device);
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.runApp', (app) => {
        app = appClone(app);
        if (app != null) {
            launchApp(app.label, app.deviceName)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.runApp.display0', (app) => {
        app = appClone(app);
        if (app != null) {
            launchApp(app.label, app.deviceName, 0)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.runApp.display1', (app) => {
        app = appClone(app);
        if (app != null) {
            launchApp(app.label, app.deviceName, 1)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.uninstallApp', (app) => {
        app = appClone(app);
        if (app != null) {
            uninstallApp(app.label, app.deviceName)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.closeApp', (app) => {
        app = appClone(app);
        if (app != null) {
            closeApp(app.label, app.deviceName)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    })); // display0
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.closeApp.display0', (app) => {
        app = appClone(app);
        if (app != null) {
            closeApp(app.label, app.deviceName, 0)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webososeDevices.closeApp.display1', (app) => {
        app = appClone(app);
        if (app != null) {
            closeApp(app.label, app.deviceName, 1)
                .then(() => {
                    webososeDevicesProvider.refresh();
                })
        }
    }));
    context.subscriptions.push(
        vscode.commands.registerCommand('webosSimulator.refreshList', () => {
            webosSimulatorProvider.refresh();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('webosSimulator.runApp', (simulator) => {
            runSimulator(null, simulator.version);
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorer.installApp', (file) => {
        installApp(file.fsPath, null);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorer.runApp', (file) => {
        installApp(file.fsPath, null)
            .then((obj) => {
                launchApp(obj.appId, obj.device)
            })
    }));

    const webososeAppsProvider = new AppsProvider();
    vscode.window.registerTreeDataProvider('apps', webososeAppsProvider);
    context.subscriptions.push(vscode.commands.registerCommand('apps.refreshList', () => {
        webososeAppsProvider.refresh(null, context);
    }));
    // comment out unused command registration, apps.generateApp
    /*context.subscriptions.push(vscode.commands.registerCommand('apps.generateApp', async () => {
        await generateApp();
        await webososeAppsProvider.refresh();
        webososeAppsProvider.storeContextOnExtnLaunch(context);
    }));*/
    context.subscriptions.push(vscode.commands.registerCommand('apps.projectWizard', async (app) => {
        vscode.commands.executeCommand('webosose.projectWizard');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.packageApp', async (app) => {
        packageApp(app.label);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.runApp', async (app) => {
        packageApp(app.label)
            .then(installApp)
            .then((obj) => {
                if (obj && obj.appId) {
                    launchApp(obj.appId)
                        .then(() => {
                            webososeDevicesProvider.refresh();
                        });
                }
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.removeApp', async (app) => {
        await removeApp(app);
        webososeAppsProvider.refresh(null, context);
        // webososeAppsProvider.storeContextOnExtnLaunch(context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.installApp', async (app) => {
        packageApp(app.label, true) // if IPK already exists then skip the package steps
            .then(installApp)
            .then(() => {
                webososeDevicesProvider.refresh();
            });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('apps.installWebOS', async (app) => {
        installLibrary(app.label, app.description);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.previewApp', async (app) => {
        previewApp(app.label, previewPanelInfo);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.runWithoutInstall', async (app) => {
        runWithoutInstall(app.label, context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.debugApp', async (app) => {
        inspectApp(app.label, undefined, true, 'IDE');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.debugApp.ide', async (app) => {
        inspectApp(app.label, undefined, true, 'IDE');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.debugApp.browser', async (app) => {
        inspectApp(app.label, undefined, true, 'BROWSER');
    }));
    // Provide Diagnostics when user performs lint.
    let collection = vscode.languages.createDiagnosticCollection('appLintCollection');
    context.subscriptions.push(vscode.commands.registerCommand('apps.lintApp', async (app) => {
        lintApp(app.label, collection, true);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('apps.lintAppDisable', async (app) => {
        lintApp(app.label, collection, false);
    }));
    vscode.workspace.onDidDeleteFiles(() => {
        webososeAppsProvider.refresh(null, context);
    });
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(function (doc) {
        // checking saved file is inside a webapp and preview is on 
        if (previewPanelInfo.appDir != null && previewPanelInfo.isEnact == false && doc.fileName.startsWith(previewPanelInfo.appDir)) {
            // relad the preview
            vscode.commands.executeCommand('webapp.reloadPreview', previewPanelInfo);
        }
        if (doc.fileName.endsWith("package.json")) {
            webososeAppsProvider.comparePackageJsonDependancies(context, doc)
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('webapp.reloadPreview', async (previewPanelInfo) => {
        reloadWebAppPreview(previewPanelInfo)
    }));

    const instanceWebviewProvider = new InstanceWebviewProvider(context.extensionUri);
    vscode.window.registerWebviewViewProvider(InstanceWebviewProvider.viewType, instanceWebviewProvider, { webviewOptions: { retainContextWhenHidden: true } });
    context.subscriptions.push(vscode.commands.registerCommand('vbox.refreshList', () => {
        instanceWebviewProvider.getInstalledInstanceListAndSendToWebview();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vbox.addInstance', () => {
        instanceWebviewProvider.openAddInstance();

    }));
    let explorerMenuMgr = new ExplorerMenuMgr();
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.packageApp', async (resource) => {
        explorerMenuMgr.packageApp(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.installApp', async (resource) => {
        explorerMenuMgr.installApp(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.runApp', async (resource) => {
        explorerMenuMgr.runApp(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.runSimulator', async (resource) => {
        explorerMenuMgr.runSimulator(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.appPreview', async (resource) => {
        explorerMenuMgr.appPreview(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.debug', async (resource) => {
        explorerMenuMgr.debugApp(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.debug.ide', async (resource) => {
        explorerMenuMgr.debugApp(resource, 'IDE')
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.debug.browser', async (resource) => {
        explorerMenuMgr.debugApp(resource, 'BROWSER')
    }));
    context.subscriptions.push(vscode.commands.registerCommand('webosose.explorermenu.runWithoutInstall', async (resource) => {
        explorerMenuMgr.runWithoutInstall(resource)
    }));
    context.subscriptions.push(vscode.commands.registerCommand('ipkanalyze.start', async () => {

        ga4Util.sendPageView("IpkAnalyzer");
        const ipkAnalyzer = new IPK_ANALYZER(context);
        ipkAnalyzer.startEditor();

    }));
  
    this.packageMgrWebviewProvider = new PackageManagerSidebar(context);
    vscode.window.registerWebviewViewProvider(PackageManagerSidebar.viewType, this.packageMgrWebviewProvider, { webviewOptions: { retainContextWhenHidden: true } });

  vscode.commands.executeCommand('webososeDevices.refreshList');
    webososeAppsProvider.storeContextOnExtnLaunch(context);
    initExtViews();

}
function initExtViews(){
    vscode.commands.executeCommand('vbox.focus');
    vscode.commands.executeCommand('apps.focus');
    vscode.commands.executeCommand('webososeDevices.focus');
    

    setTimeout(()=>{
        if(logger.extInit == false){
            logger.logAny("webOS Studio initialized successfully." ) ;
            logger.log("------------------------------------------------")
        
            logger.extInit = true;
          
        
        }
    },5000)
    
    
    
   
    
    
}

function getResourcePath() {
    const dataPath = vscode.Uri.file(extensionPath);
    const resource = dataPath.with({ scheme: 'vscode-resource' });

    return resource;
}

function showProfile(profile) {
    const currentProfile = profile.trim().toUpperCase();
    myStatusBarItem.text = 'webOS ' + currentProfile;
    let tooltip = 'Current profile of webOS Studio is set to ' + currentProfile;
    tooltip += '\nClick to change profile';
    myStatusBarItem.tooltip = tooltip;
    myStatusBarItem.show();
}

function updateStatusBarItem() {
    (async () => {
        let profile, tooltip, text;
        try {
            profile = await getCurrentDeviceProfile();
            profile = profile.trim().toUpperCase();
            text = 'webOS ' + profile;
            tooltip = 'Current profile of webOS Studio is set to ' + profile;
            tooltip += '\nClick to change profile';
        } catch (error) {
            text = "webOS INIT...";
            tooltip = 'Please install CLI to set webOS Studio Profile';
        }
        myStatusBarItem.text = text;
        myStatusBarItem.tooltip = tooltip;
        myStatusBarItem.show();
    })();
}

async function setProfile(profile) {
    const result = await setDeviceProfile(profile);
    updateStatusBarItem();
    vscode.commands.executeCommand('webososeDevices.refreshList');
    return result.ret ? 0 : 1;
}

function getAppsListinWorkspace(folderPath, type) {
    let dirArray = [];
    if (folderPath && fs.existsSync(folderPath)) {
        try {
            dirArray = fs.readdirSync(folderPath, { withFileTypes: true })
                .filter(isAppDir)
            if (type && type == "service") {
                dirArray = dirArray.filter(dirent => dirent.type == "js-service")
                    .map(dirent => dirent.name);
            } else if (type && type == "apps") {
                dirArray = dirArray.filter(dirent => dirent.type != "js-service")
                    .map(dirent => dirent.name);
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
        return dirArray;
    } else {
        return null;
    }
}

function chooseAPILevel(filepath) {
    if (fs.existsSync(filepath)) {
        return Promise.resolve();
    } else {
        return vscode.window
            .showInformationMessage(`There is no API level information in the folder of this project.
                                Do you want to create it?\n If you select "Yes", create ".webosstuido.config" file.
                                If not, you can't use the Luna API Auto Completion.`, ...["Yes", "No"])
        .then(async (answer) => {
            if (answer === "Yes") {
                let controller = new InputController();
                let apiList = ['20', '21', '22', '23', '24', '25', '27'];  // [REQUIRED] Update the api level when new version of OSE is released.

                    controller.addStep({
                        title: 'Choose API Level',
                        placeholder: `Select API Level`,
                        items: apiList.map(label => ({ label }))
                    });

                    let results = await controller.start();
                    let apiLevelNo = results.shift();

                    const level = {
                        api_level: apiLevelNo
                    }
                    const levelJSON = JSON.stringify(level, null, 2);

                    fs.writeFileSync(filepath, levelJSON);
                }
                else {
                    //console.log("No");
                }
                return Promise.resolve();
            });
    }
}

function setFromConvertCacheAPI() {
    const date_start = new Date();
    let fileData = "";
    let apiLevel = "";
    let apiIndex = 0;
    let filepath = "";
    let jsonData;
    let apiData = "";

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const activeTextEditors = vscode.window.activeTextEditor;

    if (!workspaceFolders) {
        vscode.window.showInformationMessage("Open a folder/workspace first");
        return;
    }

    if (activeTextEditors) {
        const docUri = activeTextEditors.document.uri;
        if (docUri?.fsPath) {
            const uriPath = docUri.fsPath;
            const parent = (vscode.Uri.file(path.dirname(uriPath)));
            const workspaceFloder = vscode.workspace.getWorkspaceFolder(parent);
            const appList = getAppsListinWorkspace(workspaceFloder.uri.fsPath);

            for (let appName of appList) {
                if (appName instanceof fs.Dirent && parent.fsPath.indexOf(appName.name) > 0) {
                    const file = vscode.Uri.file(path.join(workspaceFloder.uri.fsPath, appName.name, ".webosstudio.config"));
                    filepath = file.fsPath;
                }
            }
        }
    }

    try {
        fileData = fs.readFileSync(filepath, 'utf8');
    }
    catch (e) {
        console.log("err " + e);
        chooseAPILevel(filepath);
        return;
    }
    if (fileData) {
        jsonData = JSON.parse(fileData);
        apiData = jsonData.api_level;
    }

    if (!apiData) {
        let apiLevelStatus = "";
        let apiLevelStatusSplit = [];
        apiLevelStatus = vscode.workspace.getConfiguration().get("webosose.lunaApiLevel");
        if (apiLevelStatus.includes('#')) {
            apiLevelStatus = "OSE_APILevel_21";
            vscode.workspace.getConfiguration().update("webosose.lunaApiLevel", apiLevelStatus);
        }
        apiLevelStatusSplit = apiLevelStatus.split("_");
        apiLevel = apiLevelStatusSplit[apiLevelStatusSplit.length - 1];
    }
    else {
        apiLevel = apiData;
    }

    const findAPIIndex = apiObjArray.findIndex((element) => element["level"] === apiLevel);
    if (findAPIIndex != -1) { // aplilevel exists in the apiobj
        apiIndex = findAPIIndex;
    }
    else { // aplilevel doesn't exist in the apiobj
        const serviceObjArray = [];
        const methodObjArray = [];
        const paramObjArray = [];

        const jsonPath = path.join(__dirname, "resources/filterAPIByAPILevel_" + apiLevel + ".json");

        try {
            fileData = fs.readFileSync(jsonPath, 'utf8');
        }
        catch (e) {
            console.log("err " + e);
        }

        jsonData = JSON.parse(fileData);
        const jsonDataServices = jsonData.services;
        const jsonDataMethods = jsonData.methods;

        const replaceRegex = new RegExp("\\n\\n\\t", "g");
        const replaceString = "\n\t\t";

        for (const key in jsonDataServices) {
            let serviceName = "", serviceSummary = "";

            serviceName = jsonDataServices[key].uri;
            serviceName = changeServiceName(serviceName);
            if (serviceName == "remove") {
                continue;
            }

            serviceSummary = jsonDataServices[key].summary;

            const findSummaryIndex = serviceSummary.match(replaceRegex);

            if (findSummaryIndex) {
                serviceSummary = serviceSummary.replace(replaceRegex, replaceString);
            }

            const serviceObj = {
                "name": serviceName,
                "summary": serviceSummary
            };

            const findServiceIndex = serviceObjArray.findIndex((element) => element["name"] === serviceName);
            if (findServiceIndex == -1) {
                serviceObjArray.push(serviceObj);
            }
        }

        for (const key in jsonDataMethods) {
            let serviceName = "";
            let methodName = "", methodDesc = "", acgName = "";
            let paramsArray = [];
            const paramsList = [];

            const words = jsonDataMethods[key].uri.split('/');
            if (words.length > 1) {
                serviceName = words[0];
                methodName = jsonDataMethods[key].uri.substring(serviceName.length);
                methodDesc = jsonDataMethods[key].description;
                acgName = jsonDataMethods[key].acg;
                paramsArray = jsonDataMethods[key].parameters;

                serviceName = changeServiceName(serviceName);
                if (serviceName == "remove") {
                    continue;
                }

                for (const key in paramsArray) {
                    let paramName = "", requireName = "", typeName = "";

                    paramName = paramsArray[key].name;
                    requireName = paramsArray[key].required;
                    typeName = paramsArray[key].type;

                    const paramsObj = {
                        "name": paramName,
                        "required": requireName,
                        "type": typeName
                    };
                    paramsList.push(paramsObj);
                }

                const findServiceIndex = methodObjArray.findIndex((element) => element["name"] === serviceName);
                const findDescriptionIndex = methodDesc.match(replaceRegex);

                if (findDescriptionIndex) {
                    methodDesc = methodDesc.replace(replaceRegex, replaceString);
                }

                const methodObj = {
                    "name": methodName,
                    "description": methodDesc,
                    "acg": acgName
                };

                const paramObj = {
                    "name": methodName,
                    "params": paramsList
                };

                if (findServiceIndex != -1) {
                    const findMethodIndex = methodObjArray[findServiceIndex]["methods"].findIndex((element) => element["name"] === methodName);
                    if (findMethodIndex == -1) {
                        methodObjArray[findServiceIndex]["methods"].push(methodObj);
                        paramObjArray[findServiceIndex]["methods"].push(paramObj);
                    }
                } else {
                    // Add new serviceMethodObject including serviceName and method array.
                    // Add new serviceMethodParamObject including serviceName and method and param array.
                    const serviceMethodObj = {
                        "name": serviceName,
                        "methods": [methodObj]
                    };
                    methodObjArray.push(serviceMethodObj);

                    const serviceMethodParamObj = {
                        "name": serviceName,
                        "methods": [paramObj]
                    };
                    paramObjArray.push(serviceMethodParamObj);
                }
            }
        }
        serviceObjArray.sort(compareFn);
        methodObjArray.sort(compareFn);
        paramObjArray.sort(compareFn);
        const apiObj = {
            "level": apiLevel,
            "service": serviceObjArray,
            "method": methodObjArray,
            "param": paramObjArray
        };
        apiObjArray.push(apiObj);
        apiIndex = apiObjArray.length - 1;
    }

    const date_end = new Date();

    const elapsedMSec = date_end.getTime() - date_start.getTime();
    const elapsedSec = elapsedMSec / 1000;
    console.log(`Excution time of converting data function : ${elapsedSec} (s)`);
    return apiIndex;
}

function compareFn(a, b) {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();

    if (x < y) {
        return -1;
    }
    if (x > y) {
        return 1;
    }
    return 0;
}

function changeServiceName(serviceName) {
    let changeName = serviceName;
    if (serviceName === "com.webos.service.power") { // Remove duplicated service
        changeName = "remove";
    }
    else {
        if (serviceName.includes("palm")) { // Change the service name from palm to webos
            let replaceWord = "";
            if (serviceName.includes("service")) {
                replaceWord = "webos";
            }
            else {
                replaceWord = "webos.service";
            }
            changeName = serviceName.replace("palm", replaceWord);
        }
    }
    return changeName;
}

function findMethodInArray(serviceName) {
    const methodNameArr = [], methodDescrArr = [];
    const apiMethodArray = apiObjArray[apiObjArrayIndex].method;

    const findServiceIndex = apiMethodArray.findIndex((element) => element["name"] === serviceName);

    if (findServiceIndex != -1) {
        for (const i in apiMethodArray[findServiceIndex]["methods"]) {
            const methodItemName = apiMethodArray[findServiceIndex]["methods"][i].name;
            const mehthodItemDesc = apiMethodArray[findServiceIndex]["methods"][i].description;
            methodNameArr.push(methodItemName);
            methodDescrArr.push(mehthodItemDesc);
        }
    }
    return [methodNameArr, methodDescrArr];
}

function replaceAll(str, searchStr, replaceStr) {
    return str.split(searchStr).join(replaceStr);
}

function findParamInArray(serviceName, methodName) {
    const paramNameArr = [], paramDescrArr = [], paramRequiredArr = [], paramTypeArr = [];
    let methodParamDesc = "";

    let urlServiceName = replaceAll(serviceName, ".", "-");
    let urlMethodName = replaceAll(methodName, "/", "-");
    urlServiceName = urlServiceName.toLocaleLowerCase();
    urlMethodName = urlMethodName.toLocaleLowerCase();
    const urlName = `http://www.webosose.org/docs/reference/ls2-api//${urlServiceName}/#${urlMethodName}`;

    const apiParamArray = apiObjArray[apiObjArrayIndex].param;
    const findServiceIndex = apiParamArray.findIndex((element) => element["name"] === serviceName);

    if (findServiceIndex != -1) {
        const findMethodIndex = apiParamArray[findServiceIndex]["methods"].findIndex((element) => element["name"].substring(1) === methodName);
        if (findMethodIndex != -1) {
            for (const i in apiParamArray[findServiceIndex]["methods"][findMethodIndex]["params"]) {
                const paramItemName = apiParamArray[findServiceIndex]["methods"][findMethodIndex]["params"][i].name;
                const paramItemRequired = apiParamArray[findServiceIndex]["methods"][findMethodIndex]["params"][i].required;
                const paramItemType = apiParamArray[findServiceIndex]["methods"][findMethodIndex]["params"][i].type;
                const paramItemDesc = `<p><strong>${methodName}</strong> method parameter<br><br>required : <strong>${paramItemRequired} \
                                    </strong><br>type : <strong>${paramItemType}</strong><br><br> \
                                    <a href='${urlName}'>Site link of method(${methodName})</a></p>`;

                paramNameArr.push(paramItemName);
                paramRequiredArr.push(paramItemRequired);
                paramTypeArr.push(paramItemType);
                paramDescrArr.push(paramItemDesc);
            }
        }

        methodParamDesc = `<p><strong>Parameter list</strong> (${paramNameArr.length})<br>`;

        for (const i in paramNameArr) {
            let requiredString;
            if (paramRequiredArr[i] === "yes") {
                requiredString = "Required";
            }
            else {
                requiredString = "Optional";
            }
            const paramDesc = `<li><strong>${paramNameArr[i]}</strong> : ${paramTypeArr[i]} (${requiredString})</li>`;
            methodParamDesc = methodParamDesc + paramDesc;
        }
        methodParamDesc = methodParamDesc + `<br><a href='${urlName}'>Site link of method(${methodName})</a></p>`;
    }
    return [paramNameArr, paramDescrArr, [methodParamDesc]];
}


function getWebviewHome(resource) {
    const commonCssUri = resource + '/media/wizard/pageCommon.css';
    const cssUri = resource + '/media/wizard/pageHome.css';
    const scriptUri = resource + '/media/wizard/pageHome.js';
    const minHomeImg = resource + '/resources/wizard/start_logo_min.png';
    const maxHomeImg = resource + '/resources/wizard/start_logo_max.png';
    const selectRightIcon = resource + '/resources/wizard/select_right_icon.svg';
    return `<!DOCTYPE HTML>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Home</title>
        <link href="${cssUri}" rel="stylesheet">
        <link href="${commonCssUri}" rel="stylesheet">
        <script defer src="${scriptUri}" select-right-icon="${selectRightIcon}" \
            min-homeimg="${minHomeImg}" max-homeimg="${maxHomeImg}"></script>
    </head>
    <body>
        <div class="content" id="big-div" style="display: none; flex-direction: column; justify-content: center; align-items: center;">
            <a href="https://developer.lge.com/main/Intro.dev" target="_blank">
                <div class="img-large"></div>
            </a>

            <div class="grid-container-small">
                <label class="grid-container-label" for="selelct-webos-product">
                    webOS Product
                </label>
                <select name="selelct-webos-product" id="selelct-webos-product">
                        <option value="none" selected disabled hidden>====== select ======</option>
                        <option value="OSE">OSE</option>
                        <option value="TV">TV</option>
                </select>
                <label class="grid-container-label" for="selelct-api-version">
                    API Version
                </label>
                <select name="selelct-api-version" id="selelct-api-version" disabled>
                        <option value="none" selected disabled hidden>====== select ======</option>
                        <!--[REQUIRED] Update the api level when new version of OSE is released.-->
                        <option value="OSE_APILevel_27">OSE APILevel27</option>
                        <option value="OSE_APILevel_25">OSE APILevel25</option>
                        <option value="OSE_APILevel_24">OSE APILevel24</option>
                        <option value="OSE_APILevel_23">OSE APILevel23</option>
                        <option value="OSE_APILevel_22">OSE APILevel22</option>
                        <option value="OSE_APILevel_21">OSE APILevel21</option>
                        <option value="OSE_APILevel_20">OSE APILevel20</option>
                </select>

                <label class="grid-container-label" for="description">
                    Description
                </label>

                <textarea id="description" name="description" readonly>
                </textarea>

            </div>

            <button id="btn-generate" class="btn-large" disabled>Generate Project</button>

        </div>
    </body>
    </html>`
}

function getWebviewCreateProject(appTypeIndex, resource) {
    const commonCssUri = resource + '/media/wizard/pageCommon.css';
    const commonExceptHomeCssUri = resource + '/media/wizard/pageCommonExceptHome.css';
    const cssUri = resource + '/media/wizard/pageCreateProject.css';
    const scriptUri = resource + '/media/wizard/pageCreateProject.js';

    const btnLeftIcon = resource + '/resources/wizard/btn_left_icon.svg';
    const btnLeftIconDisabled = resource + '/resources/wizard/btn_left_icon_disabled.svg';
    const btnRightIcon = resource + '/resources/wizard/btn_right_icon.svg';
    const btnRightIconDisabled = resource + '/resources/wizard/btn_right_icon_disabled.svg';

    const listAllIcon = resource + '/resources/wizard/list_all_icon.svg';
    const listRightIcon = resource + '/resources/wizard/list_right_icon.svg';
    const listAllIconHover = resource + '/resources/wizard/list_all_icon_hover.svg';
    const listRightIconHover = resource + '/resources/wizard/list_right_icon_hover.svg';

    const basicWebappImg = resource + '/resources/wizard/basic_webapp.png';
    const hostedWebappImg = resource + '/resources/wizard/hosted_webapp.png';

    const noImg = resource + '/resources/wizard/no_image.svg';
    const moonstoneEnactappImg = resource + '/resources/wizard/moonstone_enactapp.png';
    const sandstoneEnactappImg = resource + '/resources/wizard/sandstone_enactapp.png';
    return `<!DOCTYPE HTML>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test</title>
        <link href="${cssUri}" rel="stylesheet">
        <link href="${commonExceptHomeCssUri}" rel="stylesheet">
        <link href="${commonCssUri}" rel="stylesheet">
        <script defer src="${scriptUri}" btn-left-icon="${btnLeftIcon}" btn-left-icon-disabled="${btnLeftIconDisabled}" \
            btn-right-icon="${btnRightIcon}" btn-right-icon-disabled="${btnRightIconDisabled}" \
            list-all-icon="${listAllIcon}" list-all-icon-hover="${listAllIconHover}" \
            list-right-icon="${listRightIcon}" list-right-icon-hover="${listRightIconHover}" \
            basic-webappimg="${basicWebappImg}" hosted-webappimg="${hostedWebappImg}" no-img="${noImg}" \
            moonstone-enactappimg="${moonstoneEnactappImg}" sandstone-enactappimg="${sandstoneEnactappImg}" \
            app-type-index="${appTypeIndex}">
        </script>
    </head>
    <body>
        <div class="content" id="big-div" style="display: none; flex-direction: column; justify-content: center; align-items: center;">
            <div class="navi-top-left">
                <span class="navi-top-left-text">Project wizard</span>
            </div>
            <div class="navi-top-right">
                <span class="navi-top-right-text">Template</span>
            </div>
            <div class="navi-left">
                <ul id = "list-project-type">
                    <li class="li-left all-img">All</li>
                    <li class="li-left right-img">Web App</li>
                    <li class="li-left right-img">JS Service</li>
                    <li class="li-left right-img">Enact App</li>
                </ul>
            </div>
            <div class="navi-bottom">
            </div>
            <div class="navi-bottom-btn-box">
                <button id="btn-back" class="btn-small btn-small-1">
                    <span class="btn-small-img-1"></span>
                    <span class="btn-small-text btn-small-text-1">Back</span>
                </button>
                <button id="btn-cancel" class="btn-small btn-small-2">
                    <span class="btn-small-text btn-small-text-2">Cancel</span>
                </button>
                <button id="btn-next" class="btn-small btn-small-3">
                    <span class="btn-small-text btn-small-text-3">Next</span>
                    <span class="btn-small-img-3"></span>
                </button>
            </div>

            <div class="page-create-middle-left">
                <ul id = "list-project-sub-type">
                </ul>
            </div>
            <div class="page-create-middle-right">
                <img src="${noImg}" id="app-img" class="img-small">
                <div class="desc-title">
                    Description
                </div>
                <div class="desc-text" id="desc-text">
                    When you select a project, you can view the description of the project
                </div>
            </div>
        </div>
    </body>
    </html>`
}

// this method is called when your extension is deactivated
function deactivate() { }

function appClone(app) {
    if (app != null && app.label != null) {
        return JSON.parse(JSON.stringify(app))
    } else {
        return null
    }
}
function deviceClone(dev) {
    if (dev != null && dev.label != null) {
        return JSON.parse(JSON.stringify(dev))
    } else {
        return null
    }
}
module.exports = {
    activate,
    deactivate
}

function getWebviewPropertyPage(appType, appTypeIndex, resource) {
    const commonCssUri = resource + '/media/wizard/pageCommon.css';
    const commonExceptHomeCssUri = resource + '/media/wizard/pageCommonExceptHome.css';
    const cssUri = resource + '/media/wizard/pageProperty.css';
    const scriptUri = resource + '/media/wizard/pageProperty.js';
    let defaultDir = '';
    if (getDefaultDir()) {
        defaultDir = path.resolve(getDefaultDir());
    }

    const btnLeftIcon = resource + '/resources/wizard/btn_left_icon.svg';
    const btnLeftIconDisabled = resource + '/resources/wizard/btn_left_icon_disabled.svg';
    const btnRightIcon = resource + '/resources/wizard/btn_right_icon.svg';
    const btnRightIconDisabled = resource + '/resources/wizard/btn_right_icon_disabled.svg';

    const listAllIcon = resource + '/resources/wizard/list_all_icon.svg';
    const listRightIcon = resource + '/resources/wizard/list_right_icon.svg';
    const listAllIconHover = resource + '/resources/wizard/list_all_icon_hover.svg';
    const listRightIconHover = resource + '/resources/wizard/list_right_icon_hover.svg';

    return `<!DOCTYPE HTML>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test</title>
        <link href="${cssUri}" rel="stylesheet">
        <link href="${commonExceptHomeCssUri}" rel="stylesheet">
        <link href="${commonCssUri}" rel="stylesheet">
        <script defer src="${scriptUri}"  btn-left-icon="${btnLeftIcon}" btn-left-icon-disabled="${btnLeftIconDisabled}" \
            btn-right-icon="${btnRightIcon}" btn-right-icon-disabled="${btnRightIconDisabled}" \
            list-all-icon="${listAllIcon}" list-all-icon-hover="${listAllIconHover}" \
            list-right-icon="${listRightIcon}" list-right-icon-hover="${listRightIconHover}" \
            selected-type="${appType}" app-type-index="${appTypeIndex}" default-dir="${defaultDir}">
        </script>
    </head>
    <body>
        <div class="content" id="big-div" style="display: none; flex-direction: column; justify-content: center; align-items: center;">
            <div class="navi-top-left">
                <span class="navi-top-left-text">Project wizard</span>
            </div>
            <div class="navi-top-right">
                <span class="navi-top-right-text">Template</span>
            </div>
            <div class="navi-left">
                <ul id = "list-project-type">
                    <li class="li-left all-img">All</li>
                    <li class="li-left right-img">Web App</li>
                    <li class="li-left right-img">JS Service</li>
                    <li class="li-left right-img">Enact App</li>
                </ul>
            </div>
            <div class="navi-bottom">
            </div>
            <div class="navi-bottom-btn-box">
                <button id="btn-back" class="btn-small btn-small-1">
                    <span class="btn-small-img-1"></span>
                    <span class="btn-small-text btn-small-text-1">Back</span>
                </button>
                <button id="btn-cancel" class="btn-small btn-small-2">
                    <span class="btn-small-text btn-small-text-2">Cancel</span>
                </button>
                <button id="btn-finish" class="btn-small btn-small-3">
                    <span class="btn-small-text btn-small-text-2">Finish</span>
                </button>
            </div>
            <div id="middle">
                <div class="page-property-middle">
                    <div class="property-header" id="property-header">Basic Web Application
                    </div>
                        <div class="property-guide" id="property-guide">Insert Application Information
                    </div>  
                    <div class="grid-container" id="container">
                        <label class="grid-container-label" for="project-location-input">Project Location</label>
                        <div class="filebox">
                            <input class="upload-name" id="project-location-input" placeholder="Enter Project Location" style="width:215px">
                            <label id="project-location-select" >Browse</label>
                        </div>
                        <label class="grid-container-label" for="project-name-input">Project Name</label>
                        <input type="text" id="project-name-input" placeholder="Enter Project Name" style="width:298px">
                        <label class="grid-container-label" id="project-id-label" for="project-id-input">App ID</label>
                        <input type="text" id="project-id-input" style="width:298px">
                        <label class="grid-container-label" id="app-version-label" for="app-version-input">App Version</label>
                        <input type="text" id="app-version-input" style="width:298px">
                        <label class="grid-container-label" id="app-title-label" for="app-title-input">App title</label>
                        <input type="text" id="app-title-input" style="width:298px">
                        <label class="grid-container-label" id="hosted-url-label" for="hosted-url-input">Hosted url</label>
                        <input type="text" id="hosted-url-input" style="width:298px">
                        <label class="grid-container-label" id="webOS-library-label">Add webOS library</label>
                        <div id = "webOS-library-check">
                            <label class="check-container">Yes<input type="checkbox" id = "check-yes" checked>
                                <span class="checkmark"></span>
                            </label>
                            <label class="check-container">No<input type="checkbox" id = "check-no">
                                <span class="checkmark"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>`
}
