// Setup environment for Vitest Node runner
if (typeof require !== "undefined" && require.extensions) {
  require.extensions[".png"] = (module, filename) => {
    module.exports = filename;
  };
  require.extensions[".jpg"] = (module, filename) => {
    module.exports = filename;
  };
  require.extensions[".webp"] = (module, filename) => {
    module.exports = filename;
  };
}
