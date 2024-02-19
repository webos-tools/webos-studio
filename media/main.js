/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
(function () {
    const vscode = acquireVsCodeApi();
    document.body.style.display = "block";
    document.oncontextmenu = () => { return false; };
    class WebviewController {
        constructor() {
            this.listLayoutEle = document.getElementById("listLayout");
            this.welcomeLayoutEle = document.getElementById("welcomeLayout");
            this.addLayoutEle = document.getElementById("addLayout");
            this.totalMem = 0;
            this.minMem = 4;
            this.instListData = [];
            this.allInstance = [];
            this.initilizeUI();
        }
        initilizeUI() {
            document.getElementById("btnAddInstnce").onclick = this.AddInstnceClick.bind(this);
            document.getElementById("btnCancelInstnce").onclick = this.cancelInstnceClick.bind(this);
            document.getElementById("memory").oninput = this.onMemoryRangeChange.bind(this);
            document.getElementById("memory").onchange = this.onMemoryRangeChange.bind(this);
            document.getElementById("welcomAddInstance").onclick = this.onClickwelcomAddInstance.bind(this);

            document.getElementById("fileButton").onclick = this.shadowfileButtonClick.bind(this);
            document.getElementById("vmdkFile").onchange = this.fileInputChange.bind(this);
            document.getElementById("vmdkFile").oninput = this.fileInputChange.bind(this);
        }
        shadowfileButtonClick() {
            // selectedFile">No VMDK file choosen
            document.getElementById("vmdkFile").click();
            document.getElementById("selectedFile").setAttribute("theFile", "");
            document.getElementById("selectedFile").innerHTML = "No VMDK file choosen";
        }
        fileInputChange() {
            let selectedFile = "No VMDK file choosen"
            if (document.getElementById("vmdkFile").files.length > 0) {
                selectedFile = document.getElementById("vmdkFile").files.item(0).path;
                document.getElementById("selectedFile").setAttribute("theFile", selectedFile)
            } else {
                document.getElementById("selectedFile").setAttribute("theFile", "")
            }
            document.getElementById("selectedFile").innerHTML = selectedFile;
        }
        registerItemEvents() {
            const payIcons = document.querySelectorAll('.rowPlayIcon');
            for (let i = 0; i < payIcons.length; i++) {
                payIcons[i].onclick = this.onClikPlay.bind(this);
            }
            const delIcons = document.querySelectorAll('.rowDelIcon');
            for (let i = 0; i < delIcons.length; i++) {
                delIcons[i].onclick = this.onClikDelete.bind(this);
            }
            const editIcons = document.querySelectorAll('.rowEditIcon');
            for (let i = 0; i < editIcons.length; i++) {
                editIcons[i].onclick = this.onClikEdit.bind(this);
            }
        }
        onClikPlay(event) {
            vscode.postMessage({ command: 'launchInstance', data: { "uuid": event.currentTarget.getAttribute("uuid"), "instName": event.currentTarget.getAttribute("instName") } });
        }
        onClikDelete(event) {
            vscode.postMessage({ command: 'deleteInstance', data: { "isRunning": event.currentTarget.getAttribute("isRunning"), "uuid": event.currentTarget.getAttribute("uuid"), "instName": event.currentTarget.getAttribute("instName") } });
        }
        onClikEdit(event) {
            vscode.postMessage({ command: 'editInstance', data: { "isRunning": event.currentTarget.getAttribute("isRunning"), "uuid": event.currentTarget.getAttribute("uuid"), "instName": event.currentTarget.getAttribute("instName") } });
        }
        onMemoryRangeChange() {
            document.getElementById("memSelectd").innerHTML = " " + document.getElementById("memory").value + " MB"
        }
        onClickwelcomAddInstance() {
            this.loadAddInstanceLayout({ "totalMem": this.totalMem, "currentOS": this.currentOS })
        }
        cancelInstnceClick() {
            this.listLayoutEle.style.display = "block";
            this.welcomeLayoutEle.style.display = "none"
            this.addLayoutEle.style.display = "none";
            vscode.postMessage({ command: 'loadInstance', data: "" });
        }
        AddInstnceClick() {
            let formData = {};
            formData["instName"] = document.getElementById("instName").value.trim();
            formData["os"] = document.getElementById("os").value;
            formData["monitorCount"] = document.getElementById("monitorCount").value;
            formData["memory"] = document.getElementById("memory").value;
            formData["currentOS"] = this.currentOS;
            formData["w"] = screen.width;
            formData["h"] = screen.height;
            formData["uuid"] = document.getElementById("btnAddInstnce").getAttribute("uuid");
            formData["vmdkController"] = document.getElementById("btnAddInstnce").getAttribute("vmdkController");

            if (document.getElementById("selectedFile").getAttribute("theFile") == "" || document.getElementById("selectedFile").getAttribute("theFile") == null) {
                formData["vmdkFile"] = "";

            } else {
                formData["vmdkFile"] = document.getElementById("selectedFile").getAttribute("theFile");
            }

            if (this.validateAddUpdateInstance(formData)) {
                if (formData["uuid"] == "") {
                    vscode.postMessage({ command: 'addInstance', data: formData });
                } else {
                    vscode.postMessage({ command: 'updateInstance', data: formData });
                }
            }
        }
        validateAddUpdateInstance(formData) {
            // check name has special char
            if (formData.instName.replace(/[^a-zA-Z0-9 ._-]/g) != formData.instName) {
                vscode.postMessage({ command: 'showMsg', data: { "msg": "Name field supports only alphanumeric,   .(dot), - (hyphen),  _(Underscore) and space characters ", isError: true } });
                return false;
            }

            if (formData.instName == "") {
                vscode.postMessage({ command: 'showMsg', data: { "msg": "Enter Instance Name", isError: true } });
                return false;
            }

            for (let i = 0; i < this.allInstance.length; i++) {
                if (this.allInstance[i].label == formData.instName) {
                    if (this.allInstance[i].uuid != formData.uuid) {
                        vscode.postMessage({ command: 'showMsg', data: { "msg": " Instance Name  already exists", isError: true } });
                        return false;
                    }

                }
            }
            if (formData["os"] == null || formData["os"] == "") {
                vscode.postMessage({ command: 'showMsg', data: { "msg": "Select OS", isError: true } });
                return false;
            }

            if (formData.vmdkFile == "") {
                vscode.postMessage({ command: 'showMsg', data: { "msg": " Not selected VMDK File", isError: true } });
                return false;
            }
            if (formData["monitorCount"] == null || formData["monitorCount"] == "") {
                vscode.postMessage({ command: 'showMsg', data: { "msg": "Select Monitor Count", isError: true } });
                return false;
            }
            if (formData["memory"] == null || formData["memory"] == "") {
                vscode.postMessage({ command: 'showMsg', data: { "msg": "Select Memory Size", isError: true } });
                return false;
            }
            return true;
        }
        loadWecomeLayout() {
            document.getElementById("listLoaderProgress").style.display = "none"
            this.listLayoutEle.style.display = "none";
            this.welcomeLayoutEle.style.display = "block"
            this.addLayoutEle.style.display = "none";
            this.instListData = [];
            this.allInstance = [];
        }
        loadListLayout(data) {
            // "data": {"filterdInsance":this.filteredInstanceList,allInstance:data} });

            this.instListData = data.filterdInsance;
            this.allInstance = data.allInstance;
            this.listLayoutEle.style.display = "block";
            this.welcomeLayoutEle.style.display = "none"
            this.addLayoutEle.style.display = "none";
            let instanceList = document.getElementById("instanceList")
            instanceList.innerHTML = "";
            for (let i = 0; i < this.instListData.length; i++) {
                let row = document.createElement('div');
                row.setAttribute("class", "InstlistItem");
                instanceList.appendChild(row);
                if (this.instListData[i].label.startsWith('LG webOS TV')) {
                    row.innerHTML = `
                <div class="InstlistItemTitleContainer">
                    <div class="InstlistItemTitle">
                        <i  style="padding-right:5px"  class="codicon  ${this.instListData[i].isRunning ? "codicon-vm-active" : "codicon-vm"} "></i> ${this.instListData[i].label}
                    </div>
                 </div>
                <div class ="InstlistItemIcons">
                <div title="Launch" class ="InstlistItemIcon"><i uuid ="${this.instListData[i].uuid}" instName ="${this.instListData[i].label}" class="rowPlayIcon codicon codicon-play"></i></div>
                </div>
                `
                } else {
                    row.innerHTML = `
                <div class="InstlistItemTitleContainer">
                    <div class="InstlistItemTitle">
                        <i  style="padding-right:5px"  class="codicon  ${this.instListData[i].isRunning ? "codicon-vm-active" : "codicon-vm"} "></i> ${this.instListData[i].label}
                    </div>
                 </div>
                <div class ="InstlistItemIcons">
                
                <div title="Launch" class ="InstlistItemIcon"><i uuid ="${this.instListData[i].uuid}" instName ="${this.instListData[i].label}" class="rowPlayIcon codicon codicon-play"></i></div> 
                <div title="Edit" class ="InstlistItemIcon"><i uuid ="${this.instListData[i].uuid}" instName ="${this.instListData[i].label}" class="rowEditIcon codicon codicon-edit"></i></div>    
                
                    <div title="Delete" class ="InstlistItemIcon"> <i  isRunning= ${this.instListData[i].isRunning} uuid ="${this.instListData[i].uuid}" instName ="${this.instListData[i].label}" class="rowDelIcon codicon codicon-trash"></i></div>
                </div>
                ` }
            }
        }
        setInitialValue(data) {
            this.totalMem = data.totalMem;
            this.currentOS = data.currentOS;
        }
        loadAddInstanceLayout(data) {
            this.replaceFileInput();
            this.totalMem = data.totalMem;
            this.currentOS = data.currentOS;
            this.listLayoutEle.style.display = "none";
            this.welcomeLayoutEle.style.display = "none"
            this.addLayoutEle.style.display = "block";
            document.getElementById("instName").value = "";
            document.getElementById("memory").min = this.minMem;
            document.getElementById("memory").max = this.totalMem;
            document.getElementById("memMin").innerHTML = this.minMem;
            document.getElementById("memMax").innerHTML = this.totalMem;
            document.getElementById("memory").value = Math.floor(this.totalMem / 2)
            document.getElementById("monitorCount").value = data.monitorCount ? data.monitorCount : 1
            document.getElementById("os").value = "Linux_64"
            document.getElementById("memSelectd").innerHTML = " " + document.getElementById("memory").value + " MB"
            document.getElementById("btnAddInstnce").innerHTML = "Add Instance";
            document.getElementById("btnAddInstnce").setAttribute("uuid", "");
            document.getElementById("btnAddInstnce").setAttribute("vmdkController", "");
            document.getElementById("selectedFile").innerHTML = "No VMDK file choosen";
            document.getElementById("selectedFile").setAttribute("theFile", "")

            document.getElementById("notSupportedContainer").style.display = "none";
            document.getElementById("defaultValueContainer").style.display = "block";
            this.showDefatultCommands();
        }
        showDefatultCommands() {
            let defatultValueArray = [
                "-Graphics Controller : vmsvga",
                "-3d acceleration : Enable",
                "-Mouse : usbtablet",
                "-ScaleFactor : Fit To Screen",
                "-Network adapter1 attached to NAT",
                "-Adapter type 82540EM",
                "-Port forwarding enabled for adapter1",
                "-enact-browser-web-inspector from tcp 9223 to 9999 ",
                "-web-inspector from tcp 9998 to 9998",
                "-ssh from tcp 6622 to 22",
                "-Serial port enabled com1, IRQ 4 and I/O port 0x3f8 for Row file mode"
            ]
            switch (this.currentOS) {
                case 'Darwin':
                    defatultValueArray.push("-Audio : coreaudio")
                    break;
                case 'Linux':
                    defatultValueArray.push("-Audio : pulse")
                    break;
                case 'Windows_NT':
                    defatultValueArray.push("-Audio : dsound")
                    break;
            }
            document.getElementById("defaultValueContainer").style.display = "block"

            document.getElementById("defaultValues").innerHTML = `<div style= "margin-top:-5px" class ="defaultContainerHeader"><i style="padding-right:5px" uuid class="rowPlayIcon codicon codicon-info"></i><span style="vertical-align:top">Other default values </span></div> <hr>  ${defatultValueArray.join("<br>")}`;
            // document.getElementById("defaultValues").innerHTML = "<b>Default Values </b><br>" + defatultValueArray.join("<br>");
        }
        loadAddInstanceLayoutForUpdate(data) {
            this.replaceFileInput();
            this.totalMem = data.totalMem;
            this.currentOS = data.currentOS;
            this.listLayoutEle.style.display = "none";
            this.welcomeLayoutEle.style.display = "none"
            this.addLayoutEle.style.display = "block";
            document.getElementById("instName").value = data.instName;
            document.getElementById("memory").min = this.minMem;
            document.getElementById("memory").max = this.totalMem;
            document.getElementById("memMin").innerHTML = this.minMem;
            document.getElementById("memMax").innerHTML = this.totalMem;
            document.getElementById("memory").value = data.memory
            document.getElementById("monitorCount").value = data.monitorCount
            document.getElementById("os").value = data.os
            document.getElementById("memSelectd").innerHTML = " " + document.getElementById("memory").value + " MB"
            document.getElementById("btnAddInstnce").innerHTML = "Update Instance";
            document.getElementById("btnAddInstnce").setAttribute("uuid", data.uuid);
            document.getElementById("btnAddInstnce").setAttribute("vmdkController", data.vmdkController);
            document.getElementById("selectedFile").innerHTML = data.vmdkFile ? data.vmdkFile : "No VMDK file choosen"
            document.getElementById("selectedFile").setAttribute("theFile", data.vmdkFile ? data.vmdkFile : "")

            // check if non supported parametes
            let notSupported = []

            if (data.instName.replace(/[^a-zA-Z0-9 ._-]/g) != data.instName) {
                notSupported.push("-Name - Contains not supported charactors")
                return false;
            }
            if (data.os != "Linux_64" && data.os != "Linux") {
                notSupported.push("-OS -" + data.os)
            }
            if (data.monitorCount != "1" && data.monitorCount != "2") {
                notSupported.push("-Monitor Count -" + data.monitorCount)
            }
            if (data.memory > this.totalMem) {
                notSupported.push("-Memory -" + data.memory)
            }

            if (notSupported.length > 0) {
                document.getElementById("notSupportedContainer").style.display = "block"
                document.getElementById("notSupportedContainer").innerHTML = `<div style= "margin-top:-5px" class ="notSupportedContainerHeader"><i style="padding-right:5px" uuid class="rowPlayIcon codicon codicon-info"></i><span style="vertical-align:top">Selected instance's not supported values </span></div> <hr>  ${notSupported.join('<br>')}`;

            } else {
                document.getElementById("notSupportedContainer").style.display = "none"
            }
            document.getElementById("defaultValueContainer").style.display = "none"
        }
        replaceFileInput() {
            var oldInput = document.getElementById("vmdkFile");
            var newInput = document.createElement("input");
            newInput.type = "file";
            newInput.id = oldInput.id;
            newInput.accept = oldInput.accept;
            newInput.style.display = "none";
            oldInput.parentNode.replaceChild(newInput, oldInput);
            document.getElementById("vmdkFile").onchange = this.fileInputChange.bind(this);
            document.getElementById("vmdkFile").oninput = this.fileInputChange.bind(this);
        }
    }

    var webviewController = new WebviewController();

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent

        switch (message.command) {
            case "loadInitValue":
                {
                    webviewController.setInitialValue(message.data)
                }
                break;
            case 'loadInstnaceList':
                {
                    if (message.data.filterdInsance.length > 0) {
                        document.getElementById("listLayout").style.display = "block";
                        document.getElementById("welcomeLayout").style.display = "none";
                        document.getElementById("addLayout").style.display = "none";
                        // this.listLayoutEle.style.display = "block";
                        // this.welcomeLayoutEle.style.display = "none"
                        // this.addLayoutEle.style.display = "none";
                        document.getElementById("listLoaderProgress").style.display = "flex"
                        webviewController.loadListLayout(message.data);
                        document.getElementById("listLoaderProgress").style.display = "none"

                        webviewController.registerItemEvents();
                    } else {
                        webviewController.loadWecomeLayout();
                    }
                    break;
                }
            case "clearInstanceList":
                {
                    document.getElementById("listLayout").style.display = "block";
                    document.getElementById("welcomeLayout").style.display = "none";
                    document.getElementById("addLayout").style.display = "none";
                    let instanceList = document.getElementById("instanceList")
                    instanceList.innerHTML = "";
                    document.getElementById("listLoaderProgress").style.display = "flex"

                    break;
                }
            case 'loadAddInstance':
                {
                    webviewController.loadAddInstanceLayout(message.data);
                    break;
                }
            case 'editInstance':
                {
                    webviewController.loadAddInstanceLayoutForUpdate(message.data);
                    break;
                }
        }
    });
}());
