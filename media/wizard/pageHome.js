/*
  * Copyright (c) 2022-2023 LG Electronics Inc.
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

    const removeCount = 9;
    const tvAPI = [["TV_APILevel_23", "APILevel23"]];
    const oseAPI = [["OSE_APILevel_27", "APILevel27"],["OSE_APILevel_25", "APILevel25"],["OSE_APILevel_24", "APILevel24"],
        ["OSE_APILevel_23", "APILevel23"], ["OSE_APILevel_22", "APILevel22"],
        ["OSE_APILevel_21", "APILevel21"], ["OSE_APILevel_20", "APILevel20"]];
    let removeSelect = function() {
        for (let step = 0; step < removeCount; step++ ) {
            selelctApiVersion.remove(1);
        }
    };
    let makeAPI = function(product) {
        for (const api of product) {
            const opt = document.createElement("option");
            opt.value = api[0];
            opt.text = api[1];
            selelctApiVersion.add(opt,null);
        }
    };
    selelctWebosProduct.addEventListener('change', function() {
        webosProductValue = selelctWebosProduct.value;
        selelctApiVersion.disabled = false;
        if (webosProductValue === 'OSE') {
            descriptionValue = 'webOS OSE ';
            removeSelect();
            makeAPI(oseAPI);
            selelctApiVersion.selectedIndex = 0;
            description.value = "";
        } else if (webosProductValue === 'TV') {
            descriptionValue = 'webOS TV ';
            removeSelect();
            makeAPI(tvAPI);
            selelctApiVersion.selectedIndex = 0;
            description.value = "";
        }                 
    });
    selelctApiVersion.addEventListener('change', function() {
        apiVersionValue = selelctApiVersion.value;
        webosProductValue = selelctWebosProduct.value;
        btnGenerate.disabled = false;
        // [REQUIRED] Update the api level when new version of OSE is released.
        if (apiVersionValue === 'OSE_APILevel_20') {
            description.value = descriptionValue + '2.18.0';
        } else if (apiVersionValue === 'OSE_APILevel_21') {
            description.value = descriptionValue + '2.19.0';
        } else if (apiVersionValue === 'OSE_APILevel_22') {
            description.value = descriptionValue + '2.20.0';
        } else if (apiVersionValue === 'OSE_APILevel_23') {
            description.value = descriptionValue + '2.21.0';
        } else if (apiVersionValue === 'OSE_APILevel_24') {
            description.value = descriptionValue + '2.22.0';
        } else if (apiVersionValue === 'OSE_APILevel_25') {
            description.value = descriptionValue + '2.23.0';
        } else if (apiVersionValue === 'OSE_APILevel_27') {
            description.value = descriptionValue + '2.24.0';
        }
        if (apiVersionValue === 'TV_APILevel_23') {
            description.value = descriptionValue + '23';
        }
    });
    btnGenerate.addEventListener('click', function() {
        vscode.postMessage({
            command: 'Generate',
            apiLevel: apiVersionValue,
            deviceProfile: webosProductValue
        });
    });
}());
