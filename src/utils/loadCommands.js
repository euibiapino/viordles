const fs = require('fs');
const path = require('path');

function loadCommands(dir) {
  const commands = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      commands.push(...loadCommands(fullPath));
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data && command.execute) commands.push(command);
    }
  }
  return commands;
}

module.exports = { loadCommands };
