/*
  * Copyright (c) Samsung Electronics Co.,Ltd.
  * https://github.com/Samsung/vscode-extension-tizentv
  * SPDX-License-Identifier: Apache-2.0
  * Modified from the original to apply to webOS Studio
  */

const vscode = require('vscode');

class Button {
    constructor(props) {
        this.iconPath = props.iconPath,
            this.tooltip = props.tooltip,
            this.func = null
    }

    bindAction(func) {
        this.func = func;
    }
}

class InputStep {
    constructor(props) {
        this.props = props;
        this.resultCache = null;
    }

    async execStep() {
        if (Object.prototype.hasOwnProperty.call(this.props,'items')) {
            return await this.showQuickPcik();

        } else {
            return await this.showInputBox();
        }
    }

    showInputBox() {
        return new Promise((resolve, reject) => {
            let input = vscode.window.createInputBox();
            Object.assign(input, this.props);
            input.ignoreFocusOut = true;
            input.buttons = [
                ...(input.step > 1 ? [vscode.QuickInputButtons.Back] : []),
                ...(this.props.buttons != undefined ? this.props.buttons : [])
            ];
            if (this.resultCache) {
                input.value = this.resultCache;
                this.resultCache = null;
            }
            input.onDidAccept(async () => {
                if (input.validator) {
                    input.validationMessage = input.validator(input.value);
                }

                if (input.validationMessage == null) {
                    this.resultCache = input.value;
                    input.hide();
                    // ======= Commented section is for additional step in between step flows ======
                    // if (input.additionalStep) {
                    //     if (await input.additionalStep(input.value)) {
                    //         resolve(input.value);
                    //     }
                    // } else {
                    resolve(input.value.trim());
                    // }
                }
            });
            input.onDidTriggerButton(btn => {
                if (btn === vscode.QuickInputButtons.Back) {
                    reject(vscode.QuickInputButtons.Back);
                }
                else {
                    input.enable = false;
                    btn.func(input);
                    input.enable = true;
                }
            });
            input.onDidChangeValue(() => {
                if (input.validationMessage) {
                    input.validationMessage = null;
                }
            });
            input.show();
        });
    }

    showQuickPcik() {
        return new Promise((resolve, reject) => {
            let input = vscode.window.createQuickPick();
            Object.assign(input, this.props);
            input.ignoreFocusOut = true;
            input.buttons = [
                ...(input.step > 1 ? [vscode.QuickInputButtons.Back] : []),
                ...(this.props.buttons != undefined ? this.props.buttons : [])
            ];
            input.onDidAccept(async () => {
                input.hide();
                if (input.additionalStep) {
                    if (await input.additionalStep(input.selectedItems[0].label)) {
                        resolve(input.selectedItems[0].label);
                    }
                } else {
                    resolve(input.selectedItems[0].label);
                }
            });
            input.onDidTriggerButton(btn => {
                if (btn === vscode.QuickInputButtons.Back) {
                    reject(vscode.QuickInputButtons.Back);
                }
                else {
                    input.enable = false;
                    btn.func(this.input);
                    input.enable = true;
                }
            });
            input.show();
        });
    }
}

class InputController {
    constructor() {
        this.stepQueue = new Array();
        this.resultQueue = new Array();
    }

    async start() {
        let curStep = 0;
        while (curStep < this.stepQueue.length) {
            try {
                let userInput = await this.stepQueue[curStep].execStep();
                this.resultQueue.push(userInput);
            }
            catch (err) {
                if (err === vscode.QuickInputButtons.Back) {
                    if (curStep > 0) {
                        this.resultQueue.pop();
                        curStep--;
                    }
                }
                continue;
            }
            curStep++;
        }

        return this.resultQueue;
    }

    addStep(props) {
        this.stepQueue.push(new InputStep(props));
    }

    reset() {
        this.stepQueue.length = 0;
        this.resultQueue.length = 0;
    }

    static get FileBrowser() {
        return new Button({
            iconPath: new vscode.ThemeIcon('file-directory'),
            tooltip: 'Browser File System'
        });
    }
}

exports.InputController = InputController;
