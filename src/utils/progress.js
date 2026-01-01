const ora = require('ora');
const cliProgress = require('cli-progress');
const chalk = require('chalk');

class ProgressManager {
  constructor() {
    this.spinner = null;
    this.progressBar = null;
  }

  startSpinner(message) {
    this.spinner = ora(message).start();
    return this.spinner;
  }

  stopSpinner(message, success = true) {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  createProgressBar(total, format = null) {
    this.progressBar = new cliProgress.SingleBar({
      format: format || chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | {status}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    this.progressBar.start(total, 0, {
      status: 'Starting...'
    });

    return this.progressBar;
  }

  updateProgress(value, payload = {}) {
    if (this.progressBar) {
      this.progressBar.update(value, payload);
    }
  }

  stopProgress() {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }
}

module.exports = ProgressManager;
