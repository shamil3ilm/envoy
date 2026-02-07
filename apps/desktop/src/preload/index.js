"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const types_1 = require("../shared/types");
// Type-safe API exposed to renderer
const api = {
    // Template operations
    templates: {
        create: (input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_CREATE, input),
        update: (id, input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_UPDATE, id, input),
        delete: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_DELETE, id),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_GET, id),
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_LIST, filter),
        render: (templateBody, data) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.TEMPLATE_RENDER, templateBody, data),
    },
    // Contact operations
    contacts: {
        create: (input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_CREATE, input),
        update: (id, input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_UPDATE, id, input),
        delete: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_DELETE, id),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_GET, id),
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_LIST, filter),
        import: (csvPath) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_IMPORT, csvPath),
        export: (outputPath) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.CONTACT_EXPORT, outputPath),
    },
    // Email operations
    email: {
        send: (params) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.EMAIL_SEND, params),
        accounts: {
            add: (params) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.EMAIL_ACCOUNT_ADD, params),
            remove: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.EMAIL_ACCOUNT_REMOVE, id),
            list: () => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.EMAIL_ACCOUNT_LIST),
            test: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.EMAIL_ACCOUNT_TEST, id),
        },
    },
    // Document operations
    documents: {
        generate: (request) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.DOCUMENT_GENERATE, request),
        preview: (request) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.DOCUMENT_PREVIEW, request),
    },
    // Audit operations
    audit: {
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.AUDIT_LIST, filter),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.AUDIT_GET, id),
        export: (outputPath, filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.AUDIT_EXPORT, outputPath, filter),
    },
    // Settings operations
    settings: {
        get: () => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SETTINGS_GET),
        set: (settings) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SETTINGS_SET, settings),
    },
    // Python bridge status
    python: {
        status: () => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.PYTHON_STATUS),
        restart: () => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.PYTHON_RESTART),
    },
    // Activity log operations
    activity: {
        log: (input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.ACTIVITY_LOG_CREATE, input),
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.ACTIVITY_LOG_LIST, filter),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.ACTIVITY_LOG_GET, id),
        clear: (beforeDate) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.ACTIVITY_LOG_CLEAR, beforeDate),
        export: () => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.ACTIVITY_LOG_EXPORT),
    },
    // Scheduled message operations
    schedule: {
        create: (input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_CREATE, input),
        update: (id, input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_UPDATE, id, input),
        delete: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_DELETE, id),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_GET, id),
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_LIST, filter),
        cancel: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.SCHEDULE_CANCEL, id),
    },
    // Reminder operations
    reminders: {
        create: (input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_CREATE, input),
        update: (id, input) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_UPDATE, id, input),
        delete: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_DELETE, id),
        get: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_GET, id),
        list: (filter) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_LIST, filter),
        snooze: (id, minutes) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_SNOOZE, id, minutes),
        complete: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_COMPLETE, id),
        dismiss: (id) => electron_1.ipcRenderer.invoke(types_1.IPC_CHANNELS.REMINDER_DISMISS, id),
        onDue: (callback) => {
            const handler = (_event, reminder) => callback(reminder);
            electron_1.ipcRenderer.on('reminder:due', handler);
            // Return unsubscribe function
            return () => electron_1.ipcRenderer.removeListener('reminder:due', handler);
        },
    },
};
// Expose the API to the renderer process
electron_1.contextBridge.exposeInMainWorld('assist', api);
//# sourceMappingURL=index.js.map