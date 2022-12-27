/*
  * Copyright (c) 2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
(function() {
    const vscode = acquireVsCodeApi();
    const originColor = '#85898A';
    const invalidColor = '#CF2A2A';

    const btnBack = document.getElementById('btn-back');
    const btnCancel = document.getElementById('btn-cancel');
    const btnFinish = document.getElementById('btn-finish');
    let appTypeIndex = 0;

    const ulListProjectType = document.querySelector("#list-project-type");
    const liListProjectType = ulListProjectType.querySelectorAll("li");

    const appTypeIndexFromPagecreateproject = document.currentScript.getAttribute('app-type-index');
    select(ulListProjectType, liListProjectType[appTypeIndexFromPagecreateproject], 'selected');

    const btnLeftIcon = document.currentScript.getAttribute('btn-left-icon');
    const btnLeftIconDisabled = document.currentScript.getAttribute('btn-left-icon-disabled');
    const btnRightIcon = document.currentScript.getAttribute('btn-right-icon');
    const btnRightIconDisabled = document.currentScript.getAttribute('btn-right-icon-disabled');
    const listAllIcon = document.currentScript.getAttribute('list-all-icon');
    const listRightIcon = document.currentScript.getAttribute('list-right-icon');
    const listAllIconHover = document.currentScript.getAttribute('list-all-icon-hover');
    const listRightIconHover = document.currentScript.getAttribute('list-right-icon-hover');

    let theme = document.querySelector(':root');
    theme.style.setProperty('--element-btn-left-icon',  "url(" + btnLeftIcon + ")");
    theme.style.setProperty('--element-btn-left-icon-disabled',  "url(" + btnLeftIconDisabled + ")");
    theme.style.setProperty('--element-btn-right-icon',  "url(" + btnRightIcon + ")");
    theme.style.setProperty('--element-btn-right-icon-disabled',  "url(" + btnRightIconDisabled + ")");
    theme.style.setProperty('--element-list-all-icon',  "url(" + listAllIcon + ")");
    theme.style.setProperty('--element-list-right-icon',  "url(" + listRightIcon + ")");
    theme.style.setProperty('--element-list-all-icon-hover',  "url(" + listAllIconHover + ")");
    theme.style.setProperty('--element-list-right-icon-hover',  "url(" + listRightIconHover + ")");

    let defaultDir = document.currentScript.getAttribute('default-dir');
    let type = document.currentScript.getAttribute('selected-type');

    // Get document element
    const propertyHeader = document.getElementById('property-header');
    const propertyGuide = document.getElementById('property-guide');

    const inputLocation = document.getElementById('project-location-input');
    const inputName = document.getElementById('project-name-input');
    const inputId = document.getElementById('project-id-input');
    const inputVersion = document.getElementById('app-version-input');
    const inputTitle = document.getElementById('app-title-input');
    const inputUrl = document.getElementById('hosted-url-input');

    const labelId = document.getElementById('project-id-label');
    const selectLocation = document.getElementById('project-location-select');

    const checkYes = document.getElementById('check-yes');
    const checkNo = document.getElementById('check-no');

    const container = document.getElementById('container');
    let addWebOSlib = true; // default value is true

    // Set default value of all property 
    propertyHeader.innerText = type;
    propertyGuide.innerText = 'Insert Application Information';
    inputLocation.defaultValue = defaultDir;
    inputId.defaultValue = 'com.domain.app';
    inputVersion.defaultValue = '1.0.0';
    inputTitle.defaultValue = 'new app';
    inputUrl.defaultValue = 'http://developer.lge.com/';

    if (type === 'Moonstone' || type === 'Sandstone') {
        // Convert enact template to 'Basic Enact App'
        type = 'Basic Enact App';
    }

    function onLoadEvent() {
        // Set property label and text depends on app/service type
        if (type === 'Basic Web App' || type === 'Web App Info') {
            container.removeChild(document.getElementById('hosted-url-label'));
            container.removeChild(document.getElementById('hosted-url-input'));
            container.removeChild(document.getElementById('webOS-library-label'));
            container.removeChild(document.getElementById('webOS-library-check'));
        } else if (type === 'Hosted Web App') {
            container.removeChild(document.getElementById('webOS-library-label'));
            container.removeChild(document.getElementById('webOS-library-check'));
        } else if (type === 'Basic Enact App' ) {
            container.removeChild(document.getElementById('hosted-url-label'));
            container.removeChild(document.getElementById('hosted-url-input'));
        } else if (type === 'JS Service' || type === 'JS Service Info') {
            propertyGuide.innerText = 'Insert Service Information';
            labelId.innerText = 'Service ID';
            inputId.defaultValue = 'com.domain.app.service';

            container.removeChild(document.getElementById('app-version-label'));
            container.removeChild(document.getElementById('app-version-input'));
            container.removeChild(document.getElementById('app-title-input'));
            container.removeChild(document.getElementById('app-title-label'));
            container.removeChild(document.getElementById('hosted-url-label'));
            container.removeChild(document.getElementById('hosted-url-input'));

            setVisibleProperty('app-version-input', false);
        }

        if (inputLocation.defaultValue) {
            setFilledProperty('location', true);
        } else {
            setFilledProperty('location', false);
        }
        let bigDiv = document.getElementById('big-div');
        bigDiv.style.display = 'flex';
    }

    window.onload = onLoadEvent;

    function select(ulEl, liEl, selectItem) {
        Array.from(ulEl.children).forEach(
            v => v.classList.remove(selectItem)
        );
        if(liEl) liEl.classList.add(selectItem);
    }

    ulListProjectType.addEventListener('click', e => {
        const selected = e.target;
        const nodes = [...e.target.parentElement.children];
        appTypeIndex = nodes.indexOf(e.target);

        select(ulListProjectType, selected, 'selected');

        if(appTypeIndexFromPagecreateproject == appTypeIndex) {
            let msg = "The selected index is the same as the previously selected index."
            vscode.postMessage({
                command: 'CheckNavi',
                htmlType: 'createproject',
                appTypeIndex: appTypeIndex,
                msg: msg
            });
        } else {
            vscode.postMessage({
                command: 'Back',
                htmlType: 'createproject', 
                appTypeIndex: appTypeIndex
            });
        }
    })

    // Register Event
    // Handle the message inside the webview
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data our extension sent
        switch (message.command) {
            case 'SetLocation':
                inputLocation.value = message.location;
                // selected directory path from dialog, makes text color to original
                setValidTextColor('location', true);
                setFilledProperty('location', true);
                break;
            case 'UpdateValidList':
                setValidTextColor(message.valueType, message.validResult);
                break;
        }
    });

    inputLocation.addEventListener('input', function() {
        setValidTextColor('location', true);
        if (inputLocation.value) {
            setFilledProperty('location', true);
        } else {
            // When user does not set location, set existing defaultValue.
            // If workspace is not set, default location is "".
            inputLocation.value = inputLocation.defaultValue;
            if (inputLocation.value) {
                setFilledProperty('location', true);
            } else {
                setFilledProperty('location', false);
            }
        }
    });

    // 'Browser' button for selecting directory path
    selectLocation.addEventListener('click', function() {
        vscode.postMessage({
            command: 'ShowOpenDialog'
        });
    });

    inputName.addEventListener('input', function() {
        setValidTextColor('name', true);
        // There is no default value of input Name
        if (inputName.value) {
            setFilledProperty('name', true);
        } else {
            setFilledProperty('name', false);
        }
    });

    inputId.addEventListener('input', function() {
        setValidTextColor('id', true);
        if (!inputId.value) {
            inputId.value = inputId.defaultValue;
        }
        setFilledProperty('id', true);
    });

    inputVersion.addEventListener('input', function() {
        setValidTextColor('version', true);
        if (!inputVersion.value) {
            inputVersion.value = inputVersion.defaultValue;
        }
        setFilledProperty('version', true);
    });

    inputTitle.addEventListener('input', function() {
        if (!inputTitle.value) {
            inputTitle.value = inputTitle.defaultValue;
        }
    });

    inputUrl.addEventListener('input', function() {
        if (!inputUrl.value) {
            inputUrl.value = inputUrl.defaultValue;
        }
    });

    // Add webOS library check button : Yes
    checkYes.addEventListener('change', event => {
        if (event.target.checked)  {
            checkNo.checked = false;
            addWebOSlib = true;
        } else {
            checkYes.checked = true;
            addWebOSlib = true; // Can be removed, but keep it.
        }
    });

    // Add webOS library check button : No
    checkNo.addEventListener('change', event => {
        if(event.target.checked)  {
            checkYes.checked = false;
            addWebOSlib = false;
        } else {
            // When defalt no checked status, user unchechked
            checkNo.checked = true;
            addWebOSlib = false; // Can be removed, but keep it.
        }
    });

    btnBack.addEventListener('click', function(){
        vscode.postMessage({
            command: 'Back',
            htmlType: 'createproject',
            appTypeIndex: appTypeIndexFromPagecreateproject
        });
    });

    btnCancel.addEventListener('click', function(){
        vscode.postMessage({
            command: 'Cancel'
        });
    });

    btnFinish.addEventListener('click', function() {
        // Check vaild check when user click "finish" button
        let postObj = {
            command : 'Finish',
            validcheckList : []
        };

        if (inputLocation && inputLocation.value) {
            let obj = {
                valueType : 'location',
                value : inputLocation.value
            }
            postObj.validcheckList.push(obj);
            postObj.projectLocation = inputLocation.value;
        }

        if (inputName && inputName.value) {
            let obj = {
                valueType : 'name',
                value : inputName.value,
                projectLocation : inputLocation.value
            }
            postObj.validcheckList.push(obj);
            postObj.projectName = inputName.value;
        }

        if (inputId && inputId.value) {
            let obj = {
                valueType : 'id',
                value : inputId.value
            }
            postObj.validcheckList.push(obj);
            postObj.appId = inputId.value;
        }

        if (inputVersion && inputVersion.value) {
            let obj = {
                valueType : 'version',
                value : inputVersion.value
            }
            postObj.validcheckList.push(obj);
        }

        if (type === 'Basic Web App' || type === 'Web App Info' || type === 'Hosted Web App' || type === 'Basic Enact App') {
            if (inputVersion && inputVersion.value) {
                postObj.appVersion = inputVersion.value;
            }

            if (inputTitle && inputTitle.value) {
                postObj.appTitle = inputTitle.value;
            }

            if (type === 'Hosted Web App') {
                if (inputUrl && inputUrl.value) {
                    postObj.hostedUrl = inputUrl.value;
                }
            } else if (type === 'Basic Enact App') {
                postObj.addWebOSlib = addWebOSlib;
            }
        } else if (type === 'JS Service' || type === 'JS Service Info') {
            postObj.addWebOSlib = addWebOSlib;
        }

        vscode.postMessage(postObj);
    });

    // Set visible and filled property on each input item
    // If an item has default value, don't need to check "filled" status
    let inputPropertyList = [
        { id : 'project-location-input', valueType : 'location', visible: true, filled : true }, // Project 
        { id : 'project-name-input', valueType : 'name', visible: true, filled : false },
        { id : 'project-id-input', valueType : 'id', visible: true, filled : true },
        { id : 'app-version-input', valueType : 'version', visible: true, filled : true }
    ]

    let isFinishEnable = true;
    function setFilledProperty(valueType, filled) {
        if (valueType) {
            for (const i in inputPropertyList) {
                if (valueType === inputPropertyList[i].valueType && inputPropertyList[i].visible === true) {
                    inputPropertyList[i].filled = filled;
                }
            }
        }

        isFinishEnable = true;
        for (const i in inputPropertyList) {
            if (inputPropertyList[i].visible === true && inputPropertyList[i].filled === false) {
                isFinishEnable = false;
                break;
            }
        }
        // Reset btnFinish button enable/disabled
        if (isFinishEnable === true) {
            btnFinish.disabled = false;
        } else if (isFinishEnable === false) {
            btnFinish.disabled = true;
        }
    }

    function setVisibleProperty (elemntId, visible) {
        for (const i in inputPropertyList) {
            if (elemntId === inputPropertyList[i].id) {
                inputPropertyList[i].visible = visible;
            }
        }
    }

    function setValidTextColor(valueType, validResult) {
        // Change text color
        // Invalud Input : Red, Valid Input : original color(Gray)
        for (const i in inputPropertyList) {
            if (valueType == inputPropertyList[i].valueType && inputPropertyList[i].visible === true) {

                let inputElement = document.getElementById(inputPropertyList[i].id);
                if (validResult === true) {
                    inputElement.style.color = originColor;
                } else if (validResult === false) {
                    inputElement.style.color = invalidColor;
                }
                break;
            }
        }
    }
}());
