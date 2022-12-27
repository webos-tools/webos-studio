/*
  * Copyright (c) 2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
(function() {
    const vscode = acquireVsCodeApi();

    const btnBack = document.getElementById('btn-back');
    const btnNext = document.getElementById('btn-next');
    const btnCancel = document.getElementById('btn-cancel');

    const ulListProjectType = document.getElementById('list-project-type');
    const ulListProjectSubType = document.getElementById('list-project-sub-type');
    const liListProjectType = ulListProjectType.querySelectorAll('li');
    let liListProjectSubType;

    const btnLeftIcon = document.currentScript.getAttribute('btn-left-icon');
    const btnLeftIconDisabled = document.currentScript.getAttribute('btn-left-icon-disabled');
    const btnRightIcon = document.currentScript.getAttribute('btn-right-icon');
    const btnRightIconDisabled = document.currentScript.getAttribute('btn-right-icon-disabled');
    const listAllIcon = document.currentScript.getAttribute('list-all-icon');
    const listRightIcon = document.currentScript.getAttribute('list-right-icon');
    const listAllIconHover = document.currentScript.getAttribute('list-all-icon-hover');
    const listRightIconHover = document.currentScript.getAttribute('list-right-icon-hover');
    const basicWebappImg = document.currentScript.getAttribute('basic-webappimg');
    const hostedWebappImg = document.currentScript.getAttribute('hosted-webappimg');
    const noImg = document.currentScript.getAttribute('no-img');
    const moonstoneEnactappImg = document.currentScript.getAttribute('moonstone-enactappimg');
    const sandstoneEnactappImg = document.currentScript.getAttribute('sandstone-enactappimg');

    const theme = document.documentElement;
    theme.style.setProperty('--element-btn-left-icon',  'url(' + btnLeftIcon + ')');
    theme.style.setProperty('--element-btn-left-icon-disabled',  'url(' + btnLeftIconDisabled + ')');
    theme.style.setProperty('--element-btn-right-icon',  'url(' + btnRightIcon + ')');
    theme.style.setProperty('--element-btn-right-icon-disabled',  'url(' + btnRightIconDisabled + ')');
    theme.style.setProperty('--element-list-all-icon',  'url(' + listAllIcon + ')');
    theme.style.setProperty('--element-list-right-icon',  'url(' + listRightIcon + ')');
    theme.style.setProperty('--element-list-all-icon-hover',  'url(' + listAllIconHover + ')');
    theme.style.setProperty('--element-list-right-icon-hover',  'url(' + listRightIconHover + ')');

    const webApp = ['Basic Web App', 'Hosted Web App', 'Web App Info'];
    const jsService = ['JS Service', 'JS Service Info'];
    const enactApp = ['Sandstone', 'Moonstone'];
    const all = ['Basic Web App', 'Hosted Web App', 'Web App Info', 'JS Service', 'JS Service Info', 'Sandstone', 'Moonstone'];
    const webAppSize = webApp.length;
    const jsServiceSize = jsService.length;
    const enactAppSize = enactApp.length;
    const allSize = all.length;
    const appImg = document.getElementById('app-img');
    const descText = document.getElementById('desc-text');
    let appType, appSubType, appTypeIndex, listText;

    function onLoadEvent() {
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
    
    function addList(text) {
        let size = 0;

        while (ulListProjectSubType.hasChildNodes()) {
            ulListProjectSubType.removeChild(ulListProjectSubType.firstChild);
        }

        if (text === 'Web App') {
            size = webAppSize;
        } else if (text === 'JS Service') {
            size = jsServiceSize;
        } else if (text === 'Enact App') {
            size = enactAppSize;
        } else {
            size = allSize;
        }

        for (let i=0; i<size; i++) {
            let textNode;
            // create li element
            const li = document.createElement('li');
            
            // add id attribute in li
            li.setAttribute('class','li-right');
            
            // add text node in li
            if (text === 'Web App') {
                textNode = document.createTextNode(webApp[i]);
            } else if (text === 'JS Service') {
                textNode = document.createTextNode(jsService[i]);
            } else if (text === 'Enact App') {
                textNode = document.createTextNode(enactApp[i]);
            } else {
                textNode = document.createTextNode(all[i]);
            }
                
            li.appendChild(textNode);
            
            // add created li in ul
            ulListProjectSubType.appendChild(li);
        }
    }

    function selectDefaultSubType(text, selected) {
        select(ulListProjectType, selected, 'selected');
        addList(text);
        liListProjectSubType = ulListProjectSubType.querySelectorAll('li');
        listText = liListProjectSubType[0].innerText;
        selectSubType(listText, liListProjectSubType[0]);
    }

    function selectSubType(text, selected) {
        let descriptionText = '';

        appSubType = text;
        if (webApp.includes(text)) {
            if (text === 'Basic Web App') {
                appImg.src = basicWebappImg;
                descriptionText = 'Basic web application for webOS';
            } else if (text === 'Hosted Web App') {
                appImg.src = hostedWebappImg;
                descriptionText = 'Hosted web application for webOS';
            } else {
                appImg.src = noImg;
                descriptionText = 'appinfo.json for webOS web application';
            }
            appType = 'Web App';
        } else if (jsService.includes(text)) {
            appImg.src = noImg;
            if (text === 'JS Service') {
                descriptionText = 'JS service for webOS';
            } else if (text === 'JS Service Info') {
                descriptionText = 'services.json, package.json for webOS JS service';
            }
            appType = 'JS Service';
        } else if (enactApp.includes(text)) {
            if (text === 'Moonstone') {
                appImg.src = moonstoneEnactappImg;
                descriptionText = 'The set of components for an Enact-based application using moonstone library';
            } else if (text === 'Sandstone') {
                appImg.src = sandstoneEnactappImg;
                descriptionText = 'The set of components for an Enact-based application  using sandstone library';
            }
            appType = 'Enact App';
        }
        else {
            appImg.src = noImg;
            descriptionText = 'When you select a project, you can view the description of the project';
        }
        descText.textContent = descriptionText;
        select(ulListProjectSubType, selected, 'selected');
    }

    appTypeIndex = document.currentScript.getAttribute('app-type-index');

    if (appTypeIndex == 0) {
        listText = 'all';
    } else {
        listText = liListProjectType[appTypeIndex].innerText;
    }

    selectDefaultSubType(listText, liListProjectType[appTypeIndex]);

    ulListProjectType.addEventListener('click', e => {
        const selected = e.target;
        const text = e.target.innerText;
        const nodes = [...e.target.parentElement.children];
        appTypeIndex = nodes.indexOf(e.target);

        selectDefaultSubType(text, selected);
    });

    ulListProjectSubType.addEventListener('click', e => {
        const selected = e.target;
        const text = e.target.innerText;

        selectSubType(text, selected);
    });

    btnBack.addEventListener('click', function() {
        vscode.postMessage({
            command: 'Back',
            htmlType: 'home'
        });
    });

    btnNext.addEventListener('click', function() {
        vscode.postMessage({
            command: 'Next',
            appType: appType,
            appSubType: appSubType,
            appTypeIndex: appTypeIndex
        });
    });

    btnCancel.addEventListener('click', function() {
        vscode.postMessage({
            command: 'Cancel'
        });
    });
}());
