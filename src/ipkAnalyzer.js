/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require("vscode");
const path = require('path');
const fs = require('fs');
const ar = require('ar-async');
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const rimraf = require('rimraf');
const catalogist = require('catalogist');
const fastFolderSizeSync = require('fast-folder-size/sync');
const ares = require('./lib/runCommand');
const notify = require('./lib/notificationUtils');
let tmpDirPath = undefined;
let uniqueno = 0;

class IPK_ANALYZER {

    constructor(context) {
        this.context = context
        this.editorVer = 1;
        this.expressServer = null;
        this.lastSrcCodeSavedPath = null;
        this.lastCompPath = null;
        this.panel = null;
    }

    startEditor() {

        vscode.commands.executeCommand('workbench.action.closeSidebar');
        vscode.commands.executeCommand('workbench.action.closePanel');

        this.panel = vscode.window.createWebviewPanel(
            'ipkanalyzer', // Identifies the type of the webview. Used internally
            'IPK Analyzer', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true,
                retainContextWhenHidden: true,

            }
        );
        this.panel.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            enableForms: true,
            // localResourceRoots: [
            //     this.context.extensionUri
            // ]
            // localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionUri, 'media'))]
        }
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
        this.panel.onDidDispose(
            () => {
                // this.expressServer.close();
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );

        /* ipkConfig = JSON.parse(fs.readFileSync(ipkConfigFile));
        tmpDirPath = temp.path(ipkConfig.tmpPath); */

        this.panel.webview.onDidReceiveMessage(async msg => {
            console.log("Webview message received-----------");
            console.log(msg.command);
            console.log(msg);
            switch (msg.command) {
                case 'IMPORT_IPK_FILE':
                    {
                        try {
                            const options = {
                                canSelectMany: false,
                                canSelectFolders: false,
                                canSelectFiles: true,
                                openLabel: 'Select IPK file to Import',
                                defaultUri: this.lastCompPath ? this.lastCompPath : this.getDefaultDir(),

                                // filters: {
                                //     'All files': ['*.comp']
                                // }
                            };
                            let tempFolder = undefined;
                            if (!msg.compare) {
                                tempFolder = "Temp1";
                            }
                            else
                                tempFolder = "Temp2";
                            vscode.window.showOpenDialog(options).then(fileUri => {
                                if (fileUri && fileUri[0]) {
                                    this.lastCompPath = vscode.Uri.file(fileUri[0].fsPath);
                                    const data = fs.readFileSync(fileUri[0].fsPath, 'utf8');
                                    tmpDirPath = vscode.Uri.joinPath(this.context.extensionUri, tempFolder).fsPath;
                                    if (path.extname(fileUri[0].fsPath) !== '.ipk') {
                                        vscode.window.showErrorMessage('Please select a packaged app with extension: *.ipk');
                                        return;
                                    }
                                    if (data == "" || data == null) {
                                        vscode.window.showErrorMessage('Selected file is empty');
                                        return;
                                    }
                                    const classInstance = this;

                                    // Progressbar Start
                                    this._removeTmpDir(tmpDirPath, async function (message) {
                                        try {
                                            if (message !== "REMOVE_SUCCESS") {
                                                vscode.window.showErrorMessage('Error!! ', message);
                                                return;
                                            }
                                            vscode.window.withProgress({
                                                location: vscode.ProgressLocation.Notification,
                                                title: "IPK Analyzer",
                                                cancellable: false
                                            }, async (progress) => {
                                                await notify.showProgress(progress, 5, `Loading Application Package(IPK)...`);
                                                let promise = new Promise((resolve, reject) => {
                                                    try {
                                                        console.log("_unpackIpk()");
                                                        let ipkFile = fileUri[0].fsPath;
                                                        const reader = new ar.ArReader(ipkFile);
                                                        if (!fs.existsSync(tmpDirPath)) {
                                                            fs.mkdirSync(tmpDirPath);
                                                        }
                                                        reader.on("entry", function (entry, next) {
                                                            console.log("started uppacking..");
                                                            const name = entry.fileName();
                                                            entry.fileData()
                                                                .pipe(fs.createWriteStream(path.resolve(tmpDirPath, name)))
                                                                .on("finish", function () {
                                                                    next();
                                                                });
                                                        });
                                                        reader.on("error", function (err) {
                                                            console.log(err);
                                                            return reject(err);
                                                        });
                                                        reader.on("close", function () {
                                                            console.log("unpack ipk close");
                                                            resolve("Success");
                                                            // next();
                                                        });
                                                    }
                                                    catch (e) {
                                                        console.log(e);
                                                        return reject(e);
                                                    }
                                                });
                                                // await notify.showProgress(progress, 25, `Extracting IPK contents...`);
                                                // this._unpackIpk(fileUri[0].fsPath)
                                                await promise.then(async (stdout) => {
                                                    console.log(stdout);
                                                    console.log("Unpack IPK completed..");
                                                    await notify.showProgress(progress, 15, `Extracting IPK contents...`);
                                                    if (fs.existsSync(path.resolve(tmpDirPath, "control.tar.gz"))) {
                                                        console.log("started extracting control.tar.gz..");
                                                        await decompress(path.resolve(tmpDirPath, "control.tar.gz"), tmpDirPath, {
                                                            plugins: [
                                                                decompressTargz()
                                                            ]
                                                        }).then(async (stdout) => {
                                                            console.log(stdout);
                                                            console.log("control.tar.gz decompressed");
                                                            await notify.showProgress(progress, 20, `Extracting IPK contents(data.tar.gz). It could take a few seconds...`);
                                                            if (fs.existsSync(path.resolve(tmpDirPath, "data.tar.gz"))) {
                                                                await decompress(path.resolve(tmpDirPath, "data.tar.gz"), tmpDirPath, {
                                                                    plugins: [
                                                                        decompressTargz()
                                                                    ]
                                                                }).then(async (stderr) => {
                                                                    console.log(stderr);
                                                                    console.log("data.tar.gz decompressed");
                                                                    var data = [];
                                                                    // return next();
                                                                    await notify.showProgress(progress, 30, `Reading application directories content. Please wait...`);
                                                                    // Check Applications directory(Temp\usr\palm\applications), if present load App directories/files into JSON data.
                                                                    // const appDirPath = super._getDirectoriesList._getDirectoriesList(path.resolve(tmpDirPath, "usr", "palm", "applications")); // Temp\usr\palm\applications
                                                                    const appsList = classInstance._getDirectoriesList(path.resolve(tmpDirPath, "usr", "palm", "applications")); // Temp\usr\palm\applications
                                                                    console.log("Dir list--->", appsList);
                                                                    let totalDirectorySize = (fastFolderSizeSync(path.resolve(tmpDirPath, "usr")) / 1024);
                                                                    appsList.forEach(item => {
                                                                        let appPath = path.resolve(tmpDirPath, "usr", "palm", "applications", item);
                                                                        let appDirData = catalogist.treeSync(appPath, { childrenAlias: "data" });
                                                                        classInstance._updateFolderSize(item, appDirData, true);
                                                                        let jsonObj = {};
                                                                        /*  let uniqueno = 0;
                                                                            uniqueno++; */
                                                                        uniqueno++;
                                                                        jsonObj.id = item + uniqueno;
                                                                        jsonObj.text = item;
                                                                        let appData = {};
                                                                        let apprawSize = (fastFolderSizeSync(appPath) / 1024);
                                                                        appData.rawFileSize = (apprawSize);
                                                                        appData.percent = ((apprawSize * 100) / totalDirectorySize);
                                                                        jsonObj.data = appData;
                                                                        let appJsonArr = classInstance._getAppServiceJsonTreeData(appDirData, totalDirectorySize);
                                                                        jsonObj.children = appJsonArr;
                                                                        data.push(jsonObj);
                                                                    });
                                                                    // Check Services directory, if present load all Services directories/files into JSON data.
                                                                    let serviceDirList;
                                                                    if (!fs.existsSync(path.resolve(tmpDirPath, "usr", "palm", "services")))
                                                                        serviceDirList = [];
                                                                    else
                                                                        serviceDirList = classInstance._getDirectoriesList(path.resolve(tmpDirPath, "usr", "palm", "services"));
                                                                    console.log("Dir list--->", serviceDirList);
                                                                    serviceDirList.forEach(item => {
                                                                        let servicePath = path.resolve(tmpDirPath, "usr", "palm", "services", item);
                                                                        let serviceDirData = catalogist.treeSync(servicePath, { childrenAlias: "data" });
                                                                        classInstance._updateFolderSize(item, serviceDirData, false);
                                                                        let jsonObj = {};
                                                                        /*         let uniqueno = 0;
                                                                                uniqueno++; */
                                                                        uniqueno++;
                                                                        jsonObj.id = item + uniqueno;
                                                                        jsonObj.text = item;
                                                                        let serviceData = {};
                                                                        let servicerawSize = (fastFolderSizeSync(servicePath) / 1024);
                                                                        serviceData.rawFileSize = (servicerawSize);
                                                                        serviceData.percent = ((servicerawSize * 100) / totalDirectorySize);
                                                                        jsonObj.data = serviceData;
                                                                        let serviceJsonArr = classInstance._getAppServiceJsonTreeData(serviceDirData, totalDirectorySize);
                                                                        jsonObj.children = serviceJsonArr;
                                                                        data.push(jsonObj);
                                                                    });
                                                                    await notify.showProgress(progress, 40, `Extracting package info from CLI. Please wait...`);
                                                                    let ipkAnalyzeArr = undefined;
                                                                    await ares.packageInfo(fileUri[0].fsPath)
                                                                        .then(async (stdout) => {
                                                                            console.log(stdout);
                                                                            ipkAnalyzeArr = stdout.split('\n');
                                                                        }).catch((err) => {
                                                                            throw err;
                                                                        });
                                                                    let ipkfileName = path.basename(fileUri[0].fsPath, '.ipk');
                                                                    let ipkfileSize = (classInstance._getFilesizeInBytes(fileUri[0].fsPath) / 1024);
                                                                    let ipkRawfile = (fastFolderSizeSync(path.resolve(tmpDirPath, "usr")) / 1024);
                                                                    await notify.showProgress(progress, 50, `Loading IPK Info...`);
                                                                    // this.panel.webview
                                                                    if (!msg.compare) {
                                                                        classInstance.panel.webview.postMessage({ command: 'importIPKData', treeData: data, ipkAnalyzeInfo: ipkAnalyzeArr, ipkFileInfo: { ipkfileName: ipkfileName, ipkfileSize: ipkfileSize, ipkRawfile: ipkRawfile } });
                                                                    }
                                                                    else {
                                                                        classInstance.panel.webview.postMessage({ command: 'compareIPKData', treeData: data, ipkAnalyzeInfo: ipkAnalyzeArr, ipkFileInfo: { ipkfileName: ipkfileName, ipkfileSize: ipkfileSize, ipkRawfile: ipkRawfile } });
                                                                    }
                                                                }).catch((err) => {
                                                                    console.error(err);
                                                                    vscode.window.showErrorMessage(`Error! Failed to decompress data.tar.gz.`);
                                                                    // reject(err);
                                                                });
                                                                // return next();
                                                            } else if (fs.existsSync(path.resolve(tmpDirPath, "data.tar.xz"))) {
                                                                await notify.showProgress(progress, 100, `Extracting IPK contents(data.tar.gz). It could take a few seconds...`);
                                                                // return next("NOT_SUPPORT_XZ");
                                                                vscode.window.showErrorMessage(`Error! Failed to decompress data.tar.xz. Format is not supported!`);
                                                            } else {
                                                                // return next("NO_COMPONENT_FILE data tar file");
                                                                await notify.showProgress(progress, 100, `Extracting IPK contents(data.tar.gz). It could take a few seconds...`);
                                                                vscode.window.showErrorMessage(`Error! Failed to decompress data.tar.xz. data tar file not found!`);
                                                            }
                                                        }).catch((err) => {
                                                            console.error(err);
                                                            // return next(err);
                                                            vscode.window.showErrorMessage(`Error! Failed to decompress control.tar.gz.`);
                                                            // reject(err);
                                                        });
                                                    } else if (fs.existsSync(path.resolve(tmpDirPath, "control.tar.xz"))) {
                                                        // return next("NOT_SUPPORT_XZ");
                                                        await notify.showProgress(progress, 100, `Extracting IPK contents...`);
                                                        // return next("NOT_SUPPORT_XZ");
                                                        vscode.window.showErrorMessage(`Error! Failed to decompress control.tar.xz. Format is not supported!`);
                                                    } else {
                                                        // return next("NO_COMPONENT_FILE control tar file");
                                                    }
                                                }).catch((err) => {
                                                    console.error(err);
                                                    vscode.window.showErrorMessage(`Error! Failed to extract IPK Contents!`);
                                                    // reject(err);
                                                });
                                            });

                                            // let canvasControlsJson = JSON.parse(data);
                                            // this.panel.webview.postMessage({ command: 'RenderImportedComp', "canvasControlsJson": this.migrateComponent(canvasControlsJson) })

                                        } catch (e) {
                                            console.log("Exception ", e);
                                            vscode.window.showErrorMessage("Error on reading IPK file, file format may different");
                                        }
                                    })
                                    // Progressbar End
                                }
                            });
                        } catch (e) {
                            console.log("Exception ", e);
                            vscode.window.showErrorMessage("Error on importing the component");
                        }
                        break;
                    }
                case 'ERROR_MESSAGE':
                    {
                        vscode.window.showErrorMessage(`Error! "${msg.text}"!`);
                        // `${path.join(await getCliPath(), 'ares-install')} -r ${appId} -d "${device}"`;
                        break; // msg.text
                    }
            }
        });
    }

    _getDirectoriesList(path) {
        return fs.readdirSync(path).filter(function (file) {
            return fs.statSync(path + '/' + file).isDirectory();
        });
    }

    _updateFolderSize(appserviceId, jsonObj, isApp) {
        let appservicePath = undefined;
        if (isApp)
            appservicePath = path.resolve(tmpDirPath, "usr", "palm", "applications", appserviceId);
        else
            appservicePath = path.resolve(tmpDirPath, "usr", "palm", "services", appserviceId);
        jsonObj.forEach(obj => {
            Object.entries(obj).forEach(() => { // obj["fullPath"]
                // path.resolve(tmpDirPath, "usr", "palm", "applications", "com.domain.testenactwebosls2")
                if (obj["isDirectory"] == true && obj["data"].length > 0) {
                    const bytes = fastFolderSizeSync(path.resolve(appservicePath, obj["fullPath"]));
                    obj["size"] = bytes;
                    // console.log(`${key} ${value}`);
                    // var jsonData = obj["data"];
                    // updateFolderSize(jsonData);
                }
            });
        });
    }

    _getAppServiceJsonTreeData(appServiceTreeData, totalDirectorySize) {
        let jsonObjArr = [];
        // Fill App/Service Object tree data
        appServiceTreeData.forEach(obj => {
            let jsonObj = {};
            uniqueno++;
            jsonObj.id = obj["name"] + uniqueno;
            jsonObj.text = obj["fullName"];
            if (obj["isDirectory"] == false)
                jsonObj.type = "file";
            else
                jsonObj.type = "folder";
            let appData = {};
            let apprawSize = (obj["size"] / 1024);
            appData.rawFileSize = (apprawSize);
            appData.percent = ((apprawSize * 100) / totalDirectorySize);
            jsonObj.data = appData;
            let childrenData = [];
            // path.resolve(tmpDirPath, "usr", "palm", "applications", "com.domain.testenactwebosls2")
            if (obj["isDirectory"] == true && obj["data"].length > 0) {
                // console.log(`${key} ${value}`);
                let childrenList = this._getAppServiceJsonTreeData(obj["data"], totalDirectorySize);

                childrenData = JSON.parse(JSON.stringify(childrenList));
            }
            jsonObj.children = childrenData;
            jsonObjArr.push(jsonObj);
        });

        return jsonObjArr;
        // tree data
    }

    _getFilesizeInBytes(filename) {
        var stats = fs.statSync(filename);
        var fileSizeInBytes = stats.size;
        return fileSizeInBytes;
    }

    getDefaultDir() {
        let folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri;

        } else {
            return null;
        }
    }

    _removeTmpDir(tmpDirPath, next) {
        console.log("packageIPK()#_removeTmpDir()");
        if (!fs.existsSync(tmpDirPath)) {
            return next("REMOVE_SUCCESS");
        }
        rimraf(tmpDirPath, function (err) {
            if (err) {
                return next(err);
            }
            console.log("IPK Temp folder removed " + tmpDirPath);
            return next("REMOVE_SUCCESS");
        });
    }

    /*     async _unpackIpk(ipkFile, next) {
            try {
                console.log("_unpackIpk()");
                const reader = new ar.ArReader(ipkFile);
                tmpDirPath = vscode.Uri.joinPath(this.context.extensionUri, "Temp").fsPath;
                if (!fs.existsSync(tmpDirPath)) {
                    fs.mkdirSync(tmpDirPath);
                }
                reader.on("entry", function (entry, next) {
                    console.log("started uppacking..");
                    const name = entry.fileName();
                    entry.fileData()
                        .pipe(fs.createWriteStream(path.resolve(tmpDirPath, name)))
                        .on("finish", function () {
                            next();
                        });
                });
                reader.on("error", function (err) {
                    console.log(err);
                    return next(err);
                });
                reader.on("close", function () {
                    console.log("unpack ipk close");
                    //next();
                });
            }
            catch (e) {
                console.log(e);
                return next(e);
            }
        } */

    async _unpackTar(next) {
        if (fs.existsSync(path.resolve(tmpDirPath, "control.tar.gz"))) {
            await decompress(path.resolve(tmpDirPath, "control.tar.gz"), tmpDirPath, {
                plugins: [
                    decompressTargz()
                ]
            }).catch((err) => {
                console.error(err);
                return next(err);
                // vscode.window.showErrorMessage(`Error! Failed to run enact lint.`);
                // reject(err);
            });
            console.log("control.tar.gz decompressed");
            if (fs.existsSync(path.resolve(tmpDirPath, "data.tar.gz"))) {
                (async function (next) {
                    /*                     await decompress(path.resolve(tmpDirPath, "data.tar.gz"), tmpDirPath, {
                                            plugins: [
                                                decompressTargz()
                                            ]
                                        }).then(async (stderr) => {
                                            console.log(stderr);
                                            console.log("data.tar.gz decompressed");
                                            return next();
                                        }).catch((err) => {
                                            console.error(err);
                                            return next(err);
                                            vscode.window.showErrorMessage(`Error! Failed to run enact lint.`);
                                            //reject(err);
                                        }); */
                    console.log("data.tar.gz decompressed");
                    return next();
                })();
            } else if (fs.existsSync(path.resolve(tmpDirPath, "data.tar.xz"))) {
                return next("NOT_SUPPORT_XZ");
            } else {
                return next("NO_COMPONENT_FILE data tar file");
            }
        } else if (fs.existsSync(path.resolve(tmpDirPath, "control.tar.xz"))) {
            return next("NOT_SUPPORT_XZ");
        } else {
            return next("NO_COMPONENT_FILE control tar file");
        }
    }

    getHtmlForWebview(webview) {
        const styleCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", 'style.min.css'));
        const fontawesomeCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", 'font-awesome.min.css'));

        const jqueryJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", "jquery-2.1.0", 'jquery-2.1.0.js'));
        const jqueryUiJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", "jquery-ui1.11.4", 'jquery-ui.js'));
        const jstreeJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", "jstree3.2.1", 'jstree.min.js'));
        const jstreetableJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", 'jstreetable.js'));
        const bootstrapCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', "lib", "jstree-table", 'bootstrap.min.css'));

        return `<!DOCTYPE html>
			<html lang="en">
            <head>
            <link href="${styleCss}" rel="stylesheet">
            <link href="${fontawesomeCss}" rel="stylesheet">
            <script type='text/javascript' src="${jqueryJs}"></script>
            <script type='text/javascript' src="${jqueryUiJs}"></script>
            <script type="text/javascript" src="${jstreeJs}"></script>
            <script type="text/javascript" src="${jstreetableJs}"></script>
            <style type="text/css">
                @import url('${bootstrapCss}');
                body {
                    margin: 1em;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background) !important;
                }
                code {
                    font-size: var(--vscode-editor-font-size);
                    font-family: var(--vscode-editor-font-family);
                }         
                label {
                    color: var(--vscode-label-foreground);
                    background: var(--vscode-label-background);
                    font-size: var(--vscode-editor-font-size);
                    font-family: var(--vscode-editor-font-family);
                }
                button {
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                }
                button:hover {
                    cursor: pointer;
                    background: var(--vscode-button-hoverBackground);
                }                
                button:focus {
                    outline-color: var(--vscode-focusBorder);
                }
                button.secondary {
                    color: var(--vscode-button-secondaryForeground);
                    background: var(--vscode-button-secondaryBackground);
                }                
                button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .jstree-table-wrapper {
                    /* border: 1px solid #ccc;*/
                    width:100% !important
                }
             
                .jstree-clicked{
                    color:  var(--vscode-editor-foreground)!important;
                    background-color: var(--vscode-editor-background)!important;
                }
                .jstree-clicked :hover{
                    color:  var(--vscode-editor-foreground)!important;
                    background-color: var(--vscode-editor-background)!important;
                }
              .jstree-table-cell{
                color:  var(--vscode-editor-foreground)!important;
                background-color: var(--vscode-editor-background)!important;
              }
                
                .jstree-hovered{
                    color:  var(--vscode-editor-foreground)!important;
                    background-color: var(--vscode-editor-background)!important;
                }
                .jstree-hovered :active{
                    color:  var(--vscode-editor-foreground)!important;
                    background-color: var(--vscode-editor-background)!important;
                }
            
               
                .jstree-table-header-regular{
                    color:  var(--vscode-activityBar-foreground)!important;
                    background-color: var(--vscode-activityBar-background)!important;
                    cursor: pointer;
              
                    width:1% !important
                }
                .jstreediv {
                    color: var(--vscode-label-foreground);
                    background: var(--vscode-label-background);
              
                    activeSelectionBackground: #2a273f;
                    activeSelectionForeground: #8076C2;
                    inactiveSelectionBackground: #2a273f;
                    inactiveSelectionForeground: #8076C2;
                    highlightForeground:#8076C2;
                    hoverBackground: #1f2636;
              
                }
                .collButton{
                    color:  var(--vscode-activityBar-foreground)!important;
                    background-color: var(--vscode-activityBar-background)!important;
                }
                .collapsible {
                    color: white;
                    cursor: pointer;
                    padding: 2px;
                    width: 100%;
                    border: none;
                    text-align: left;
                    outline: none;
                    font-size: 15px;
                  }
                  
                  .active, .collapsible:hover {
                  
                  }
                  
                  .collapsible:after {
                    content: '\\25BC';
                    font-weight: bold;
                    float: right;
                    margin-left: 5px;
                  }
                  
                  .active:after {
                    content: "\\25B2";
                  }
                  
                  .content {
                    padding: 0 18px;
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.2s ease-out;
                    color: var(--vscode-label-foreground);
                    background: var(--vscode-label-background);
                    font-size: var(--vscode-editor-font-size);
                    font-family: var(--vscode-editor-font-family);
                  }
                  .ipkinfofont {
                    font-size: 13px;
                    font-weight: 400;
                    padding-left: 2px;
                    padding-top: 3px;
                  }
                  .{

                  }
            </style>
            <script type="text/javascript">


            </script>
        </head>
        <body>
        <div id="test1">
        <button type="button" onclick="importIPKFile()" id="btnImport">Import IPK</button>
        <label for="test" id="ipkfileName"> IPK File (version 1.0.0)</label><br>
        <b><label for="html" id="lblipkRawfile">Raw File Size : </label></b>&nbsp;<label for="test" id="ipkRawfile">HEJJJJJJJJJABCDEFGHIJ</label> &nbsp;&nbsp;&nbsp;&nbsp;
        <b><label for="html" id="lblipkfileSize">Download Size : </label></b>&nbsp;<label for="test" id="ipkfileSize">ABCDEFGHIJHEJJJJJJJJJ</label>
            </div>
            <div id = "jstreeParent">
            <div id="jstree" class="jstreediv">
            </div>
            </div>
            <button type="button" class="collapsible collButton" onclick="showImportIPKDetails()" id="coll1">IPK Analysis Details</button>
<div class="content" id="coll2">
  <span>Lorem ipsum dolor sit amet
consectetur adipisicing elit, sed do eiusmod tempor
Ut enim ad minim veniam, quis nostrud exercitation ullamco.</span>
</div><br>
<div id="test2">
<button type="button" onclick="compareIPKFile()" id="btnCompare">Compare IPK</button>
<label for="test" id="ipkfileName2"> IPK File (version 1.0.0)</label><br>
<b><label for="html" id="lblipkRawfile2">Raw File Size : </label></b>&nbsp;<label for="test" id="ipkRawfile2">HEJJJJJJJJJABCDEFGHIJ</label> &nbsp;&nbsp;&nbsp;&nbsp;
<b><label for="html" id="lblipkfileSize2">Download Size : </label></b>&nbsp;<label for="test" id="ipkfileSize2">ABCDEFGHIJHEJJJJJJJJJ</label>
    </div>
    <div id = "jstree1Parent">
<div id="jstree1"></div>
</div>
<button  type="button" class="collapsible collButton" onclick="showCompareIPKDetails()" id="coll3">IPK Analysis Details</button>
<div class="content" id="coll4">
  <span>Lorem ipsum dolor sit amet
consectetur adipisicing elit, sed do eiusmod tempor
Ut enim ad minim veniam, quis nostrud exercitation ullamco.</span>
</div>
        </body>
        <script type="text/javascript">
        const vscode = acquireVsCodeApi();
        function getJSTreeData(data){
            var jstreeOptions = {
                plugins: ["table","contextmenu","sort","types"],
                core: {
                    data: data,
                    check_callback: true
                },
                "types" : {
                    "default" : {
                        "icon" : "fa fa-folder text-warning"
                    },
                    "file" : {
                        "icon" : "fa fa-file  text-warning"
                    }
                },
                // configure tree table
                table: {
                    columns: [
                        {width: 400, header: "Resource"},
                        {width: 300, value: "rawFileSize", header: "Raw File Size", format: function(v) {if (v){ return v.toFixed(2)+'KB' }}},
                        {width: 300, value: "percent", header: "% of Total Raw File Size", format: function(v) {if (v){ return v.toFixed(2)+'%' }}}
                    ],
                    resizable: false,
                    draggable: false,
                    contextmenu: false,
                    height: 150,
                    columnWidth:1000,
                    contextmenu:false,
                    headerContextMenu:false
                }
            };
            return jstreeOptions;
        }
            $(document).ready(function(){
                // tree data
                // load jstree
                //$("div#jstree").jstree(jstreeOptions);
            });
            //width: 500,
            //height: 200
            function loadJSTreeData(data, element){
                if(vscode == null || vscode == undefined)
                    vscode = acquireVsCodeApi();

                vscode.postMessage({
                    command: 'IMPORT_IPK_FILE',
                    text: 'importIPKFile'
                })
            }
            window.addEventListener('message', event => {
                const message = event.data; // The JSON data our extension sent
                switch (message.command) {
                    case 'importIPK':
                        var iframeElement = document.getElementById("previewEle");
                        var url = iframeElement.getAttribute("src");
                        iframeElement.setAttribute("src", url + "?couter=" + Math.random());
                        break;
                    case 'importIPKData':
                        var jstreeOptions = getJSTreeData(message.treeData);
                        //var url = iframeElement.getAttribute("src");//jstreeOptions
                        var ipkfileName = document.getElementById("ipkfileName");
                        ipkfileName.style.display = "inline";
                        var lblipkRawfile = document.getElementById("lblipkRawfile");
                        lblipkRawfile.style.display = "inline";
                        var ipkRawfile = document.getElementById("ipkRawfile");
                        ipkRawfile.style.display = "inline";
                        var lblipkfileSize = document.getElementById("lblipkfileSize");
                        lblipkfileSize.style.display = "inline";
                        var ipkfileSize = document.getElementById("ipkfileSize");
                        ipkfileSize.style.display = "inline";
                        var jstree = document.getElementById("jstree");
                        jstree.style.display = "block";
                        var coll1 = document.getElementById("coll1");
                        coll1.style.display = "block";
                        var coll2 = document.getElementById("coll2");
                        coll2.style.display = "block";
            
                        var btnCompare = document.getElementById("btnCompare");
                        btnCompare.style.display = "inline";
                        // load jstree
                        document.getElementById("jstreeParent").innerHTML ="<div id='jstree' class='jstreediv'></div>"
                        $("div#jstree").jstree(jstreeOptions);
                        var ipkInfoObj = message.ipkFileInfo;
                        //IPK File name
                        ipkfileName.innerHTML = ipkInfoObj["ipkfileName"];
                        ipkRawfile.innerHTML = ipkInfoObj["ipkRawfile"] + " KB";
                        ipkfileSize.innerHTML = ipkInfoObj["ipkfileSize"] + " KB";
                        //IPK Analyze Info
                        var ipkAnalyzeInfo = message.ipkAnalyzeInfo;
                        coll2.innerHTML = "";
                        ipkAnalyzeInfo.forEach(item => {
                            const break1 = document.createElement("br");
                            const span = document.createElement("span");
                            span.innerHTML = item;
                            coll2.appendChild(span);
                            coll2.appendChild(break1);
                        });
                        break;
                    case 'compareIPKData':
                        var jstreeOptions = getJSTreeData(message.treeData);
                        var ipkfileName2 = document.getElementById("ipkfileName2");
                        ipkfileName2.style.display = "inline";
                        var lblipkRawfile2 = document.getElementById("lblipkRawfile2");
                        lblipkRawfile2.style.display = "inline";
                        var ipkRawfile2 = document.getElementById("ipkRawfile2");
                        ipkRawfile2.style.display = "inline";
                        var lblipkfileSize2 = document.getElementById("lblipkfileSize2");
                        lblipkfileSize2.style.display = "inline";
                        var ipkfileSize2 = document.getElementById("ipkfileSize2");
                        ipkfileSize2.style.display = "inline";
                        var jstree1 = document.getElementById("jstree1");
                        jstree1.style.display = "block";
                        var coll3 = document.getElementById("coll3");
                        coll3.style.display = "block";
                        var coll4 = document.getElementById("coll4");
                        coll4.style.display = "block";

                        // load jstree1
                        document.getElementById("jstree1Parent").innerHTML ="<div id='jstree1' class='jstreediv'></div>"
                        $("div#jstree1").jstree(jstreeOptions);
                        var ipkInfoObj = message.ipkFileInfo;
                        //IPK File name
                        ipkfileName2.innerHTML = ipkInfoObj["ipkfileName"];
                        ipkRawfile2.innerHTML = ipkInfoObj["ipkRawfile"] + " KB";
                        ipkfileSize2.innerHTML = ipkInfoObj["ipkfileSize"] + " KB";
                        //IPK Analyze Info
                        var ipkAnalyzeInfo = message.ipkAnalyzeInfo;
                        coll4.innerHTML = "";
                        ipkAnalyzeInfo.forEach(item => {
                            const break1 = document.createElement("br");
                            const span = document.createElement("span");
                            span.innerHTML = item;
                            coll4.appendChild(span);
                            coll4.appendChild(break1);
                        });
                        break;
        
                }
            });
            function importIPKFile(){
                if(vscode == null || vscode == undefined)
                    vscode = acquireVsCodeApi();

                vscode.postMessage({
                    command: 'IMPORT_IPK_FILE',
                    text: 'importIPKFile',
                    compare:false
                })
            }

            function compareIPKFile(){
                if(vscode == null || vscode == undefined)
                    vscode = acquireVsCodeApi();
                if($('#jstree').html().length == 0)
                {
                    console.log("compare error #################################");
                    //Alert
                    vscode.postMessage({
                        command: 'ERROR_MESSAGE',
                        text: 'Please import the IPK file for comparison!',
                        compare:true
                    })
                }
                else{
                    console.log("Coming to compare import ##########################");
                    vscode.postMessage({
                        command: 'IMPORT_IPK_FILE',
                        text: 'importIPKFile',
                        compare:true
                    })
                }
            }

            function showImportIPKDetails(){
                var element = document.getElementById("coll1");
                element.classList.toggle("active");
                var content = document.getElementById("coll2");
                console.log("###################");
                console.log(content.style);
                console.log(content.style.maxHeight);
                if (content.style.maxHeight){
                  content.style.maxHeight = null;
                } else {
                  content.style.maxHeight = content.scrollHeight + "px";
                }
            }

            function showCompareIPKDetails(){
                var element = document.getElementById("coll3");
                element.classList.toggle("active");
                var content = document.getElementById("coll4");
                console.log("###################");
                console.log(content.style);
                console.log(content.style.maxHeight);
                if (content.style.maxHeight){
                  content.style.maxHeight = null;
                } else {
                  content.style.maxHeight = content.scrollHeight + "px";
                }
            }

        //var coll1 = document.getElementById("coll1");
                
        /*coll1.addEventListener("click", function() {
            var element = document.getElementById("coll1");
            element.classList.toggle("active");
            var content = document.getElementById("coll2");
            console.log("###################");
            console.log(content.style);
            console.log(content.style.maxHeight);
            if (content.style.maxHeight){
              content.style.maxHeight = null;
            } else {
              content.style.maxHeight = content.scrollHeight + "px";
            }
          });*/

          //var coll3 = document.getElementById("coll3");
                
          /*coll3.addEventListener("click", function() {
              var element = document.getElementById("coll3");
              element.classList.toggle("active");
              var content = document.getElementById("coll4");
              console.log("###################");
              console.log(content.style);
              console.log(content.style.maxHeight);
              if (content.style.maxHeight){
                content.style.maxHeight = null;
              } else {
                content.style.maxHeight = content.scrollHeight + "px";
              }
            });*/
            //By default hide all the elements except Import
            var ipkfileName = document.getElementById("ipkfileName");
            ipkfileName.style.display = "none";
            var lblipkRawfile = document.getElementById("lblipkRawfile");
            lblipkRawfile.style.display = "none";
            var ipkRawfile = document.getElementById("ipkRawfile");
            ipkRawfile.style.display = "none";
            var lblipkfileSize = document.getElementById("lblipkfileSize");
            lblipkfileSize.style.display = "none";
            var ipkfileSize = document.getElementById("ipkfileSize");
            ipkfileSize.style.display = "none";
            var jstree = document.getElementById("jstree");
            jstree.style.display = "none";
            var coll1 = document.getElementById("coll1");
            coll1.style.display = "none";
            var coll2 = document.getElementById("coll2");
            coll2.style.display = "none";

            var btnCompare = document.getElementById("btnCompare");
            btnCompare.style.display = "none";
            var ipkfileName2 = document.getElementById("ipkfileName2");
            ipkfileName2.style.display = "none";
            var lblipkRawfile2 = document.getElementById("lblipkRawfile2");
            lblipkRawfile2.style.display = "none";
            var ipkRawfile2 = document.getElementById("ipkRawfile2");
            ipkRawfile2.style.display = "none";
            var lblipkfileSize2 = document.getElementById("lblipkfileSize2");
            lblipkfileSize2.style.display = "none";
            var ipkfileSize2 = document.getElementById("ipkfileSize2");
            ipkfileSize2.style.display = "none";
            var jstree1 = document.getElementById("jstree1");
            jstree1.style.display = "none";
            var coll3 = document.getElementById("coll3");
            coll3.style.display = "none";
            var coll4 = document.getElementById("coll4");
            coll4.style.display = "none";

        </script>
			</html>`;
    }
}

exports.IPK_ANALYZER = IPK_ANALYZER;
