# GCA4G (Gemini Code Assist for GAS)

## Overview

GCA4G (Gemini Code Assist for GAS) is a Chrome extension that enhances the Google Apps Script (GAS) editor by providing functionality to pull and push code generated or modified by Gemini.

In this project, the method of interacting with the GAS editor has been changed from retrieving information via the DOM tree to using a `Clasp` class based on the API specifications of the `clasp` CLI tool. This improves the stability of the integration and its resilience to changes in the GAS editor UI.

To comply with Chrome extension's Content Security Policy (CSP) requirements, Vite has been introduced as the build tool, enabling development and building using ES modules.

## Main Features

- **Code Pull/Push via Clasp Integration**: Communicate directly with the GAS API using the `Clasp` class to pull and push code.
- **CSP Compliant Build**: ES module builds using Vite avoid inline scripts and comply with CSP.
- **Diff Display**: Displays code differences before and after pull/push operations.
- **API Caching**: Caches responses from the Gemini API to reduce duplicate requests.
- **GAS Editor Reload**: Reload the GAS editor using the `Alt+Shift+R` shortcut.
- **Chat UI**: A chat interface that enables interaction with Gemini.
- **API Key Encryption**: Encrypt the API key used within the extension using a master password.
- **GAS API Authentication (`chrome.identity`)**: Securely access the GAS API using the `chrome.identity` API.

## Development Environment

- **Language**: JavaScript (ES6+), with type definitions using JSDoc
- **Build Tool**: Vite
- **Package Manager**: bun
- **Static Assets**: Files placed in the `public` directory (e.g., `images/`, `diff*.js`) are copied to the output directory (`dist`) for use in `web_accessible_resources`.

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
  - Changes to the chat UI
  - CSP policy compliance (referring to local CSS/JS files instead of external CDNs)
  - Password format support for the API key input UI
  - New window feature for diff display (diff_window.html, diff_window.js)
  - Saving diff libraries locally (diff.min.js, diff2html.min.js, diff2html.min.css)
  - Addition of API caching functionality (service-worker.js)
  - Asynchronous messaging functionality (popup.js, content.js, service-worker.js)
  - GAS editor tab reload feature using `Alt+Shift+R` (chrome.commands API)
  - Addition of `connect-src` and `commands` permissions to `manifest.json`
  - Full integration with the GAS editor (implementation of content.js)
  - API key encryption
  - Addition and utilization of the `chrome.debugger` permission
  - Addition of `chrome.runtime.lastError` checks to `service-worker.js`
  - UI/UX improvements (enhanced error message and loading state display)
  - Creation of Clasp-related type definitions (interfaces.js)
  - Creation of the basic structure of the Clasp class (Clasp.js) and integration into the Service Worker
  - Addition of pull/push/GAS authentication buttons to the Popup UI and integration
  - Implementation of GAS API authentication (`chrome.identity`)
  - Unit test creation for the Clasp class
  - Execution of integration tests
  - **Introduction of Vite and migration to ES module builds**
- **Future Tasks (partial list)**:
  - UI/UX improvements (related to pull/push operations)
  - Final verification and documentation updates
  - Adding image transmission functionality to the Gemini API (using html2canvas for popup window screenshots)