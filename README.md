# GCA4G (Gemini Code Assist for GAS)

## Overview

GCA4G (Gemini Code Assist for GAS) is a Chrome extension that enhances the Google Apps Script (GAS) editor by providing functionality to pull and push code generated or modified by Gemini.

In this project, the method of interacting with the GAS editor has been changed from retrieving information via the DOM tree to using a `Clasp` class based on the API specifications of the `clasp` CLI tool. This improves the stability of the integration and its resilience to changes in the GAS editor UI.

## Summary of Requirements (from `my/docs/requirements.md`)

- **Clasp Authentication**: Access GAS projects with a Google account and securely manage authentication information.
- **Clasp Project Information Management**: Identify and manage the currently active GAS project. Ability to switch between multiple projects.
- **GAS Code Pull**: Retrieve the latest code from a GAS project, allowing for review and editing of code differences.
- **GAS Code Push**: Upload code edited within GCA4G to the GAS project, making it visible in the GAS editor.
- **Clasp Class Robustness**: Designed to be resilient to API calls, network errors, and changes in the GAS API.
- **Unit Tests**: Tests to ensure that changes to the `Clasp` class do not affect other functionalities.

## Summary of Design (from `my/docs/design.md`)

- **Structure**: Centered around the `Clasp` class, `Service Worker`, and `Popup UI`.
- **Clasp Class**: Implements communication with the GAS API, management of project/authentication information, and pull/push logic. Uses the Chrome Storage API.
- **Service Worker**: Acts as an intermediary between `Popup` and the `Clasp` class. Handles messaging and API cache management.
- **Popup UI**: Receives user actions (pull, push, authenticate) and sends messages to the Service Worker.
- **Data Model**: Type definitions using interfaces like `ClaspSettings`, `ClaspCredentials`, `GasFile`.
- **Messaging Flow**: The flow is `Popup` -> `Service Worker` -> `Clasp` class -> GAS API.
- **Testing Strategy**: Unit tests (UT) for each method of the `Clasp` class using mock APIs.

## Summary of Tasks (from `my/docs/tasks.md`)

- **Completed Tasks**:
  - Creation of Clasp-related type definitions (interfaces.js)
  - Creation of the basic structure of the Clasp class (Clasp.js) and integration into the Service Worker
  - Addition of pull/push/GAS authentication buttons to the Popup UI and integration
  - Full integration with the GAS editor (script ID retrieval in content.js and sending to the Service Worker)
  - API key encryption (including master password UI)
  - Unit test creation for the Clasp class
  - Implementation of GAS API authentication (`chrome.identity`)
  - Execution of integration tests
- **Future Tasks (partial list)**:
  - UI/UX improvements (related to pull/push operations)
  - Final verification and documentation updates
  - Addition and utilization of the `chrome.debugger` permission
  - Addition of `chrome.runtime.lastError` checks to `service-worker.js`