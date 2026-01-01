const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class Downloader {
  constructor(logger, maxRetries = 3, timeout = 30000) {
    this.logger = logger;
    this.maxRetries = maxRetries;
    this.timeout = timeout;
    this.axiosInstance = axios.create({
      timeout,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  async downloadImage(url, folderPath, filename, retryCount = 0) {
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, filename);
      
      // Check if file already exists
      if (fs.existsSync(filePath)) {
        this.logger.debug(`Image already exists: ${filename}`);
        return filePath;
      }

      const response = await this.axiosInstance({
        url,
        method: 'GET',
        responseType: 'stream'
      });

      await pipeline(response.data, fs.createWriteStream(filePath));
      
      this.logger.debug(`Downloaded: ${filename}`);
      return filePath;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        this.logger.warn(`Retry ${retryCount + 1}/${this.maxRetries} for ${filename}`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.downloadImage(url, folderPath, filename, retryCount + 1);
      }
      
      this.logger.error(`Failed to download ${url}`, error);
      return null;
    }
  }

  async downloadImages(images, folderPath, progressCallback = null) {
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
      const { url, filename } = images[i];
      const result = await this.downloadImage(url, folderPath, filename);
      results.push({ url, filename, success: !!result, path: result });
      
      if (progressCallback) {
        progressCallback(i + 1, images.length);
      }
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = Downloader;
