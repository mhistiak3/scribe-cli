const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const matter = require('gray-matter');

class ConfigManager {
  constructor(logger) {
    this.logger = logger;
  }

  loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      this.logger.success(`Loaded config from ${configPath}`);
      return config;
    } catch (error) {
      throw new Error(`Failed to parse config file: ${error.message}`);
    }
  }

  parseDemoFile(demoPath) {
    if (!fs.existsSync(demoPath)) {
      throw new Error(`Demo file not found: ${demoPath}`);
    }

    try {
      const content = fs.readFileSync(demoPath, 'utf8');
      const { data } = matter(content);
      const keys = Object.keys(data);
      
      this.logger.success(`Found ${keys.length} frontmatter keys in demo file`);
      return keys;
    } catch (error) {
      throw new Error(`Failed to parse demo file: ${error.message}`);
    }
  }

  async promptForSelectors(frontmatterKeys) {
    const questions = [
      {
        type: 'input',
        name: 'postLinkSelector',
        message: 'Enter CSS selector for post links on the list page:',
        validate: input => input ? true : 'Selector cannot be empty'
      },
      ...frontmatterKeys.map(key => ({
        type: 'input',
        name: `fm_${key}`,
        message: `Enter CSS selector for "${key}" (leave empty to skip):`,
      })),
      {
        type: 'input',
        name: 'contentSelector',
        message: 'Enter CSS selector for the main content body:',
        validate: input => input ? true : 'Selector cannot be empty'
      }
    ];

    return await inquirer.prompt(questions);
  }

  saveConfig(config, outputPath) {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
      this.logger.success(`Config saved to ${outputPath}`);
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }
}

module.exports = ConfigManager;
