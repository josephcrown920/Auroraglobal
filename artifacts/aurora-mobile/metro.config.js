const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const storeAssetsPath = path
  .resolve(__dirname, "store-assets")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replace(/[\\/]/g, "[\\\\/]");

// Store listing PNGs are deliverables, not React Native bundle inputs. Excluding
// them keeps Metro below this container's shared inotify watcher limit.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(`^${storeAssetsPath}(?:[\\\\/].*)?$`),
];

module.exports = config;
