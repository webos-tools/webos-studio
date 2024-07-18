/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
module.exports = async function reloadWebAppPreview(previewPanelInfo) {
  if (!previewPanelInfo.webPanel) {
    return;
  }
  previewPanelInfo.webPanel.webview.postMessage({ command: 'reload' });
}
