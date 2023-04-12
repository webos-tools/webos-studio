/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require("vscode");
const path = require('path');
const fs = require('fs');


class SDK_Manager {

    constructor(context) {
        this.context = context
        this.editorVer = 1;
        this.expressServer = null;
        this.lastSrcCodeSavedPath = null;
        this.lastCompPath = null;
        this.panel = null;
    }

    startEditor() {



        this.panel = vscode.window.createWebviewPanel(
            'sdkmanager', // Identifies the type of the webview. Used internally
            'SDK Manager', // Title of the panel displayed to the user
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

       
        this.panel.webview.onDidReceiveMessage(async msg => {
            console.log("Webview message received-----------");
            console.log(msg.command);
            console.log(msg);
            switch (msg.command) {
                case 'IMPORT_IPK_FILE':
                    {
                        break;
                    }
                case 'ERROR_MESSAGE':
                    {
                        vscode.window.showErrorMessage(`Error! "${msg.text}"!`);
                        break; // msg.text
                    }
                case 'READ_CONFIG':{
                  break;
                }
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
        const tabviewCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "css", 'tabview.css'));
        const tabviewJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'tabview.js'));
        const commonJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'common.js'));
        const treGridCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "css", 'treegrid.css'));
        const treeGridJS = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'treegrid.js'));
      
        return `
        <html lang="en">
        <head>
        <link href="${tabviewCss}" rel="stylesheet">
        <link href="${treGridCss}" rel="stylesheet">

        <dialog open  class="dlg" >
              <h3 class="tabheader">Package Manager</h3>

              <div class="tab">
                <button id="tvhead" class="tablinks" onclick="openTab(event, 'tv')">webOS TV </button>
                <button id="osehead" class="tablinks" onclick="openTab(event, 'ose')">webOS OSE</button>
                <button id="prghead" style ="align:right" class="tablinks" onclick="openTab(event, 'progress')">Progress</button>
              </div>

              <div id="tv" class="tabcontent">
              
               
                
                ${this.getCompTreeGridView("tv_components")}
                
                <fieldset id="tvnotes" class="notes">
                  <legend class="notelegend" >Release Notes</legend>
                  <div id="tvnotecontent"> 
                   
                  </div>
                </fieldset>

               
              </div>

              <div id="ose" class="tabcontent">
              
                
              ${this.getCompTreeGridView("ose_components")}
             
                <fieldset id="osenotes" class="notes">
                <legend class="notelegend" >Release Notes</legend>
                <div id="osenotecontent"> 
               
                </div>
              </fieldset>
              </div>

              <div id="progress" class="tabcontent">
                <h4>Progress</h4>
                
              </div>
              
      </dialog>
      <script type='text/javascript' src="${commonJs}"></script>
      <script type='text/javascript' src="${tabviewJs}"></script>
      <script type='text/javascript' src="${treeGridJS}"></script>    
`;
    }
    getTreeTableHeaderHTML(id){
      return `
      <div class="table-wrap"><table id="${"treegrid_"+id}" class="treegrid" role="treegrid" aria-label="Inbox">
      <colgroup>
        <col id="treegrid-col1">
        <col id="treegrid-col2">
        <col id="treegrid-col3">
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Version</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
      `
    }
    getTreeTableFooterHTML(){
      return `
    </tbody>
    </table>
    </div>
      `
    }
    getTreeTableParentRowHTML(title){
      return `
      <tr role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell">${title}</td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
      </tr>
      `
    }
    getTreeTableChildRowHTML(rowObj,compName,sdk,j){
      let altRowStyle ="";
      if((j+1) %2 == 0){
        altRowStyle = ` style="background-color:whitesmoke"`
      }
      let rowObjB64 =Buffer.from(JSON.stringify(rowObj)).toString('base64')
      return `
      <tr ${altRowStyle} data-compName="${compName}" data-sdk="${sdk}" data-rowobj ="${rowObjB64}" role="row" style="border-bottom:1px" aria-level="2" aria-posinset="1" aria-setsize="3">
      <td role="gridcell">${rowObj.description}</td>
      <td role="gridcell"> ${rowObj.ver}</td>
      <td role="gridcell"><button>Install</button></td>
    </tr>
      `
    }

    getCompTreeGridView(sdk){
    let confiData =   this.getConfigFile();
   
    if(confiData !=""){
      let config = confiData[sdk]
      let treeHTML = "";
      for (let i = 0; i< config["components"].length;i++){
        let compName = config["components"][i]
        treeHTML = treeHTML+ this.getTreeTableParentRowHTML(compName)
        for (let j = 0; j< config[compName].length;j++){
          treeHTML = treeHTML+ this.getTreeTableChildRowHTML( config[compName][j],compName,sdk,j)
       }
      }
      treeHTML = this.getTreeTableHeaderHTML(sdk)+treeHTML+this.getTreeTableFooterHTML()
      return treeHTML;
    }
   

    }
    getConfigFile(){
      let jsonPath  =  vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'config.json')
      let configData =""
      try {
        configData = fs.readFileSync(jsonPath.fsPath, 'utf8');
        return  JSON.parse(configData);
      }
      catch (e) {
          console.log("err " + e);
          return "";
      }
  
    }
   
}

exports.SDK_Manager = SDK_Manager;
