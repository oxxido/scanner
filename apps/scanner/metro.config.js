// Expo (SDK 52+) detecta los workspaces del monorepo y configura Metro automáticamente.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
