/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const templateList = [
    { name: 'Basic Web App', id: 'webapp', desc: 'web app for webOS' },
    { name: 'Basic Enact App', id: 'enact', desc: 'enact app for webOS' },
    { name: 'Hosted Web App', id: 'hosted_webapp', desc: 'hosted web app for webOS' },
    { name: 'Web App Info', id: 'webappinfo', desc: 'appinfo.json for web app' },
    { name: 'JS Service', id: 'js_service', desc: 'js service for webOS' },
    { name: 'JS Service Info', id: 'jsserviceinfo', desc: 'services.json, package.json for JS service' }
];

// icon           Icon             -  app icon files [80x80]
// qmlapp         QML App          -  QML app for webOS
// qmlappinfo     QML App Info     -  appinfo.json for QML app

function getTemplateList() {
    return templateList.map(template => template.name);
}

function getTemplateId(name, deviceProfile = 'OSE') {
    let id;
    for (let i in templateList) {
        if (name === templateList[i].name) {
            id = templateList[i].id;
            break;
        }
    }
    return id;
}
function getTemplateAndDesc() {
    return templateList.map(template => ({ "label": template.name, "description": template.desc }));
}

module.exports = {
    getTemplateList: getTemplateList,
    getTemplateId: getTemplateId,
    getTemplateAndDesc: getTemplateAndDesc
}
