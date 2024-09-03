/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const { InputController } = require("./lib/inputController");
const { logger } = require('./lib/logger');

module.exports = async function setLogLevel() {
    const templateList = [
        { label: 'Error', description: 'Only Errors' },
        { label: 'Warning', description: 'Errors and Warnings' },
        { label: 'Info', description: 'Errors, Warnings and Info' },
        { label: 'All',  description: 'Errors, Warnings, Info and Command Running Status' },
       
    ];
    let controller = new InputController();
    controller.addStep({
        title: 'Set Log Level',
        totalSteps: 2,
        step: 1,
        placeholder: 'Select Project Type',
        items: templateList // 
    });

    
    let results = await controller.start();
    logger.setLogLevel(results[0])
}
