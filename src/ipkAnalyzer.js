/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require("vscode");
const path = require('path');
const fs = require('fs');
const ar = require('ar-async');
const ares = require('./lib/runCommand');
const notify = require('./lib/notificationUtils');
const _7z = require("7zip-min");
const { logger } = require('./lib/logger');

class IPK_ANALYZER {

    constructor(context) {
        this.context = context
        this.lastCompPath = null;
        this.panel = null;
        this.flatJson = {};
        this.flatJson_pathKey = {};
        this.setiJson = this.getSetiJson();
        this.lAresInfo = "";
        this.rAresInfo = "";

        this.lSrcDir = path.join(vscode.Uri.joinPath(this.context.extensionUri).fsPath, "L");
        this.rSrcDir = path.join(vscode.Uri.joinPath(this.context.extensionUri).fsPath, "R");
        this.leftFilePath = "";
        this.leftExtractedFilePath = ""
        this.leftFileTreeJson = null;
        this.leftFileFlatJson = null
        this.leftFileFlatJson_pathKey = null
        this.leftFileCompareJson = null

        this.rightFilePath = "";
        this.rightExtractedFilePath = ""
        this.rightFileTreeJson = null;
        this.rightFileFlatJson = null
        this.rightFileFlatJson_pathKey = null
        this.rightFileCompareJson = null
        this.isAnalysing = false;
    }
    getSetiJson() {
        // getting Config json , which contains the component information
        let jsonPath = vscode.Uri.joinPath(this.context.extensionUri,
            "media",
            "ipk_analyzer",
            "seti_theme",
            "seti.json");
        let setJson = "";
        try {
            setJson = fs.readFileSync(jsonPath.fsPath, "utf8");
            return JSON.parse(setJson);
        } catch (e) {
            return {};
        }
    }
    async doAresInfo(ipkPath, fileSide) {

        if (fileSide == "L") {
            this.lAresInfo = ""
        } else {
            this.rAresInfo = ""
        }
        await ares.packageInfo(ipkPath)
            .then(async (stdout) => {
                if (fileSide == "L") {
                    this.lAresInfo = stdout
                } else {
                    this.rAresInfo = stdout;
                }
                let msgComp = {
                    command: "ARES_INFO",
                    data: {
                        info: stdout,
                        fileSide: fileSide,
                    },
                };
                if (this.panel && this.panel.webview) {
                    this.panel.webview.postMessage(msgComp);
                }

            }).catch((err) => {
                console.log(err)
            });
    }
    postIPKAnalysisStoped(fileSide, isWithError) {
        this.isAnalysing = false
        let msgComp = {
            command: "ANALYSIS_STOPED",
            data: {
                fileSide: fileSide,
                isWithError: isWithError
            },
        };
        if (this.panel && this.panel.webview) {
            this.panel.webview.postMessage(msgComp);
        }
    }
    postIPKAnalysisReportGettingReady(fileSide, filePath) {
        let msgComp = {
            command: "REPORT_READY",
            data: {
                fileSide: fileSide,
                filePath: filePath,
                otherFilePath: fileSide == "L" ? this.rightFilePath : this.leftFilePath
            },
        };
        if (this.panel && this.panel.webview) {
            this.panel.webview.postMessage(msgComp);
        }
    }
    analysIPKFile(isLaunching, msgData) {
        this.isAnalysing = true;
        const options = {
            canSelectMany: false,
            canSelectFolders: false,
            canSelectFiles: true,
            openLabel: "Select IPK file",
            defaultUri: this.lastCompPath ? this.lastCompPath : this.getDefaultDir(),
            filters: {
                'All files': ['*.ipk']
            }
        };
        vscode.window.showOpenDialog(options).then(async (folderUri) => {
            if (folderUri && folderUri[0]) {
                this.lastCompPath = vscode.Uri.file(folderUri[0].fsPath);
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `IPK Analyzer`,
                    cancellable: false
                }, async (progress) => {
                    this.progress = progress;
                    this.notify = notify
                    this.doAresInfo(folderUri[0].fsPath, msgData.fileSide)
                    await notify.showProgress(progress, 15, `Extracting File`);


                    let extFilePath = ""
                    if (msgData.fileSide == "L") {
                        extFilePath = this.lSrcDir;

                    } else {
                        extFilePath = this.rSrcDir
                    }

                    await this.readIPKArchiveAndWrite(folderUri[0].fsPath, extFilePath).then(async () => {
                        if (!this.isAnalysing && !this.panel) {
                            return Promise.reject()

                        }
                        await notify.showProgress(progress, 5, `Extracting File`);

                        await this.unzipFile(path.join(extFilePath, "data.tar.gz"), path.join(extFilePath, "tar")).then(async () => {
                            if (!this.isAnalysing && !this.panel) {
                                return Promise.reject()
                            }
                            await notify.showProgress(progress, 20, `Extracting File`);

                            await this.unzipFile(path.join(extFilePath, "tar", "data.tar"), path.join(extFilePath, "sourceCode")).then(async () => {
                                if (!this.isAnalysing && !this.panel) {
                                    return Promise.reject()
                                }
                                await notify.showProgress(progress, 15, `Generating Report`);

                                this.postIPKAnalysisReportGettingReady(msgData.fileSide, folderUri[0].fsPath)


                                // get Flat and tree json
                                this.flatJson = {};
                                this.flatJson_pathKey = {};
                                let srcDir = path.join(extFilePath, "sourceCode");
                                if (isLaunching) this.doStartEditor()


                                await notify.clearProgress(progress, `Report Generated.`);

                                this.diretoryToTreeAndFlatObj(srcDir, msgData.fileSide, async (err, res) => {

                                    if (err) {
                                        this.postIPKAnalysisStoped(msgData.fileSide, true)
                                        return Promise.reject()
                                    } else {


                                        let treeJson =
                                        {
                                            name: path.basename(srcDir),
                                            key: this.convertToKey(srcDir, msgData.fileSide),
                                            pathKey: this.convertToLevelKey(srcDir, msgData.fileSide),
                                            isFolder: true,
                                            size: 0,
                                            path: srcDir,
                                            children: res
                                        }
                                        this.flatJson[this.convertToKey(srcDir, msgData.fileSide)] = { name: path.basename(srcDir), size: 0, isFolder: true }
                                        this.flatJson_pathKey[this.convertToLevelKey(srcDir, msgData.fileSide)] = { name: path.basename(srcDir), size: 0, isFolder: true }
                                        this.sortJsonChildren(treeJson)
                                        this.calculateFolderSize(treeJson)
                                        this.calculateSizePercentageAndConvert(treeJson, treeJson["size"])

                                        if (msgData.fileSide == "L") {
                                            this.leftFilePath = folderUri[0].fsPath
                                            this.leftExtractedFilePath = srcDir
                                            this.leftFileTreeJson = JSON.parse(JSON.stringify(treeJson))
                                            this.leftFileFlatJson = JSON.parse(JSON.stringify(this.flatJson));
                                            this.leftFileFlatJson_pathKey = JSON.parse(JSON.stringify(this.flatJson_pathKey))
                                            this.leftFileCompareJson = JSON.parse(JSON.stringify(treeJson)) // same file 
                                        } else {
                                            this.rightFilePath = folderUri[0].fsPath
                                            this.rightExtractedFilePath = srcDir
                                            this.rightFileTreeJson = JSON.parse(JSON.stringify(treeJson))
                                            this.rightFileFlatJson = JSON.parse(JSON.stringify(this.flatJson))
                                            this.rightFileFlatJson_pathKey = JSON.parse(JSON.stringify(this.flatJson_pathKey))
                                            this.rightFileCompareJson = JSON.parse(JSON.stringify(treeJson)) //same file initialy
                                        }

                                        // generate comparison json
                                        if (this.rightFileTreeJson && this.leftFileTreeJson) {
                                            this.leftFileCompareJson = JSON.parse(JSON.stringify(this.leftFileTreeJson))
                                            this.rightFileCompareJson = JSON.parse(JSON.stringify(this.rightFileTreeJson))

                                            this.compareJSON(this.leftFileCompareJson, this.rightFileFlatJson, this.rightFileFlatJson_pathKey)
                                            this.compareJSON(this.rightFileCompareJson, this.leftFileFlatJson, this.leftFileFlatJson_pathKey)

                                        }
                                        // all json files are ready now launch editor

                                        // after success extract
                                        let msgComp = {
                                            command: "GENERATE_UI",
                                            data: {
                                                leftFilePath: this.leftFilePath,
                                                rightFilePath: this.rightFilePath,
                                                fileSide: msgData.fileSide,
                                                leftFileCompareJson: this.leftFileCompareJson,
                                                rightFileCompareJson: this.rightFileCompareJson,
                                                lAresInfo: this.lAresInfo,
                                                rAresInfo: this.rAresInfo
                                            },
                                        };
                                        if (this.panel) {
                                            this.panel.webview.postMessage(msgComp);
                                        }
                                        this.isAnalysing = false;
                                        return Promise.resolve();

                                    }




                                });



                            }).catch(() => {
                                this.postIPKAnalysisStoped(msgData.fileSide, true)
                                return Promise.reject()
                            })


                        }).catch(() => {
                            this.postIPKAnalysisStoped(msgData.fileSide, true)
                            return Promise.reject()
                        })


                    }).catch(() => {
                        this.postIPKAnalysisStoped(msgData.fileSide, true)
                        return Promise.reject()
                    })

                })

            } else {
                this.postIPKAnalysisStoped(msgData.fileSide, false)
                return Promise.reject()
            }


        })

    }
    compareJSON(treeJsonObj, flatJson, flatJson_pathKey) {
        let key = treeJsonObj["key"]

        if (flatJson[key]) {
            // it is available in right json
            // check file size diff
            if (treeJsonObj["size"] != flatJson[key]["size"]) {
                treeJsonObj["isModified"] = true;
            }

        } else {
            // right json it is not available
            // mark it as new Item in left json 
            treeJsonObj["isNew"] = true;
            if (flatJson_pathKey[treeJsonObj["pathKey"]]) {
                // probable file found
                treeJsonObj["isProbableFileFound"] = true;
            }
        }

        treeJsonObj.children.forEach(obj => {

            // if (obj["isFolder"]) {
            this.compareJSON(obj, flatJson, flatJson_pathKey)

            // }



        })
    }

    startEditor() {
        this.analysIPKFile(true, { fileSide: "L" })

    }
    convertToKey(filePath, fileSide) {
        let commonPath = fileSide == "L" ? this.lSrcDir : this.rSrcDir
        return filePath.replace(commonPath, "").split(path.sep).join("_")
    }
    convertToLevelKey(filePath, fileSide) {
        let commonPath = fileSide == "L" ? this.lSrcDir : this.rSrcDir
        let pathArray = filePath.replace(commonPath, "").split(path.sep);
        return pathArray.length + "_" + pathArray[pathArray.length - 1]
    }
    diretoryToTreeAndFlatObj(dir, fileSide, done) {
        var results = [];

        fs.readdir(dir, (err, list) => {
            if (err)
                return done(err);

            var pending = list.length;

            if (!pending) {
                this.flatJson[this.convertToKey(dir, fileSide)] = { name: path.basename(dir), size: 0, isFolder: true }
                this.flatJson_pathKey[this.convertToLevelKey(dir, fileSide)] = { name: path.basename(dir), size: 0, isFolder: true }

                return done(null, { key: this.convertToKey(dir, fileSide), pathKey: this.convertToLevelKey(dir, fileSide), name: path.basename(dir), size: 0, isFolder: true, path: dir, children: results });
            }
            list.forEach((file) => {
                file = path.resolve(dir, file);
                fs.stat(file, (err, stat) => {
                    if (stat && stat.isDirectory()) {
                        this.diretoryToTreeAndFlatObj(file, fileSide, (err, res) => {
                            if (!Array.isArray(res)) {
                                res = [res]
                            }
                            results.push({
                                name: path.basename(file),
                                key: this.convertToKey(file, fileSide),
                                pathKey: this.convertToLevelKey(file, fileSide),
                                isFolder: true,
                                size: 0,
                                path: file,
                                children: res
                            });
                            this.flatJson[this.convertToKey(file, fileSide)] = { name: path.basename(file), size: 0, isFolder: true }
                            this.flatJson_pathKey[this.convertToLevelKey(file, fileSide)] = { name: path.basename(file), size: 0, isFolder: true }

                            if (!--pending)
                                done(null, results);
                        });
                    }
                    else {
                        results.push({
                            isFolder: false,
                            size: stat.size,
                            path: file,
                            name: path.basename(file),
                            key: this.convertToKey(file, fileSide),
                            pathKey: this.convertToLevelKey(file, fileSide),
                            children: []
                        });
                        this.flatJson[this.convertToKey(file, fileSide)] = { name: path.basename(file), size: stat.size, isFolder: false }
                        this.flatJson_pathKey[this.convertToLevelKey(file, fileSide)] = { name: path.basename(file), size: stat.size, isFolder: false }

                        if (!--pending)
                            done(null, results);
                    }
                });
            });
        });
    }
    calculateFolderSize(pObj) {

        pObj.children.forEach(cObj => {

            //setExtension
            if (!cObj["isFolder"]) {
                if (this.setiJson.fileNames[cObj.name]) {
                    cObj["iconClass"] = this.setiJson.fileNames[cObj.name];
                } else {
                    let extArray = cObj.name.split(".")
                    extArray.shift()
                    let ext = extArray.toString().replaceAll(",", ".")

                    if (this.setiJson.fileExtensions[ext]) {
                        cObj["iconClass"] = this.setiJson.fileExtensions[ext];

                    } else if (this.setiJson.languageIds[ext]) {
                        cObj["iconClass"] = this.setiJson.languageIds[ext];

                    } else {
                        cObj["iconClass"] = '_default';
                    }



                }
            }




            if (cObj["isFolder"] && cObj["children"].length > 0) {
                this.calculateFolderSize(cObj)
                pObj["size"] = pObj["size"] + cObj["size"]
                this.flatJson[pObj["key"]]["size"] = pObj["size"];
            } else {
                pObj["size"] = pObj["size"] + cObj["size"]
                this.flatJson[pObj["key"]]["size"] = pObj["size"];
            }
        })
    }
    calculateSizePercentageAndConvert(pObj, totalSize) {
        let key = pObj["key"]
        pObj["sizePer"] = ((pObj["size"] * 100) / totalSize).toFixed(2) + "%"
        this.flatJson[key]["sizePer"] = pObj["sizePer"];

        let size = "";
        if (pObj["size"] >= (1020 * 1020)) {
            size = (pObj["size"] / (1020 * 1020)).toFixed(2) + " MB"
        } else if (pObj["size"] >= 100) {
            size = (pObj["size"] / 1020).toFixed(2) + " KB"

        } else {
            size = pObj["size"] + " Bytes"
        }
        pObj["sizeConverted"] = size
        this.flatJson[key]["sizeConverted"] = size

        pObj.children.forEach(cObj => {
            this.calculateSizePercentageAndConvert(cObj, totalSize)

        })

    }

    sortJsonChildren(pObj) {
        if (pObj.children.length > 1) {
            pObj.children.sort((a, b) => {
                let nameA = a.name.toUpperCase();
                let nameB = b.name.toUpperCase();
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }
                return 0;
            })
        }
        pObj.children.forEach(cObj => {
            this.sortJsonChildren(cObj)

        })

    }


    doStartEditor() {
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
            localResourceRoots: [this.context.extensionUri]
        }
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                if (this.isAnalysing && this.progress) {
                    this.progress.report({ message: "Stopping..", "increment": 100 })
                }
                this.isAnalysing = false;

                if (this.leftExtractedFilePath) {
                    fs.rm(this.lSrcDir, { recursive: true, force: true }, () => { });
                    this.leftFilePath = ""

                }
                if (this.rightExtractedFilePath) {
                    fs.rm(this.rSrcDir, { recursive: true, force: true }, () => { });
                    this.rightFilePath = ""

                }
            },
            null,
            this.context.subscriptions
        );
        this.panel.webview.onDidReceiveMessage(async msg => {
            switch (msg.command) {
                case "ANALYS_IPK":
                    this.analysIPKFile(false, msg.data)
                    break;
                case "COMPARE_FILES":
                    this.openDiff(msg.data)
                    break;
                case "OPEN_FILE":
                    this.openFile(msg.data)
                    break;
            }
        });
    }

    async openDiff(data) {
        await vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(data.leftPath), vscode.Uri.file(data.rightPath), path.basename(data.rightPath), {
            preview: data.preview,
            preserveFocus: data.preview,
            viewColumn: data.openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active
        });

    }

    async openFile(data) {

        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(data.uri), {
            preview: data.preview,
            preserveFocus: true,
            viewColumn: data.openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
        });

    }

    removeDir(installedPath) {
        try {
            fs.rmSync(installedPath, { recursive: true, force: true });
            return true;
        } catch (e) {
            logger.info("Unable to remove the folder -" + installedPath + " , Please remove manually ")
            logger.error("Error removing -" + installedPath + " - " + e.message)
            return false;
        }

    }
    unzipFile(filePath, destination) {
        this.removeDir(destination)
        logger.info(`Extracting ${filePath} `)

        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }
        return new Promise(async (resolve, reject) => {
            try {
                await _7z.unpack(filePath, destination, (err) => {
                    if (!err) {
                        resolve();
                        logger.info(` ${filePath} -Extracted `)
                    } else {

                        logger.info(`Error on Extracting ${filePath} -${err} `)
                        reject(err);
                    }
                });
            } catch (error) {
                logger.info(`Error on Extracting ${filePath} -${error} `)
                reject(error);
            }
        });
    }

    readIPKArchiveAndWrite(filePath, destination) {
        return new Promise((resolve, reject) => {
            try {
                this.removeDir(destination)
                logger.info(`Reading Archive File  ${filePath} `)
                const reader = new ar.ArReader(filePath);
                if (!fs.existsSync(destination)) {
                    fs.mkdirSync(destination);
                }
                reader.on("entry", (entry, next) => {
                    console.log("started uppacking..");
                    const name = entry.fileName();
                    entry.fileData()
                        .pipe(fs.createWriteStream(path.resolve(destination, name)))
                        .on("finish", () => {
                            next();
                        });
                });
                reader.on("error", (err) => {
                    console.log(err);
                    return reject(err);
                });
                reader.on("close", () => {
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
    }

    getDefaultDir() {
        let folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri;

        } else {
            return null;
        }
    }
    getHtmlForWebview(webview) {

        const commonJs = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "js",
                "common.js"
            )
        );
        const treGridCss = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "css",
                "treegrid.css"
            )
        );
        const treeGridJS = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "js",
                "file_treegrid.js"
            )
        );
        const commonCss = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "css",
                "common.css"
            )
        );
        const faCss = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "css",
                "fa",
                "css",
                "all.css"
            )
        );
        const setiCss = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "ipk_analyzer",
                "seti_theme",
                "seti.css"
            )
        );
        const loadingUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "media",
                "loading.gif"
            )
        );

        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `
            <html lang="en">
            <head>
            <link href="${commonCss}" rel="stylesheet">
            <link href="${treGridCss}" rel="stylesheet">
            <link href="${faCss}" rel="stylesheet">
            <link href="${codiconsUri}" rel="stylesheet" />
            <link href="${setiCss}" rel="stylesheet" />
            
            
           
            <div id ="paneContainer">
            <div id="leftPane">
                <div id="leftSelector">
                    <div class="fileButtonContainer"> <input placeholder="Select IPK file " disabled type="text" class="ipkInputField" id="selectedLeftFile"> <button id="fileButtonLeft" class="fileButton" onclick=handleFileSelectorClick("L")> Browse </button></div>
                    <div style ="display:none" id="l_aresInfo" class="accordion">Package Information</div>
                    <div id ="l_arrayInfo" class="panel">
                        <div id ="lArrayInfo_loader"  >
                            <div style =" display:flex;  justify-content: center; ">
                                <img src="${loadingUri}" style ="width:30px;"></img>
                            </div>
                        </div> 
                        <div id ="lArrayInfo_content" style="display:flex;padding-left:15px"></div>
                    </div>
                
                    <div style ="display:none"  id="l_files" class="accordion">Files</div>
                    <div class="panel">
                    <div id ="leftLoader" style="display:none" >
                    <div style =" display:flex;  justify-content: center; ">
                        <img src="${loadingUri}" style ="width:30px;"></img>
                    </div>
                </div>

                        <div  id="leftGridContainer"> 
                        ${this.getTreeTableHTML("L")}
                        </div>
        
                    </div>
              
                </div>
                
            </div>
            

            <div id="paneSep">&nbsp;</div>
            <div id="rightPane">
                <div id="rightSelector">
                <div class="fileButtonContainer"> <input placeholder="Select IPK file to compare " disabled type="text" class="ipkInputField" id="selectedRightFile"> <button id="fileButtonLeft" class="fileButton" onclick=handleFileSelectorClick("R")> Browse </button></div>
                </div>
                <div style ="display:none"  id="r_aresInfo" class="accordion">Package Information</div>
                <div id ="r_arrayInfo"  class="panel">
                    

                    <div id ="rArrayInfo_loader"  >
                    <div style =" display:flex;  justify-content: center; ">
                    <img src="${loadingUri}" style ="width:30px;"></img>
                    </div></div>
                    <div id ="rArrayInfo_content" style="display:flex;padding-left:15px"></div>

                </div>
                <div style ="display:none"  id="r_files" class="accordion">Files</div>
                <div  class="panel">
                <div id ="rightLoader" style="display:none" >
                        <div style =" display:flex;  justify-content: center; ">
                            <img src="${loadingUri}" style ="width:30px;"></img>
                        </div>
                    </div>
                <div  id="rightGridContainer"> 
                ${this.getTreeTableHTML("R")}
                </div> 
                </div>
                
                
                
            </div>
          </div>         
          <div id ="ctxmenu" class ="ctxmenu" style="display:none">
          <p id ="menu_viewFile" class ="ctxmenu_item_active" >View file</p><p id="menu_compareFile">Compare files</p>
          </div>
         
            <script type='text/javascript' src="${commonJs}"></script>
          <script type='text/javascript' src="${treeGridJS}"></script>    
    `;
    }
    getTreeTableHTML(id) {
        return `
          <div class="table-wrap" id="${"treegrid_wrap_" + id}" ><table id="${"treegrid_" + id}" 
          class="treegrid" role="treegrid" aria-label="sdk">
          <colgroup>
            <col id="treegrid-col1" style="width:60%">
            <col id="treegrid-col2" style="width:80px" >
            <col id="treegrid-col3" style="width:40%" >
          </colgroup>
          <thead style="display:none" >
            <tr>
              <th scope="col" ></th>
              <th scope="col"></th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody id="${"treegrid_body_" + id}">
          </tbody>
          
            </table>
            </div>
          `;
    }

}

exports.IPK_ANALYZER = IPK_ANALYZER;
