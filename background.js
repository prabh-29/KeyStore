chrome.commands.onCommand.addListener((command) => {
  const modeMap = {
    "open-search": "search",
    "open-add": "add",
    "open-upload": "upload",
    "open-manage": "manage"
  };
  const mode = modeMap[command];
  if (mode) {
    chrome.storage.session.set({ pendingMode: mode }, () => {
      chrome.action.openPopup();
    });
  }
});
