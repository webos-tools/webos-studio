const vscode = acquireVsCodeApi();
function setReleaseNote(row, treegridElem) {
  let rowObj = row.getAttribute("data-rowobj");

  let rNoteElement = null;
  switch (treegridElem.id) {
    case "treegrid_tv":
      rNoteElement = document.getElementById("tvnotecontent");
      break;
    case "treegrid_ose":
      rNoteElement = document.getElementById("osenotecontent");

      break;
  }
  if (rowObj == null) {
    // clear release note
    rNoteElement.innerText = "";
  } else {
    rNoteElement.innerText = JSON.parse(atob(rowObj))["description"];
  }
}

function doRowAction(command, rowObj, compName, sdk) {
  vscode.postMessage({
    command: command,
    data: { rowObj: JSON.parse(atob(rowObj)), compName: compName, sdk: sdk },
  });
}

function handleMsg() {
  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent

    switch (message.command) {
      case "START_PROGRESS":
        {
          console.log("progress update",message)
        }
        break;
    }
  });
}
handleMsg();