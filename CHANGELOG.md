# Change Log

All notable changes to the "webOS Studio" extension will be documented in this file.

> This extension is based on the [webOS OSE extension](https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose).

## [1.1.0-pre1] [2023-05-26]

- Improve logging output for user's perspective.
- Add a new command: `webOS OSE: Install Emulator Launcher`

## [1.0.8] [2023-05-15]

- Enhance the Auto-completion feature.
  - Suggest parameters based on user input.
  - Provide descriptions for LS2 API services, methods, and parameters.
  - Manage the API level of projects using `.webosstudio.config`
- Support live reloading in preview.
- Provide operation logs in the OUTPUT panel.
- Support debugging in VS Code.

## [1.0.1] [2022-12-28]

- Add a notice for restriction in README.md.

## [1.0.0] [2022-12-27]

This is an initial release of the webOS Studio extension. Key features are as follows:

- Creating apps and services from templates
- Packaging, installing, launching, and debugging apps and services
- Running ESLint on Enact apps
- Assisting the use of webOS-related APIs through content assist and auto-completion
- Supporting app preview (Web and Enact)
- Managing connected webOS devices
- Managing images for VirtualBox Emulator
- Analyzing IPK files
- Project Wizard
