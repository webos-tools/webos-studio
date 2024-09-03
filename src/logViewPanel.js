/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-useless-escape */
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const kill = require('tree-kill');
const { spawn } = require('child_process');
const { logger } = require('./lib/logger');
const sshClient = require('ssh2').Client;
const archiver = require('archiver');
const cp = require("child_process");
const notify = require('./lib/notificationUtils');
const StreamZip = require('node-stream-zip');

class LogViewPanel {
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.remoteExe = new RemoteExec(this);
    this.startServer();
    this.lastFolderSelected = null
    this.exportRSize = 200000;

    this.initVar();
  }

  async initVar() {
    this.RSEQ_IDX = 0
    this.SEQ_IDX = 0
    this.logProcess = null;
    this.logStack = []
    this.filteredStack = [];
    this.filterCondition = {};

    this.filterDDObj = {}
    this.filterDDObj["HOSTNAMES"] = {}
    this.filterDDObj["SYSLOG_IDENTIFIERS"] = {}
    this.filterDDObj["SYSLOG_PID"] = {}
    this.filterDDObj["MESSAGE"] = {}

    this.isFilterReqProcessing = false;
    this.logStackMaxSize = 10000;
    this.outputBuffer = "";
    this.isServerStarted = false;
    this.shiftedRows = 0;

    this.isLoadingDoneSent = false;
    this.currentTime = null;
    this.lastTime = null


    this.isFindOn = false;
    this.findKeyword = "";
    this.findIndexesJson = {}

    this.importInfo = null;
    this.isLiveLog = true;
    await this.remoteExe.init()
  }
  resolveWebviewView(panel) {
    let isLocationChanged = false;
    if (this.panel) {
      isLocationChanged = true;
    }
    this.panel = panel;
    this.doLoadWebView()
    if (isLocationChanged) {
      this.setFrontEndWithOldValues()
    }

    this.panel.webview.postMessage({
      command: "CURRENT_LOGGER",
      data: { "logType": this.remoteExe.logType },
    });

  }
  setFrontEndWithOldValues() {

    if (this.panel) this.sendStackSize(this.filteredStack.length)

    this.panel.webview.postMessage({
      command: "LOCATION_CHANGED",
      data: {
        "stackSize": this.filteredStack.length,
        "ddState": this.getDropDownValuesWithSelection(),
        "isProcessRunning": this.logProcess ? true : false
      }
    });

  }
  getDropDownValuesWithSelection() {

    let ddState = {}
    if (!this.filterCondition["SEL_PRIORITY"]) {
      this.filterCondition["SEL_PRIORITY"] = [];
    }
    if (!this.filterCondition["SEL_SYSLOG_PID"]) {
      this.filterCondition["SEL_SYSLOG_PID"] = [];
    }
    if (!this.filterCondition["SEL_SYSLOG_IDENTIFIER"]) {
      this.filterCondition["SEL_SYSLOG_IDENTIFIER"] = [];
    }
    if (!this.filterCondition["SEL_MESSAGE"]) {
      this.filterCondition["SEL_MESSAGE"] = [];
    }
    let ddStatePriority = {
      "0": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("0") ? true : false, "text": "Emergency" },
      "1": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("1") ? true : false, "text": "Alert" },
      "2": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("2") ? true : false, "text": "Critical" },
      "3": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("3") ? true : false, "text": "Error" },
      "4": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("4") ? true : false, "text": "Warning" },
      "5": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("5") ? true : false, "text": "Notice" },
      "6": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("6") ? true : false, "text": "Info" },
      "7": { "isSelected": this.filterCondition["SEL_PRIORITY"].includes("7") ? true : false, "text": "Debug" }
    }

    let ddStatePID = {}
    Object.keys(this.filterDDObj["SYSLOG_PID"]).forEach((k) => {
      ddStatePID[k] = { "isSelected": this.filterCondition["SEL_SYSLOG_PID"].includes(k) ? true : false, "text": k }

    })

    let ddStateIdentifier = {}
    Object.keys(this.filterDDObj["SYSLOG_IDENTIFIERS"]).forEach((k) => {
      ddStateIdentifier[k] = { "isSelected": this.filterCondition["SEL_SYSLOG_IDENTIFIER"].includes(k) ? true : false, "text": k }

    })

    let ddStateMessage = {}
    Object.keys(this.filterDDObj["MESSAGE"]).forEach((k) => {
      ddStateMessage[k] = { "isSelected": this.filterCondition["SEL_MESSAGE"].includes(k) ? true : false, "text": k }

    })

    ddState["PRIORITY"] = ddStatePriority
    ddState["SYSLOG_IDENTIFIERS"] = ddStateIdentifier
    ddState["SYSLOG_PID"] = ddStatePID
    ddState["MESSAGE"] = ddStateMessage

    return ddState;

  }
  doLoadWebView() {
    this.panel.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      retainContextWhenHidden: true,
      enableForms: true,
      localResourceRoots: [this.context.extensionUri]
    };

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      this.handleMessage(msg)
    });
  }
  reloadWebView() {
    this.initVar();
    this.panel.webview.postMessage({
      command: "VIEW_RELOADED",
      data: {},
    });

    this.startServer();
    this.panel.webview.postMessage({
      command: "CURRENT_LOGGER",
      data: { "logType": this.remoteExe.logType },
    });

  }
  stopLogView() {
    this.stopLogAndSendConfirmation()
  }

  getHtmlForWebview(webview) {

    const commonJs = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "js",
        "common.js"
      )
    );
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    const tableResizer = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "js",
        "tableResizer.js"
      )
    );
    const commonCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "css",
        "common.css"
      )
    );
    const faCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "css",
        "fa",
        "css",
        "all.css"
      )
    );
    const selecFilter = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "js",
        "selectFilter.js"
      )
    );
    const selecFilterCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "log_view",
        "css",
        "selectFilter.css"
      )
    );
    return `
        <html lang="en">
        <head>
        <link href="${commonCss}" rel="stylesheet">
        <link href="${faCss}" rel="stylesheet">
        <link href="${selecFilterCss}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
        
        
        </head>
        <body>
            
        
        <div id="outerContainer" class="outerContainer">
        <div id="tableOuter" class="tableOuter">
        

        <div id="toolBar" class ="toolBar">
        <div id="toolBar_title" class ="toolBar_title"></div>
        <div id ="toolBarBody" class ="toolBarBody">
      
          <div id ="toolBarFind" class ="toolBarFind">
         
            <input type="search" id="logFinderInput" title="Enter the value  to start find operation"  placeholder ="Find" class ="logFinderInput"> </input>
            <span id= "logFindResult" class= "logFindResult">No results</span>
          
            <div class ="toolBarIcon" id="findUp">
              <i title ="Previous match" class="codicon codicon-arrow-up"></i>
            </div>
            <div class ="toolBarIcon" id="findDown">
              <i  title ="Next match" class="codicon codicon-arrow-down"></i>
            </div>
            
            <div style="width:30px"></div>
            <div id ="importRowSelector" class ="importRowSelector" >
            <span id= "importRowSelector_title" class= "importRowSelector_title">Imported Entries</span>
            <select id="importRowSelector_select" class ="importRowSelector_select">
                      <option value="1" selected>1</option>
                      <option value="2">2</option>
                      
            </select>
            </div>
                  <div style="width:20px"></div>

            <div class ="toolBarIcon" id="toolBarMenu">
              <i  title ="Menu" class="codicon codicon-archive"></i>
            </div>
            <div style="width:20px"></div>
            
          </div>
         
        </div>
        
        <div id ="toolBarCtxMenu" class ="toolBarCtxMenu" style="display:none">
          <p  class ="toolBarCtxMenu_item" id="menu_switchLog">Switch to PM Log</p>
          <p  class ="toolBarCtxMenu_item" id="menu_startLog" style ="display:none">Start Live Log</p>
          <p  class ="toolBarCtxMenu_item" id="menu_stopLog">Stop Live Log</p>
          <hr></hr>  
          <p  class ="toolBarCtxMenu_item" id ="menu_exportLog" class ="ctxmenu_item_active" >Export Log</p>
          <p class ="toolBarCtxMenu_item" id="menu_importLog">Import Log</p>
        </div>
      </div>
      
        <table id="scrollTable">
            <colgroup>
            <col id="singleRow" colType="single"  >
            <col id="SYSLOG_TIMESTAMP" colType="tabular" >
            <col id="PRIORITY" colType="tabular" >
            <col id="SYSLOG_IDENTIFIER"  colType="tabular" >
            <col id="SYSLOG_PID"  colType="tabular" >
            <col id="MESSAGE"  colType="tabular"> 
            </colgroup>
            <thead>
            <tr>
              <th data-colh ="col0" id="singleRow" colType="single" >single row header </th>
              <th data-colh ="col1" id="SYSLOG_TIMESTAMP" colType="tabular"  style="width:15%; ">Time</th> 
              <th data-colh ="col2" id="PRIORITY" colType="tabular" style="width:8%; ">
              <div class ="filter">
                  <select id="SEL_PRIORITY" multiple>
                  <option value ="0">Emergency</option>
                  <option value ="1">Alert</option>
                  <option value ="2">Critical</option>
                  <option value ="3">Error</option>
                  <option value ="4">Warning</option>
                  <option value ="5">Notice</option>
                  <option value ="6">Info</option>
                  <option value ="7">Debug</option>
                </select>
              </div>
              </th>

              
              <th data-colh ="col3" id="SYSLOG_IDENTIFIER"  colType="tabular" style="width:15%; ">
                <div class ="filter">
                  <select id="SEL_SYSLOG_IDENTIFIER" multiple>
                  </select>
                </div>
              </th>
              <th data-colh ="col4" id="SYSLOG_PID"  colType="tabular" style="width:7%; ">
                <div class ="filter">
                  <select id="SEL_SYSLOG_PID" multiple>
                  </select>
                </div>
              
              </th>
              <th data-colh ="col5" id="MESSAGE"  colType="tabular"style="width:55%; ">
              <div class ="filter">
              <select id="SEL_MESSAGE" multiple>
              </select>
            </div>
                      
          
              </th>
            </tr>
             
          </thead>
            <tbody id="tbody">
            <tr  id="topRow" style="top:10px" class ="borderRow absrow"> 
            <td data-col ="col0"></td>
            <td data-col ="col1"></td>
            <td data-col ="col2"></td>
            <td data-col ="col3"></td>
            <td data-col ="col4"></td>
            <td data-col ="col5"></td>
            
            </tr>
            <tr id="bottomRow" style="bottom:10px" class ="borderRow absrow"> 
            <td data-col ="col0"></td>
            <td data-col ="col1"></td>
            <td data-col ="col2"></td>
            <td data-col ="col3"></td>
            <td data-col ="col4"></td>
            <td data-col ="col5"></td>
            </tr>
          
            </tbody>
          </table>
          
        </div>
        <div class="scrolldiv" id ="scrolldiv">
          &nbsp
        </div>
        <div id="liveLoaderElement" class ="blink" ></div>
        <div id="liveLoaderElementText" class ="blink_Text"></div>
        <div class ="stopedLine" id="processStopedLine">=========== Process Stopped ===========</div>
        <div class ="noLogEntryFound" id="noLogEntryFound"></div>
      </div>
      
      </body>
      <script type='text/javascript' src="${selecFilter}"></script>
      <script type='text/javascript' src="${tableResizer}"></script>
      <script type='text/javascript' src="${commonJs}"></script>
         
`;
  }

  addToStackPMLog(lineEntry) {

    try {
      let prio = lineEntry.split("]")[1].trim().split(" ")[0];
      let prioNo = "6";
      if (prio.includes("emerg")) {
        prioNo = "0"
      } else if (prio.includes("alert")) {
        prioNo = "1"
      } else if (prio.includes("crit")) {
        prioNo = "2"
      } else if (prio.includes("err")) {
        prioNo = "3"
      } else if (prio.includes("warning")) {
        prioNo = "4"
      } else if (prio.includes("notice")) {
        prioNo = "5"
      } else if (prio.includes("info")) {
        prioNo = "6"
      } else if (prio.includes("debug")) {
        prioNo = "7"
      }
      let pid = lineEntry.split(prio)[1].trim().split("[")[0].trim();
      let sysLogId = lineEntry.replace(lineEntry.split(pid)[0], "").replace(pid, "").trim().split("]")[1].trim().split(" ")[0].trim()

      let data = {
        RSEQ_IDX: this.RSEQ_IDX++,

        SYSLOG_TIMESTAMP: new Date(lineEntry.split(" [")[0]).toLocaleString(),
        PRIORITY: prioNo,
        SYSLOG_PID: pid,
        SYSLOG_IDENTIFIER: sysLogId.replace("<", "").replace(">", ""),
        _HOSTNAME: "-",
        _COMM: "",
        MESSAGE: lineEntry.split(sysLogId)[1].trim()


      }
      this.addToFilterDD(data);

      this.logStack.push(data);

      if (!this.isFilterReqProcessing) {
        this.addToFilteredStack(data)
      }
    } catch (e) {
      console.log("ERROR", e, lineEntry)
    }


  }
  addToStackImported(jsonEntry) {

    let data = {
      RSEQ_IDX: this.RSEQ_IDX++,

      SYSLOG_TIMESTAMP: jsonEntry.SYSLOG_TIMESTAMP,
      _HOSTNAME: jsonEntry._HOSTNAME,
      _COMM: jsonEntry._COMM,
      SYSLOG_IDENTIFIER: jsonEntry.SYSLOG_IDENTIFIER,
      SYSLOG_PID: jsonEntry.SYSLOG_PID,
      PRIORITY: jsonEntry.PRIORITY,
      MESSAGE: jsonEntry.MESSAGE,
    }

    this.addToFilterDD(data);

    this.logStack.push(data);

    if (!this.isFilterReqProcessing) {
      this.addToFilteredStack(data)
    }



  }
  addToStack(jsonEntry) {
    let data = {
      RSEQ_IDX: this.RSEQ_IDX++,

      SYSLOG_TIMESTAMP: new Date(jsonEntry.__REALTIME_TIMESTAMP / 1000).toLocaleString(),
      _HOSTNAME: jsonEntry._HOSTNAME ? jsonEntry._HOSTNAME.trim() : "-",
      _COMM: jsonEntry._COMM ? jsonEntry._COMM.trim() : "-",
      SYSLOG_IDENTIFIER: jsonEntry.SYSLOG_IDENTIFIER ? jsonEntry.SYSLOG_IDENTIFIER.trim() : "-",
      SYSLOG_PID: jsonEntry.SYSLOG_PID != null && jsonEntry.SYSLOG_PID != "" ? jsonEntry.SYSLOG_PID.trim() : jsonEntry._PID ? jsonEntry._PID.trim() : "-",
      PRIORITY: jsonEntry.PRIORITY ? jsonEntry.PRIORITY.trim() : "-",
      MESSAGE: jsonEntry.MESSAGE ? jsonEntry.MESSAGE.trim().replace(/\n/g, " ")
        : "",
    }

    this.addToFilterDD(data);

    this.logStack.push(data);

    if (!this.isFilterReqProcessing) {
      this.addToFilteredStack(data)
    }
  }
  startFiltering(msg) {
    this.SEQ_IDX = 0;
    this.isFilterReqProcessing = true;
    this.filteredStack = [];
    this.filterCondition = msg.data.filter;
    this.msgCondition = msg.data.msgCondition

    this.logStack.forEach(logEntry => {
      this.addToFilteredStack(logEntry)
    });
    this.sendStackSize(this.filteredStack.length)

    this.panel.webview.postMessage({
      command: "FILTER_DONE",
      data: {
        rowsFound: this.filteredStack.length
      },
    });

    this.isFilterReqProcessing = false;
  }
  checkFilterCondtion(data) {
    //SEL_PRIORITY
    if (this.filterCondition["SEL_PRIORITY"] && this.filterCondition["SEL_PRIORITY"].length > 0) {
      if (!this.filterCondition["SEL_PRIORITY"].includes(data.PRIORITY)) {
        return false
      }
    }
    if (this.filterCondition["SEL_SYSLOG_IDENTIFIER"] && this.filterCondition["SEL_SYSLOG_IDENTIFIER"].length > 0) {
      if (!this.filterCondition["SEL_SYSLOG_IDENTIFIER"].includes(data.SYSLOG_IDENTIFIER)) {
        return false
      }
    }
    if (this.filterCondition["SEL_SYSLOG_PID"] && this.filterCondition["SEL_SYSLOG_PID"].length > 0) {
      if (!this.filterCondition["SEL_SYSLOG_PID"].includes(data.SYSLOG_PID)) {
        return false
      }
    }
    if (this.filterCondition["SEL_MESSAGE"] && this.filterCondition["SEL_MESSAGE"].length > 0) {
      if (this.msgCondition == "" || this.msgCondition == "OR") {

        let iscontainAny = false
        this.filterCondition["SEL_MESSAGE"].forEach(element => {
          if (data.MESSAGE.toLowerCase().includes(element.toLowerCase())) {
            iscontainAny = true;
            return true;
          }
        });
        if (!iscontainAny) {
          return false;
        }
      } else {
        let iscontainAll = true
        this.filterCondition["SEL_MESSAGE"].forEach(element => {
          if (!data.MESSAGE.toLowerCase().includes(element.toLowerCase())) {
            iscontainAll = false
            return false;

          }
        });
        return iscontainAll

      }

    }
    return true;

  }

  addToFilteredStack(data) {
    // check the filter condition
    // if the filtered Condition is matched
    if (this.checkFilterCondtion(data)) {
      data["SEQ_IDX"] = this.SEQ_IDX++;
      this.filteredStack.push(data);
      if (this.isFindOn) {
        this.addToFindIndexesJson(data)
      }

    }
  }
  addToFilterDD(jsonData) {

    if (jsonData["SYSLOG_IDENTIFIER"] && !this.filterDDObj["SYSLOG_IDENTIFIERS"][jsonData["SYSLOG_IDENTIFIER"]]) {
      this.filterDDObj["SYSLOG_IDENTIFIERS"][jsonData["SYSLOG_IDENTIFIER"]] = true;
      this.filterDDObj["SYSLOG_IDENTIFIERS_Updated"] = true;

    }
    if (jsonData["SYSLOG_PID"] && !this.filterDDObj["SYSLOG_PID"][jsonData["SYSLOG_PID"]]) {
      this.filterDDObj["SYSLOG_PID"][jsonData["SYSLOG_PID"]] = true;
      this.filterDDObj["SYSLOG_PID_Updated"] = true;

    }

  }
  async startServer() {
    await this.remoteExe.init().then(async () => {

      if (this.panel) {
        this.panel.webview.postMessage({
          command: "CURRENT_LOGGER",
          data: { "logType": this.remoteExe.logType },
        });

        this.panel.webview.postMessage({
          command: "LOGGER_MODE",
          data: { isLive: true },
        });
        this.isLiveLog = true;
        this.importInfo = null
        this.panel.webview.postMessage({
          command: "CLEAR_IMPORTINFO",
          data: {},
        });
      }


      let displayedErrorMsg = false;
      if (this.logProcess != null) { await this.stopServer() }

      if (this.remoteExe.logType == "Journal") {
        this.logProcess = spawn('ares-log', [`-p 7 -o json-seq   -f -n ${this.logStackMaxSize}  `], { shell: true });
      } else {

        this.logProcess = spawn(`ares-log -f -n ${this.logStackMaxSize}`, { shell: true });
      }

      this.logProcess.stdout.on('data', (data) => {
        this.processRawOutPut(data)
        if (!this.isServerStarted && this.filteredStack.length > 0) {
          this.isServerStarted = true;
        }
      });

      this.logProcess.stderr.on('data', (data) => {
        logger.error("Log Viewer -" + data.toString())
        if (!displayedErrorMsg) {
          vscode.window.showErrorMessage("Error getting the log data. Error details can be referred in Output terminal")
          displayedErrorMsg = true
        }

      });
      this.logProcess.on('close', () => {
        logger.info("Log view process ended")
        this.logProcess = null;

      });

    }).catch((error) => {
      console.log(error)
    });

  }
  processRawOutPut(data) {
    if (!this.isLoadingDoneSent) {
      if (!this.lastTime) {
        this.panel.webview.postMessage({
          command: "BLINKER_LOADING",
          data: {},
        });

      }

      this.currentTime = Date.now();
      if (this.lastTime) {
        if (this.currentTime - this.lastTime > 200) {
          this.isLoadingDoneSent = true;
          this.panel.webview.postMessage({
            command: "BLINKER_LOADING_DONE",
            data: {},
          });
        }

      }
      this.lastTime = this.currentTime
    }

    let dataStr = data.toString()
    if (this.remoteExe.logType == "PM") {

      let dataStrArray = this.validatePMArray((this.outputBuffer + dataStr).split('\n'));
      this.lastentry = dataStrArray[dataStrArray.length - 1]
      this.outputBuffer = "";

      for (let i = 0; i < dataStrArray.length - 1; i++) {


        this.addToStackPMLog(dataStrArray[i])

      }

    } else {
      let logArray = (this.outputBuffer + dataStr).split('\x1E')
      this.outputBuffer = "";
      let currentIndex = -1;
      let jsonData = null;

      for (let i = 0; i < logArray.length; i++) {
        currentIndex = i;
        if (logArray[i].trim() != "") {
          logArray[i] = logArray[i].replace(/\n/g, '')
          logArray[i] = logArray[i].replace(/\t/g, '')
          try {
            jsonData = JSON.parse(logArray[i])
            this.addToStack(jsonData)
          } catch (e) {
            if (currentIndex == logArray.length - 1) {
              this.outputBuffer = this.outputBuffer + '\x1E' + logArray[currentIndex]
            }
          }
        }

      }
    }

    if (this.panel) this.sendStackSize(this.filteredStack.length)
    if (this.panel) this.sendDDData();
    if (this.panel && this.isFindOn) this.sendFindSummary();

  }
  validatePMArray(pmLogArray) {
    let formattedArray = []
    let regEx = /^\d{4}-\d{2}-\d{2}$/;
    pmLogArray.forEach((element, i) => {
      if (element.substring(0, 10).match(regEx)) {
        formattedArray.push(element)
      } else {
        // 1. check it is continuation of prev line
        if (formattedArray.length > 0) {
          formattedArray[formattedArray.length - 1] = formattedArray[formattedArray.length - 1] + element
        } else {
          if (i == 0) {
            formattedArray.push(this.lastentry + element)
          }
        }
      }
    });
    return formattedArray;

  }
  processImportOutData(data) {
    if (!this.isLoadingDoneSent) {
      this.panel.webview.postMessage({
        command: "BLINKER_LOADING",
        data: {},
      });
      this.isLoadingDoneSent = true;
    }
    let dataStr = data.toString()

    let logArray = (this.outputBuffer + dataStr).split('<#EOR#>')
    this.outputBuffer = "";
    let currentIndex = -1;
    let jsonData = null;


    for (let i = 0; i < logArray.length; i++) {
      currentIndex = i;
      if (logArray[i].trim() != "") {
        try {
          jsonData = JSON.parse(logArray[i])
          this.addToStackImported(jsonData)
        } catch (e) {
          if (currentIndex == logArray.length - 1) {
            this.outputBuffer = this.outputBuffer + '<#EOR#>' + logArray[currentIndex]
          }
        }
      }

    }


    if (this.panel) this.sendStackSize(this.filteredStack.length)
    if (this.panel) this.sendDDData();
    if (this.panel && this.isFindOn) this.sendFindSummary();
    if (this.panel && this.importInfo && this.importInfo.logInfoJson.files[this.importInfo.importingFileIndex].end - this.importInfo.logInfoJson.files[this.importInfo.importingFileIndex].start <= this.logStack.length) this.sendImportDone();


  }
  isServerStopped() {
    return new Promise((resolve) => {
      let checker = setInterval(() => {
        if (this.logProcess == null) {
          clearInterval(checker);
          resolve();
        }
      }, 200)

    })
  }
  sendImportDone() {
    this.panel.webview.postMessage({
      command: "BLINKER_LOADING_DONE",
      data: {},
    })
    this.panel.webview.postMessage({
      command: "IMPORT_DONE",
      data: { stackSize: this.filteredStack.length },
    });

  }

  async stopServer() {
    if (this.logProcess) {
      this.logProcess.stdin.pause();
      kill(this.logProcess.pid);
      await this.isServerStopped()
      return true
    }
  }

  sendDDData() {
    if (this.filterDDObj["SYSLOG_IDENTIFIERS_Updated"]) {
      this.panel.webview.postMessage({
        command: "SYSLOG_IDENTIFIERS_DD",
        data: { "dd": this.orderJson(this.filterDDObj["SYSLOG_IDENTIFIERS"]) },
      });
      this.filterDDObj["SYSLOG_IDENTIFIERS_Updated"] = false;
    }
    if (this.filterDDObj["SYSLOG_PID_Updated"]) {
      this.panel.webview.postMessage({
        command: "SYSLOG_PID_DD",
        data: { "dd": this.orderJson(this.filterDDObj["SYSLOG_PID"]) },
      });
      this.filterDDObj["SYSLOG_PID_Updated"] = false;
    }

  }
  orderJson(unordered) {
    return Object.keys(unordered).sort().reduce(
      (obj, key) => {
        obj[key] = unordered[key];
        return obj;
      },
      {}
    );
  }
  sendStackSize(length) {
    if (this.isServerStarted) {

      this.panel.webview.postMessage({
        command: "STACK_SIZE",
        data: { "stackSize": length },
      });
    }

  }
  sendInitBlulk(msg) {
    // it will send the data once server started
    // else it will wait for server start flag to true
    // server start means once start receiving the process output
    if (this.isServerStarted && this.filteredStack.length > msg.data.rows) {
      let rowToSend = this.filteredStack.length < msg.data.rows ? this.filteredStack.length : msg.data.rows
      this.panel.webview.postMessage({
        command: "INITIAL_BULK",
        data: { stackSize: this.filteredStack.length, "rows": this.filteredStack.slice(0, rowToSend) },
      });
    } else {
      setTimeout(() => {
        this.sendInitBlulk(msg);
      }, 500);
    }

  }
  sendNextRows(msg) {
    let stackRefItemIndex = this.getStackRefItemIndex(msg.data.SEQ_IDX)
    if (stackRefItemIndex >= 0) {
      let rowsToSend = this.getRowsToSend(msg.data.rowCount, msg.data.isNext, stackRefItemIndex)
      if (rowsToSend.length > 0) {
        this.panel.webview.postMessage({
          command: "NEW_ROWS",
          data: { stackSize: this.filteredStack.length, rows: rowsToSend, isNext: msg.data.isNext },
        });
      }
    }

  }
  sendRowsOnScroll(msg) {
    let rowsToSend = this.getRowsOnScroll(msg.data.rowsCount, msg.data.rowIndex)
    this.panel.webview.postMessage({
      command: "ROWS_ON_SCROLL",
      data: { stackSize: this.filteredStack.length, rows: rowsToSend, rowIndex: msg.data.rowIndex, scrollDir: msg.data.scrollDir },
    });

  }
  async stopLogAndSendConfirmation() {
    await this.stopServer();
    this.panel.webview.postMessage({
      command: "LOG_STOPED",
      data: { "stackSize": this.filteredStack.length }
    });

  }
  getRowsToSend(rowCount, isNext, stackRefItemIndex) {
    let rowsToSend = []
    if (isNext) {
      for (let i = stackRefItemIndex + 1; i <= stackRefItemIndex + rowCount; i++) {
        if (this.filteredStack[i]) {
          rowsToSend.push(this.filteredStack[i])
        }

      }
    } else {
      for (let i = stackRefItemIndex - 1; i >= stackRefItemIndex - rowCount; i--) {
        if (this.filteredStack[i]) {
          rowsToSend.push(this.filteredStack[i])
        }

      }
    }
    return rowsToSend;

  }
  getRowsOnScroll(pageSize, rowIndex) {
    let rowsToSend = [];
    if (rowIndex + pageSize > this.filteredStack.length) {
      rowIndex = this.filteredStack.length - pageSize;
      if (rowIndex < 0) {
        rowIndex = 0;
        pageSize = this.filteredStack.length
      }
    }
    for (let i = rowIndex; i < rowIndex + pageSize; i++) {
      rowsToSend.push(this.filteredStack[i])
    }
    return rowsToSend;
  }
  getStackRefItemIndex(SEQ_IDX) {

    let refRow = this.filteredStack[SEQ_IDX]
    if (refRow != null) {
      // verify it is same 
      if (refRow["SEQ_IDX"] == SEQ_IDX) {
        return SEQ_IDX;
      } else {
        // not the same 
        if (refRow["SEQ_IDX"] > SEQ_IDX) {
          let step = 0
          for (let i = refRow["SEQ_IDX"] - 1; i == 0; i++) {
            step++;
            if (this.filteredStack[i][SEQ_IDX] < SEQ_IDX) {
              return (SEQ_IDX - step);
            }
            if (this.filteredStack[i][SEQ_IDX] == SEQ_IDX) {
              return (SEQ_IDX - step)
            }
          }
        }
      }
    } else {
      // get the last row
      return this.filteredStack.length - 1
    }
    return -1
  }
  updateMessageFilterValueState(msg) {
    this.filterDDObj["MESSAGE"] = msg.data.optionState
  }

  async handleMessage(msg) {
    switch (msg.command) {
      case "GET_INITIAL_BULK": {

        this.sendInitBlulk(msg);
      }
        break;
      case "GET_NEXT_ROWS": {
        this.sendNextRows(msg)
      }
        break;
      case "GET_ROWS_ON_SCROLL": {
        this.sendRowsOnScroll(msg);
      }
        break;
      case "STOP_LOG": {
        this.stopLogAndSendConfirmation()
      }
        break;
      case "FILTER_LOG": {
        if (this.isFindOn) {
          this.findIndexesJson = {};
          this.totalFindCount = 0;
        }
        this.startFiltering(msg)

        if (this.isFindOn) {
          this.sendFindSummary();
        }
      }
        break;
      case "MESSAGE_FILTER_UPDATED":
        this.updateMessageFilterValueState(msg)
        break;
      case "RESTART_LOG":
        vscode.commands.executeCommand("logview.start");
        break;
      case "START_FIND":
        this.startFind(msg);
        break;
      case "STOP_FIND":
        this.stopFind();
        break;
      case "FIND_NEXT":
        this.findNext(msg);

        break;
      case "FIND_PREVIOUS":
        this.findPrevious(msg)
        break;
      case "SWITCH_LOG":
        this.switchLog()
        break;
      case "EXPORT_LOG":
        this.openExportFolderDlg(msg);
        break;
      case "IMPORT_SELECTED":
        this.importSelected(msg.data.zipFile, msg.data.importingFileIndex)
        break;
      case "IMPORT_LOG":
        {
          if (this.isLiveLog) {
            vscode.window.showInformationMessage(`Do you want to save the current log `,
              ...["Yes", "No"])
              .then(async (answer) => {
                if (answer === "Yes") {
                  await this.openExportFolderDlg(msg);
                  await this.openImportFolderDlg()
                } else {
                  await this.openImportFolderDlg()
                }
              })
          } else {
            await this.openImportFolderDlg()
          }
        }

        break;

    }

  }
  openExportFolderDlg(msg) {
    return new Promise(async (resolve, reject) => {
      const options = {
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select folder to Export",
        defaultUri: this.lastFolderSelected ? this.lastFolderSelected : this.getDefaultDir(),
      };
      vscode.window.showOpenDialog(options).then(async (folderUri) => {
        if (folderUri && folderUri[0]) {
          this.lastFolderSelected = vscode.Uri.file(folderUri[0].fsPath);

          try {

            await vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: "Exporting log " + msg.data.fileName + ".zip",
              cancellable: false
            }, async (progress) => {
              let filePath = path.join(folderUri[0].fsPath, msg.data.fileName);
              // split the file
              if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath);
              }
              let filesJson = {}
              let indx = this.filteredStack.length / this.exportRSize
              if (parseInt(indx) != indx) {
                indx = parseInt(indx) + 1;
              }
              for (let i = 0; i < indx; i++) {
                let filePathWithName = path.join(filePath, msg.data.fileName + "_" + (i + 1) + ".weboslog");
                let exportedCount = await this.exportLog(filePathWithName, i * this.exportRSize);
                filesJson[msg.data.fileName + "_" + (i + 1) + ".weboslog"] = { path: filePathWithName, start: i * this.exportRSize, end: (i * this.exportRSize) + (exportedCount - 2) };
              }

              // arhive the created files
              const outputArchStream = fs.createWriteStream(path.join(folderUri[0].fsPath, msg.data.fileName + ".zip"));

              const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
              });
              outputArchStream.on('close', async () => {
                try {
                  fs.rmSync(filePath, { recursive: true, force: true });

                } catch (e) {
                  console.log(e)

                }

              })
              archive.pipe(outputArchStream);
              let file_info = []
              Object.keys(filesJson).forEach((k) => {
                archive.append(fs.createReadStream(filesJson[k]["path"]), { name: k });
                file_info.push({ name: k, start: filesJson[k].start, end: filesJson[k].end })
              })

              archive.append(JSON.stringify({ log_type: msg.data.logType, files: file_info }), { name: 'log_info.json' });
              await notify.showProgress(progress, 100, "Success");

              archive.finalize()
              resolve("")
            })

          } catch (e) {
            reject()

          }

        } else {
          reject()
        }


      })
    })
  }

  exportLog(filePath, startIndex) {
    return new Promise(async (resolve) => {
      let counter = 0
      fs.writeFileSync(filePath, "");

      let wstream = fs.createWriteStream(filePath);
      wstream.on('open', async () => {

        for (let j = startIndex; j < this.filteredStack.length; j++) {
          counter++;
          if (counter > this.exportRSize) { break; }
          wstream.write(JSON.stringify(this.filteredStack[j]) + '<#EOR#>', "utf8");
        }

        wstream.end()

      });
      wstream.on("close", async () => {
        resolve(counter)
      })
    })

  }


  getDefaultDir() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri;
    } else {
      return null;
    }
  }
  async openImportFolderDlg() {
    return new Promise(async (resolve, reject) => {

      const options = {
        canSelectMany: false,
        canSelectFolders: false,
        canSelectFiles: true,
        openLabel: "Select log file to import",
        filters: {
          'webOS Log Files': ['zip'],
          "All Files": ['*.*']
        },
        defaultUri: this.lastFolderSelected ? this.lastFolderSelected : this.getDefaultDir(),
      };
      vscode.window.showOpenDialog(options).then(async (folderUri) => {
        if (folderUri && folderUri[0]) {
          this.lastFolderSelected = vscode.Uri.file(path.dirname(folderUri[0].fsPath));
          let filePath = path.join(folderUri[0].fsPath);


          const zip = new StreamZip.async({ file: filePath });
          await zip.entryData('log_info.json')
            .then(async (data) => {
              let logInfoJson = JSON.parse(data.toString())
              this.stopFind();
              await this.stopServer();

              // it takes few seconds to stop server, during that time stack get fills

              this.initVar();
              this.importInfo = {
                zipFile: filePath,
                logInfoJson: logInfoJson,
                importingFileIndex: 0

              }

              this.panel.webview.postMessage({
                command: "IMPORT_ON_GOING",
                data: {
                  importInfo: this.importInfo,
                  isSelecChange: false
                },
              });

              this.panel.webview.postMessage({
                command: "LOGGER_MODE",
                data: { isLive: false },
              });
              this.isLiveLog = false;


              const stm = await zip.stream(logInfoJson.files[0].name);
              this.outputBuffer = "";
              stm.on('data', async (data) => {
                this.processImportOutData(data)
                if (!this.isServerStarted && this.filteredStack.length > 0) {
                  this.isServerStarted = true;
                }
              })
              stm.on('end', () => zip.close());

            })
            .catch(() => {
              vscode.window.showWarningMessage("Selected file is not a webOS Log file")

            });

        } else {
          return reject()
        }


      })
    })
  }
  async importSelected(filePath, fileIndex) {
    const zip = new StreamZip.async({ file: filePath });
    await zip.entryData('log_info.json')
      .then(async (data) => {
        let logInfoJson = JSON.parse(data.toString())

        this.RSEQ_IDX = 0
        this.SEQ_IDX = 0
        this.logProcess = null;
        this.logStack = []
        this.filteredStack = [];
        this.filterCondition = {};

        this.importInfo = {
          zipFile: filePath,
          logInfoJson: logInfoJson,
          importingFileIndex: fileIndex
        }

        this.panel.webview.postMessage({
          command: "IMPORT_ON_GOING",
          data: {
            importInfo: this.importInfo,
            isSelecChange: true
          },
        });

        this.panel.webview.postMessage({
          command: "LOGGER_MODE",
          data: { isLive: false },
        });
        this.isLiveLog = false;


        const stm = await zip.stream(logInfoJson.files[fileIndex].name);
        this.outputBuffer = "";
        stm.on('data', async (data) => {
          this.processImportOutData(data)
          if (!this.isServerStarted && this.filteredStack.length > 0) {
            this.isServerStarted = true;
          }
        })
        stm.on('end', () => zip.close());
      })
  }

  async switchLog() {
    vscode.window.showInformationMessage(`This action will restart the device, do you want to continue? `,
      ...["Yes", "No"])
      .then(async (answer) => {
        if (answer === "Yes") {
          await this.stopServer();
          this.panel.webview.postMessage({
            command: "PREPARE_LOG_SWITCH",
            data: {}
          });
          this.initVar();
          await this.remoteExe.isDefaultDeviceActive().then(async () => {
            this.isDeviceActive = true;
            this.stopFind();
            if (this.remoteExe.logType == "Journal") {
              await this.remoteExe.setPMLog()
            } else {
              await this.remoteExe.setJournalLog();

            }
            this.reloadWebView();
          }).catch(() => {
            this.isDeviceActive = false;
            vscode.window.showErrorMessage(`Error! Connecting Device for the log.`);
            this.sendDeviceConnectionError()
          })

        }
      })


  }
  sendDeviceConnectionError() {
    if (this.panel) {
      this.panel.webview.postMessage({
        command: "DEVICE_ERROR",
        data: {
        }
      });
    }

  }
  findNext(msg) {
    let idxs = Object.keys(this.findIndexesJson)
    let indx = idxs.indexOf(msg.data.SEQ_IDX.toString());
    let startCount = msg.data.startCount;
    if (startCount >= this.totalFindCount) {
      startCount = 1
    } else {
      startCount++
    }
    //get the NEXT


    let nextColIndex = 0;
    let nextSEQ_IDX = msg.data.SEQ_IDX;
    if (this.findIndexesJson[msg.data.SEQ_IDX] > msg.data.colIndex + 1) {
      nextColIndex = msg.data.colIndex + 1
    } else {
      //get the next row
      if (idxs[indx + 1]) {
        nextSEQ_IDX = idxs[indx + 1];
      } else {
        nextSEQ_IDX = idxs[0]
        startCount = 1;
      }
    }
    this.panel.webview.postMessage({
      command: "FIND_SCROLL_TO",
      data: {
        SEQ_IDX: parseInt(nextSEQ_IDX),
        colIndex: nextColIndex,
        startCount: startCount,
        totalFindCount: this.totalFindCount

      }
    });

  }
  findPrevious(msg) {
    let idxs = Object.keys(this.findIndexesJson)
    let indx = idxs.indexOf(msg.data.SEQ_IDX.toString());
    let startCount = msg.data.startCount - 1;
    //get the previous
    let nextColIndex = msg.data.colIndex;
    let nextSEQ_IDX = msg.data.SEQ_IDX;
    if (msg.data.colIndex == 0) {
      // get the previous
      if (idxs[indx - 1]) {
        nextSEQ_IDX = idxs[indx - 1]
      } else {
        nextSEQ_IDX = idxs[idxs.length - 1]
        startCount = this.totalFindCount
      }
      nextColIndex = this.findIndexesJson[nextSEQ_IDX] - 1
    } else {
      nextSEQ_IDX = msg.data.SEQ_IDX
      nextColIndex = msg.data.colIndex - 1
    }
    this.panel.webview.postMessage({
      command: "FIND_SCROLL_TO",
      data: {
        SEQ_IDX: parseInt(nextSEQ_IDX),
        colIndex: nextColIndex,
        startCount: startCount,
        totalFindCount: this.totalFindCount

      }
    });
  }
  startFind(msg) {
    this.isFindOn = true;
    this.findKeyword = msg.data.keyword;
    this.findIndexesJson = {};
    this.totalFindCount = 0;
    this.filteredStack.forEach(row => {
      this.addToFindIndexesJson(row)
    });

    if (this.isFindOn) {
      this.sendFindSummary()
      this.sendFindReport(msg.data.SEQ_IDX, 0)
    }
  }
  sendFindReport(pointerIndx, colIndex) {
    let startCount = 0;
    let lastPointerIndex = pointerIndx;

    let Idxs = Object.keys(this.findIndexesJson)
    Idxs.every((e) => {
      if (parseInt(e) > pointerIndx && startCount > 0) {
        return false
      }
      startCount = startCount + this.findIndexesJson[e];
      lastPointerIndex = e
      return true;
    })

    this.panel.webview.postMessage({
      command: "FIND_SCROLL_TO",
      data: {
        SEQ_IDX: parseInt(lastPointerIndex),
        colIndex: colIndex,
        startCount: startCount,
        totalFindCount: this.totalFindCount

      }
    });
  }

  getPriorityString(priority) {
    let priorityString = ""
    switch (priority) {
      case "0":
        priorityString = "Emergency"
        break;
      case "1":
        priorityString = "Alert"
        break;
      case "2":
        priorityString = "Critical"
        break;
      case "3":
        priorityString = "Error"
        break;
      case "4":
        priorityString = "Warning"
        break;
      case "5":
        priorityString = "Notice"
        break;
      case "6":
        priorityString = "Info"
        break;
      case "7":
        priorityString = "Debug"
        break;
    }
    return priorityString;
  }


  addToFindIndexesJson(row) {
    let rowString =
      (row.SYSLOG_TIMESTAMP +
        row._HOSTNAME +
        row._COMM +
        row.SYSLOG_IDENTIFIER +
        row.SYSLOG_PID +
        this.getPriorityString(row.PRIORITY) +
        row.MESSAGE).toString()
    let count = (rowString.match(new RegExp(this.findKeyword, "gi")) || []).length
    if (count > 0) {
      this.findIndexesJson[row.SEQ_IDX] = count
      this.totalFindCount = this.totalFindCount + this.findIndexesJson[row.SEQ_IDX]
    }

  }
  sendFindSummary() {
    this.panel.webview.postMessage({
      command: "FIND_SUMMARY",
      data: {
        totalFindCount: this.totalFindCount
      }
    });
  }
  stopFind() {
    this.isFindOn = false
    this.findKeyword = "";
    this.findIndexesJson = {};
    this.totalFindCount = 0
  }

}
class RemoteExec {
  constructor(logViewPanel) {
    this.deviceName = "Emulator";
    this.deviceIP = "127.0.0.1";
    this.devicePort = "6622";
    this.userMame = "root";
    this.isDeviceActive = false;
    this.logType = "";
    this.logViewPanel = logViewPanel
    this.setDeviceInfo();
  }
  async init() {
    return new Promise(async (resolve, reject) => {

      await this.setDeviceInfo();
      if (this.isDeviceActive) {
        if (this.logType == "") {
          await this.getCurrentLoger().then(async () => {
            if (this.logType == "") {
              // set journal log
              await this.setJournalLog().then(() => {
                resolve("")
              }).catch((error) => {
                reject(error)
              });

            } else {

              cp.execSync(`ares-log -sd ${this.logType == "PM" ? "pmlogd" : "journald"} `, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
              resolve("")
            }
          });
        } else {
          cp.execSync(`ares-log -sd ${this.logType == "PM" ? "pmlogd" : "journald"} `, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })

          resolve("")
        }
      } else {
        reject("Device Not Active")
      }

    })
  }



  async setDeviceInfo() {
    try {
      let stdout = cp
        .execSync("ares-setup-device -F", { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
        .toString();

      try {
        let fullList = JSON.parse(stdout);
        if (Array.isArray(fullList)) {
          for (let i in fullList) {
            if (fullList[i].default) {

              this.deviceName = fullList[i].name;
              this.deviceIP = fullList[i].deviceinfo.ip;
              this.devicePort = fullList[i].deviceinfo.port;
              this.userMame = fullList[i].deviceinfo.user;
              await this.isDefaultDeviceActive().then(() => {
                this.isDeviceActive = true;
              }).catch(() => {
                this.isDeviceActive = false;
                vscode.window.showErrorMessage(`Error! Connecting Device for the log.`);
                this.logViewPanel.sendDeviceConnectionError();
              })

              return;
            }

          }

        } else {
          vscode.window.showErrorMessage(`Error! Connecting Device for the log.`);
          this.logViewPanel.sendDeviceConnectionError();
        }
      } catch (e) {
        vscode.window.showErrorMessage(`Error! Connecting Device for the log.`);
        this.logViewPanel.sendDeviceConnectionError();
      }

    } catch (e) {
      vscode.window.showErrorMessage(`Error! Connecting Device for the log.`);
      this.logViewPanel.sendDeviceConnectionError();
    }
  }

  async execute(cmd, isErrorResolve) {
    var conn = new sshClient();
    return new Promise((resolve, reject) => {

      conn.on('ready', () => {
        let cmdOutput = ""
        let hasError = false
        conn.exec(cmd, (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('SSH Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
            if (hasError) {
              reject("Error")
            } else {
              resolve(cmdOutput);

            }

          }).on('data', (data) => {
            cmdOutput = cmdOutput + data
          }).stderr.on('data', function (data) {
            console.log('STDERR: ' + data.toString());
            if (isErrorResolve) {
              resolve(data)
              hasError = false;
            } else {

              hasError = true;
              reject(data)
            }

          });
        });
      }).connect({
        host: this.deviceIP,
        port: this.devicePort,
        username: this.userMame,
      });

    })

  }
  async waitTillConnection(secondsTried) {
    if (secondsTried == null) secondsTried = 0;
    var conn = new sshClient();
    return new Promise((resolve, reject) => {
      conn.on("error", async () => {
        conn.end();
        await new Promise(resolve => setTimeout(resolve, 1000))

        if (secondsTried < 20) {
          await this.waitTillConnection(secondsTried + 1).then(() => {
            resolve("");
          }).catch(() => {
            reject("")
          })
        } else {
          reject("")
        }

      })
      conn.on('ready', () => {
        conn.end();
        resolve("");

      }).connect({
        host: this.deviceIP,
        port: this.devicePort,
        username: this.userMame,
        readyTimeout: 300000
      });

    })

  }
  async isDefaultDeviceActive() {
    var conn = new sshClient();
    return new Promise((resolve, reject) => {
      conn.on("error", async () => {
        reject()
      })
      conn.on('ready', () => {
        conn.end();
        resolve("");

      }).connect({
        host: this.deviceIP,
        port: this.devicePort,
        username: this.userMame,
      });

    })

  }
  async executeMultipleCmds(cmds, isErrorResolve) {
    return new Promise((resolve, reject) => {
      const client = new sshClient();

      client.on('ready', () => {
        let cmdOutput = ""
        let hasError = false

        client.shell((err, stream) => {
          stream.on('close', () => {
            client.end();
            if (hasError) {
              reject("Error")
            } else {
              resolve(cmdOutput);

            }
          }).on('data', (data) => {
            cmdOutput = cmdOutput + data.toString()

          }).on('error', (e) => {
            console.log('stream :: error\n', { e });
            if (isErrorResolve) {
              resolve()
              hasError = false;
            } else {
              hasError = true;
              reject()
            }

          })
            .on('exit', () => {
              client.end();
              if (hasError) {
                reject("Error")
              } else {
                resolve(cmdOutput);

              }
            })
          cmds.push("exit\n")
          for (let i = 0; i < cmds.length; i += 1) {
            const cmd = cmds[i];
            setTimeout(() => { stream.write(`${cmd}`) }, 200);
          }

        });
      }).connect({
        host: this.deviceIP,
        port: this.devicePort,
        username: this.userMame,
      });
    })
  }

  async getCurrentLoger() {
    let cmd = 'systemctl status systemd-journald.service | tee'
    return new Promise(async (resolve, reject) => {

      await this.execute(cmd).then(async (output) => {
        if (output.includes("Active: active (running)")) {
          this.logType = "Journal";
          resolve(this.logType)
        } else {
          cmd = 'systemctl status pm-log-daemon.service | tee'
          await this.execute(cmd).then((output) => {
            if (output.includes("Active: active (running)")) {
              this.logType = "PM";

            } else {
              this.logType = ""
            }
            resolve(this.logType)
          })
        }
      }).catch((error) => {
        reject(error)
      })
    })
  }
  isPMLogRunning() {
    let cmd = 'systemctl status pm-log-daemon.service | tee'
    return new Promise(async (resolve, reject) => {

      await this.execute(cmd).then(async (output) => {
        if (output.includes("Active: active (running)")) {
          // in case of half configured  handling
          cp.execSync(`ares-log -sd pmlogd`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })

          resolve("")
        } else {
          reject("")
        }
      }).catch((error) => {
        reject(error)
      })
    })

  }
  isJournalLogRunning() {
    let cmd = 'systemctl status systemd-journald.service | tee'
    return new Promise(async (resolve, reject) => {

      await this.execute(cmd).then(async (output) => {
        if (output.includes("Active: active (running)")) {
          // in case of half configured  handling
          cp.execSync(`ares-log -sd journald`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
          resolve("")
        } else {
          reject("")
        }
      }).catch((error) => {
        reject(error)
      })
    })

  }
  async setPMLog() {
    return new Promise(async (resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Switching to PM log",
        cancellable: false
      }, async (progress) => {
        await notify.showProgress(progress, 20, `Checking log status`);

        await this.isPMLogRunning().then(async () => {
          await notify.showProgress(progress, 80, `Success`);

          resolve("")
        }).catch(async () => {

          await notify.showProgress(progress, 10, `Enabling PM log`);

          let cmd = ["rm /var/luna/preferences/mount_overlay_enabled\n", "reboot\n"]
          await this.executeMultipleCmds(cmd, true).then(async () => {
            await notify.showProgress(progress, 10, `Waiting for device to online`);
            await this.waitTillConnection()
            await notify.showProgress(progress, 10, `Adding Scripts`);
            cmd = [` mount -o remount,rw / \n`]
            await this.executeMultipleCmds(cmd).then(async () => {
              let pmLogDaemonService = `[Unit]\nDescription=webos - '%n'\n Requires=ls-hubd.service\n After=ls-hubd.service\n [Service]\nType=simple\nOOMScoreAdjust=-1000\nEnvironmentFile=-/var/systemd/system/env/pm-log-daemon.env\n ExecStartPre=-/bin/mkdir -p /tmp/pmlogdaemon\nExecStart=/usr/sbin/PmLogDaemon -z -f 6 -m\n ExecStartPost=/bin/touch /tmp/pmlogdaemon/hub-ready\n ExecStop=/etc/systemd/system/scripts/pm-log-daemon-stop.sh\n          Restart=on-failure`;
              let pmKlogDaemonService = `[Unit]\nDescription=webos - '%n'\n [Service]\n Type=simple\n OOMScoreAdjust=-1000\n EnvironmentFile=-/var/systemd/system/env/pm-klog-daemon.env\n ExecStart=/usr/sbin/PmKLogDaemon -n -d 1\n Restart=on-failure`
              let pmLogDaemonStop_sh1 = `rm -rf /tmp/pmlogdaemon\nsystemctl list-jobs | egrep -q \\\`shutdown.target.*start\\\` && SHUTDOWN=yes || SHUTDOWN=no\nsystemctl list-jobs | egrep -q \\\`reboot.target.*start\\\` && REBOOT=yes || REBOOT=no\nsystemctl list-jobs | egrep -q \\\`halt.target.*start\\\` && HALT=yes || HALT=no\nsystemctl list-jobs | egrep -q \\\`poweroff.target.*start\\\` && POWEROFF=yes || POWEROFF=no\npwroff_reason=\\\$(cat /tmp/poweroff_reason 2>/dev/null |awk \\\`BEGIN { FS=\\\"=\\\";} /poweroff_reason/ {print \\\$2} END{}\\\`)\nif [ -z \\\$pwroff_reason ] ; then\n    if [ \\\"\\\$LS_HUBD_CRASH\\\" != \\\"\\\" ] ; then\n        pwroff_reason=\\\"watchdog\\\"\n    else\n        pwroff_reason=\\\"unknown\\\"\n    fi\nfi\nPIDL=\\\`pidof PmLogDaemon\\\` || true\nPIDR=\\\`pidof rdxd\\\` || true\nPIDU=\\\`pidof uploadd\\\` || true\n`
              let pmLogDaemonStop_sh2 = `if [ \\\$SHUTDOWN == \\\"yes\\\" ] && [ \\\$REBOOT == \\\"yes\\\" ] ; then\n if [ \\\"\\\$LS_HUBD_CRASH\\\" != \\\"ls-hubd_private\\\" -a \\\"\\\$PIDL\\\" != \\\"\\\" ] ; then\n PmLogCtl logkv . info REBOOT_REASON reason=\\\\\\\"\\\$pwroff_reason\\\\\\\" \\\"from reboot.conf\\\" || true\n PmLogCtl flush || true\n  if [ \\\"\\\$PIDR\\\" != \\\"\\\" -a \\\"\\\$PIDU\\\" != \\\"\\\" ] ; then\n  echo \\\"[REBOOT] - before analytics log support\\\"\n echo \\\"[REBOOT] - before analytics log support\\\" > \\\$KLOG\n luna-send -n 1 -w 300 luna://com.webos.pmlogd/forcerotate \\\`{}\\\`\n  fi\n  echo \\\"[REBOOT] - save log files to /var/spool/rdxd/previous_boot_logs.tar.gz\\\"\n  echo \\\"[REBOOT] - save log files to /var/spool/rdxd/previous_boot_logs.tar.gz\\\" > \\\$KLOG\n  rm -f /var/spool/rdxd/previous_boot_logs.tar.gz || true\n  `
              let pmLogDaemonStop_sh3 = `luna-send -n 1 -w 300 -f luna://com.webos.pmlogd/backuplogs \\\`{}\\\`\n  COUNT=0\n  while [ ! -e /var/spool/rdxd/previous_boot_logs.tar.gz -a \\\$COUNT -le 8 ] ; do\n  echo \\\"[REBOOT] - pmlog backup wait 250msec\\\" > \\\$KLOG\n   usleep 250000   \n    COUNT=\\\$((COUNT + 1))\n        done\n    fi\nelif [ \\\$SHUTDOWN == \\\"yes\\\" ] && [ \\\$POWEROFF == \\\"yes\\\" ] ; then\n`
              let pmLogDaemonStop_sh4 = `if [ \\\"\\\$PIDL\\\" != \\\"\\\" ] ; then\n        PmLogCtl logkv . info SHUTDOWN_REASON reason=\\\\\\\"\\\$pwroff_reason\\\\\\\" \\\"from shutdown.conf\\\" || true\n        PmLogCtl flush || true\n        if [ \\\"\\\$PIDR\\\" != \\\"\\\" -a \\\"\\\$PIDU\\\" != \\\"\\\" ] ; then\n            echo \\\"[SHUTDOWN] - before analytics log support\\\"\n            echo \\\"[SHUTDOWN] - before analytics log support\\\" > \\\$KLOG\n            luna-send -n 1 -w 150 luna://com.webos.pmlogd/forcerotate \\\`{}\\\`\n        fi\n        echo \\\"[SHUTDOWN] - save log files to /var/spool/rdxd/previous_boot_logs.tar.gz\\\"\n   echo \\\"[SHUTDOWN] - save log files to /var/spool/rdxd/previous_boot_logs.tar.gz\\\" > \\\$KLOG\n`
              let pmLogDaemonStop_sh5 = `rm -f /var/spool/rdxd/previous_boot_logs.tar.gz || true\n        luna-send -n 1 -w 150 -f luna://com.webos.pmlogd/backuplogs \\\`{}\\\`\n        COUNT=0\n        while [ ! -e /var/spool/rdxd/previous_boot_logs.tar.gz -a \\\$COUNT -le 8 ] ; do\n            echo \\\"[SHUTDOWN] - pmlog backup wait 250msec\\\" > \\\$KLOG\n            usleep 250000  \n            COUNT=\\\$((COUNT + 1))\n        done\n    fi\nelse\n    echo \\\"stop pmlogdaemon\\\"\n    exit 0\nfi\n`


              let cmdText = `echo -e "${pmLogDaemonService}" > /etc/systemd/system/pm-log-daemon.service`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmKlogDaemonService}" > /etc/systemd/system/pm-klog-daemon.service`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmLogDaemonStop_sh1}" > /etc/systemd/system/scripts/pm-log-daemon-stop.sh`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmLogDaemonStop_sh2}" >> /etc/systemd/system/scripts/pm-log-daemon-stop.sh`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmLogDaemonStop_sh3}" >> /etc/systemd/system/scripts/pm-log-daemon-stop.sh`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmLogDaemonStop_sh4}" >> /etc/systemd/system/scripts/pm-log-daemon-stop.sh`
              await this.execute(cmdText)
              cmdText = `echo -e "${pmLogDaemonStop_sh5}" >> /etc/systemd/system/scripts/pm-log-daemon-stop.sh`
              await this.execute(cmdText)


              cmd = ["chmod +x /etc/systemd/system/scripts/pm-log-daemon-stop.sh\n",
                "cd /etc/systemd/system/multi-user.target.wants\n",
                "ln -sf ../pm-log-daemon.service pm-log-daemon.service\n",
                "ln -sf ../pm-klog-daemon.service pm-klog-daemon.service\n",
                "ln -sf /dev/null /etc/systemd/system/systemd-journal-catalog-update.service\n",
                "ln -sf /dev/null /etc/systemd/system/systemd-journal-flush.service\n",
                "ln -sf /dev/null /etc/systemd/system/systemd-journald.service\n",
                "rm /lib/systemd/system/multi-user.target.wants/backup-log.service\n",
                "touch /var/luna/preferences/mount_overlay_enabled\n",
                "sync\n",
                "reboot\n"]
              await notify.showProgress(progress, 10, `Adding Scripts`);
              await this.executeMultipleCmds(cmd, true).then(async () => {
                await notify.showProgress(progress, 20, `Waiting for device to online`);

                await this.waitTillConnection()
                cp.execSync("ares-log -sd pmlogd ", { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
                this.logType = "PM"
                await notify.showProgress(progress, 100, `Success`);

                resolve("")
              })

            })

          }).catch((error) => {
            reject(error)
          })


        })

      })


    })


  }

  async setJournalLog() {

    return new Promise(async (resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Switching to Journal log",
        cancellable: false
      }, async (progress) => {
        await notify.showProgress(progress, 20, `Checking log status`);
        await this.isJournalLogRunning().then(async () => {
          await notify.showProgress(progress, 80, `Success`);
          resolve("")
        }).catch(async () => {
          await notify.showProgress(progress, 20, `Enabling Journal log`);
          let cmd = [" rm /var/luna/preferences/mount_overlay_enabled\n", "reboot\n"]
          await this.executeMultipleCmds(cmd, true).then(async () => {
            await notify.showProgress(progress, 20, `Waiting for device to online`);
            await this.waitTillConnection();
            await notify.showProgress(progress, 10, `Adding Scripts`);
            cmd = ["mount -o remount,rw /\n",
              "rm /etc/systemd/system/multi-user.target.wants/pm-*\n",
              "rm /etc/systemd/system/systemd-journal*\n",
              "ln -sf /lib/systemd/system/backup-log.service /lib/systemd/system/multi-user.target.wants/backup-log.service\n",
              "touch /var/luna/preferences/mount_overlay_enabled\n",
              "sync\n",
              "reboot\n"]
            await this.executeMultipleCmds(cmd, true).then(async (output) => {
              await notify.showProgress(progress, 20, `Waiting for device to online`);
              await this.waitTillConnection()
              cp.execSync(`ares-log -sd journald`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
              this.logType = "Journal"
              await notify.showProgress(progress, 60, `Success`);

              resolve(output)
            })

          }).catch(async (error) => {
            await notify.showProgress(progress, 80, `Log Switching Failed`);
            reject(error)
          })
        })

      })



    })


  }
}

LogViewPanel.viewType = 'devicelogview';
exports.LogViewPanel = LogViewPanel;
