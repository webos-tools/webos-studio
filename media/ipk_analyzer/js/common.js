/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = acquireVsCodeApi();
var isAnalysing = false;

function handleMsg() {
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent

    switch (message.command) {
      case "GENERATE_UI": {

        generateUI(message.data);
        if (message.data.lAresInfo != "") {
          printAresInfo({ fileSide: "L", info: message.data.lAresInfo })
        }
        if (message.data.rAresInfo != "") {
          printAresInfo({ fileSide: "R", info: message.data.rAresInfo })
        }
        isAnalysing = false;
        break;
      }
      case "ARES_INFO": {
        printAresInfo(message.data)
        break;
      }
      case "REPORT_READY": {
        // add progress indication
        if (message.data.otherFilePath) {
          // compare report

          document.getElementById("leftGridContainer").style.display = "none"
          document.getElementById("rightGridContainer").style.display = "none"
          document.getElementById("leftLoader").style.display = "block";
          document.getElementById("rightLoader").style.display = "block";

          if (message.data.fileSide == "L") {
            document.getElementById("lArrayInfo_content").style.display = "none";
            document.getElementById("lArrayInfo_loader").style.display = "block";

          } else {
            document.getElementById("rArrayInfo_content").style.display = "none";
            document.getElementById("rArrayInfo_loader").style.display = "block";

          }


        } else if (message.data.fileSide == "L") {
          document.getElementById("leftGridContainer").style.display = "none"
          document.getElementById("leftLoader").style.display = "block";

          document.getElementById("lArrayInfo_content").style.display = "none";
          document.getElementById("lArrayInfo_loader").style.display = "block";

        } else if (message.data.fileSide == "R") {
          document.getElementById("rightGridContainer").style.display = "none"
          document.getElementById("rightLoader").style.display = "block";

          document.getElementById("rArrayInfo_content").style.display = "none";

          document.getElementById("rArrayInfo_loader").style.display = "block";

        }


        break;
      }
      case "ANALYSIS_STOPED": {
        isAnalysing = false;
        break;
      }

    }
  });
}
function printAresInfo(msgData) {
  if (msgData.fileSide == "L") {
    document.getElementById("lArrayInfo_loader").style.display = "none";
    document.getElementById("lArrayInfo_content").style.display = "flex"
    document.getElementById("lArrayInfo_content").innerHTML = formatAresInfo(msgData.info);

  } else {
    document.getElementById("rArrayInfo_loader").style.display = "none";
    document.getElementById("rArrayInfo_content").style.display = "flex"
    document.getElementById("rArrayInfo_content").innerHTML = formatAresInfo(msgData.info);


  }
}
function formatAresInfo(data) {
  let jsonObj = {};
  let currentJsonObj = {};
  data = data.split("\n");

  for (let i = 0; i < data.length; i++) {
    if (data[i].includes(":")) {
      let rValue = data[i].split(":")
      currentJsonObj[rValue[0].trim()] = rValue[1].trim()
    } else {
      data[i] = data[i].replace("<", "").replace(">", "").trim()
      jsonObj[data[i]] = {}
      currentJsonObj = jsonObj[data[i]]
    }
  }

  let html = "";
  for (var key in jsonObj) {
    html = html + `<div style="padding-right:50px;padding-bottom:5px">
  <div style ="text-decoration: underline;padding-left:5px">${key}</div>
    <table>`
    for (var keyItem in jsonObj[key]) {
      html = html + `<tr class ="infotr"><td class ="infotd">${keyItem}</td><td class ="infotd">${jsonObj[key][keyItem]}</td> </tr>`
    }
    html = html + "</table></div>";

  }
  return html;

}
function generateUI(msgData) {
  document.getElementById("selectedLeftFile").value = msgData.leftFilePath;
  document.getElementById("selectedRightFile").value = msgData.rightFilePath

  // hide grid and show progress
  document.body.style.overflow = "hidden"
  if (msgData.leftFileCompareJson != null) {
    document.getElementById("leftGridContainer").style.display = "none"
    document.getElementById("leftLoader").style.display = "block"
    document.getElementById("treegrid_body_L").innerHTML = "";
    addRows(document.getElementById("treegrid_body_L"), msgData.leftFileCompareJson, 1, "L")
    document.getElementById("treegrid_wrap_L").style.height = screen.availHeight - 160 + "px";
  }
  if (msgData.rightFileCompareJson != null) {
    document.getElementById("rightGridContainer").style.display = "none"
    document.getElementById("rightLoader").style.display = "block"
    document.getElementById("treegrid_body_R").innerHTML = "";
    addRows(document.getElementById("treegrid_body_R"), msgData.rightFileCompareJson, 1, "R")
    document.getElementById("treegrid_wrap_R").style.height = screen.availHeight - 160 + "px";

  }
  if (msgData.leftFileCompareJson && msgData.rightFileCompareJson) {
    document.getElementById("leftPane").style.width = "50%"
  }
  initGrid("treegrid_L", "treegrid_R")

  if (msgData.leftFileCompareJson != null) {

    document.getElementById("leftLoader").style.display = "none"
    document.getElementById("leftGridContainer").style.display = "block"
    document.getElementById("L_sourceCode").firstElementChild.click()
    document.getElementById("L_sourceCode").firstElementChild.click();
    document.getElementById("l_aresInfo").style.display = "block";
    document.getElementById("l_files").style.display = "block";
    expandAcc(document.getElementById("l_files"));
    collapseAcc(document.getElementById("l_aresInfo"))
  }

  if (msgData.rightFileCompareJson != null) {
    document.getElementById("rightLoader").style.display = "none"
    document.getElementById("rightGridContainer").style.display = "block"
    document.getElementById("R_sourceCode").firstElementChild.click()
    document.getElementById("R_sourceCode").firstElementChild.click();
    document.getElementById("r_aresInfo").style.display = "block";
    document.getElementById("r_files").style.display = "block";
    expandAcc(document.getElementById("r_files"));
    collapseAcc(document.getElementById("r_aresInfo"))

  }



}
function addRows(tableBody, pObj, aLevel, fileSide) {
  let row = document.createElement('tr');
  row.setAttribute("id", fileSide + pObj.key);
  row.setAttribute("key", pObj.key);
  row.setAttribute("pathKey", pObj.pathKey);
  row.setAttribute("row_status", pObj["isModified"] ? 1 : pObj["isNew"] ? 2 : 0);
  row.setAttribute("class", "trhover");
  row.setAttribute("role", "row");
  row.setAttribute("aria-level", aLevel);
  row.setAttribute("aria-posinset", aLevel);
  row.setAttribute("aria-setsize", aLevel);
  row.setAttribute("isFolder", pObj["isFolder"]);
  row.setAttribute("path", pObj["path"]);

  if (pObj["isFolder"]) {
    row.setAttribute("aria-expanded", aLevel < 6 ? true : false);
  }
  if (pObj["isModified"]) {
    row.style.color = "indianred";
  } else if (pObj["isNew"]) {
    row.style.color = "mediumseagreen";
  }


  tableBody.appendChild(row);
  // get file icon
  let iconClass = ""
  let colHTML = "";
  if (pObj["isFolder"] == false) {
    iconClass = pObj["iconClass"]
    if (document.body.getAttribute("data-vscode-theme-kind") == "vscode-light") {
      iconClass = iconClass + "_light"
    }
    iconClass = "icon icon" + iconClass;
    colHTML = `<td style="padding-left:${aLevel + 1}ch "role="gridcell"><span class="preview_icon"><span class="${iconClass}"></span></span>${pObj.name}</td> <td role="gridcell">${pObj.sizeConverted} <td role="gridcell">
     <div style="background-color:var(--vscode-editor-findMatchHighlightBackground);border-radius: 2px;width:${pObj.sizePer}">${pObj.sizePer}</div></td>`
  } else {
    colHTML = `<td style="padding-left:${aLevel + 1}ch "role="gridcell">${pObj.name}</td> <td role="gridcell">${pObj.sizeConverted} <td role="gridcell">
  <div style="background-color:var(--vscode-editor-findMatchHighlightBackground);border-radius: 2px;width:${pObj.sizePer}">${pObj.sizePer}</div></td>`
  }


  row.innerHTML = colHTML;
  if (pObj["isFolder"]) {
    pObj.children.forEach(cObj => {
      addRows(tableBody, cObj, aLevel + 1, fileSide)

    })
  }


}

function handlePane() {
  document.addEventListener('DOMContentLoaded', function () {
    // Query the element
    const resizer = document.getElementById('paneSep');
    const leftSide = resizer.previousElementSibling;
    const rightSide = resizer.nextElementSibling;

    // The current position of mouse
    let x = 0;
    let y = 0;
    let leftWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function (e) {
      // Get the current mouse position
      x = e.clientX;
      y = e.clientY;
      leftWidth = leftSide.getBoundingClientRect().width;
      // Attach the listeners to document
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
      // How far the mouse has been moved
      const dx = e.clientX - x;
      

      const newLeftWidth = ((leftWidth + dx) * 100) / resizer.parentNode.getBoundingClientRect().width;
      leftSide.style.width = newLeftWidth + '%';

      resizer.style.cursor = 'col-resize';
      document.body.style.cursor = 'col-resize';


      leftSide.style.userSelect = 'none';
      leftSide.style.pointerEvents = 'none';

      rightSide.style.userSelect = 'none';
      rightSide.style.pointerEvents = 'none';
      resizer.style.backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-button-background');

    };

    const mouseUpHandler = function () {
      resizer.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
      resizer.style.backgroundColor = 'black';
      leftSide.style.removeProperty('user-select');
      leftSide.style.removeProperty('pointer-events');

      rightSide.style.removeProperty('user-select');
      rightSide.style.removeProperty('pointer-events');

      // Remove the handlers of mousemove and mouseup
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
  });

}

function handleFileSelectorClick(fileSide) {
  if (!isAnalysing) {
    let msg = {
      command: "ANALYS_IPK",
      data: {
        fileSide: fileSide
      }
    };

    vscode.postMessage(msg);
    isAnalysing = true;
  }
}
function handleAcc() {
  var acc = document.getElementsByClassName("accordion");
  var i;

  for (i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function () {
      this.classList.toggle("active");
      var panel = this.nextElementSibling;
      if (panel.style.display === "block") {
        panel.style.display = "none";
      } else {
        panel.style.display = "block";
      }
    });
  }

}

function expandAcc(acc) {
  acc.classList.remove("active")
  acc.classList.add("active");
  var panel = acc.nextElementSibling;
  panel.style.display = "block";
}
function collapseAcc(acc) {
  acc.classList.remove("active")
  var panel = acc.nextElementSibling;
  panel.style.display = "none";
}

function init() {
  handleMsg();
  handlePane();
  handleAcc()

}

init();
document.addEventListener('contextmenu', event => event.preventDefault());
