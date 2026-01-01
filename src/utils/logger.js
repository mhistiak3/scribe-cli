const chalk = require('chalk');

class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message) {
    console.log(chalk.green('✔'), message);
  }

  warn(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message, error = null) {
    console.error(chalk.red('✖'), message);
    if (error && this.verbose) {
      console.error(chalk.gray(error.stack || error.message || error));
    }
  }

  debug(message) {
    if (this.verbose) {
      console.log(chalk.gray('⚙'), message);
    }
  }

  log(message) {
    console.log(message);
  }
}

module.exports = Logger;
