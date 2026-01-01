const fs = require('fs');
const path = require('path');

class Validator {
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  static isDirectory(dirPath) {
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  static validateConfig(config) {
    const required = ['postLinkSelector', 'contentSelector'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }
    
    return true;
  }

  static sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  }
}

module.exports = Validator;
