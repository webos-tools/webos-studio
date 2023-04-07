/*
  * Copyright (c) 2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
(function() {
    const vscode = acquireVsCodeApi();

    const selelctWebosProduct = document.getElementById('selelct-webos-product');
    const selelctApiVersion = document.getElementById('selelct-api-version');
    const btnGenerate = document.getElementById('btn-generate');
    const description = document.getElementById('description');

    const selectRightIcon = document.currentScript.getAttribute('select-right-icon');
    const minHomeImg = document.currentScript.getAttribute('min-homeimg');
    const maxHomeImg = document.currentScript.getAttribute('max-homeimg');

    let theme = document.querySelector(':root');
    theme.style.setProperty('--element-select-right-icon', 'url(' + selectRightIcon + ')');
    theme.style.setProperty('--element-min-homeimg', 'url(' + minHomeImg + ')');
    theme.style.setProperty('--element-max-homeimg', 'url(' + maxHomeImg + ')');

    let webosProductValue = "";
    let apiVersionValue = "";
    let descriptionValue = "";

    function onLoadEvent() {
        let bigDiv = document.getElementById('big-div');

        bigDiv.style.display = 'flex';
    }
    window.onload = onLoadEvent;

    selelctWebosProduct.addEventListener('change', function() {
        webosProductValue = selelctWebosProduct.value;
        selelctApiVersion.disabled = false;
        if (webosProductValue === 'OSE') {
            descriptionValue = 'webOS OSE ';
        }                    
    });
    selelctApiVersion.addEventListener('change', function() {
        apiVersionValue = selelctApiVersion.value;
        btnGenerate.disabled = false;
        // [REQUIRED] Update the api level when new version of OSE is released.
        if (apiVersionValue === 'OSE_APILevel_20') {
            description.value = descriptionValue + '2.18.0';
        } else if (apiVersionValue === 'OSE_APILevel_21') {
            description.value = descriptionValue + '2.19.0';
        } else if (apiVersionValue === 'OSE_APILevel_22') {
            description.value = descriptionValue + '2.20.0';
        }
    });
    btnGenerate.addEventListener('click', function() {
        vscode.postMessage({
            command: 'Generate',
            apiLevel: apiVersionValue
        });
    });
}());
