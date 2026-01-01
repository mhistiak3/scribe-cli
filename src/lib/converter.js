const TurndownService = require('turndown');
const path = require('path');

class Converter {
  constructor(logger) {
    this.logger = logger;
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  htmlToMarkdown(html) {
    return this.turndownService.turndown(html);
  }

  cleanupMarkdown(markdown) {
    // Remove "Follow:" and "Listen:" lines
    markdown = markdown.replace(/^.*Follow:.*$/gm, '');
    markdown = markdown.replace(/^.*Listen:.*$/gm, '');

    // Remove "Recent Posts" and everything after
    const recentPostsRegex = /(Recent Posts|See All)[\s\S]*$/i;
    markdown = markdown.replace(recentPostsRegex, '');

    // Remove extra newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    return markdown;
  }

  async processImages(html, images, slug, downloader, outputDir) {
    let processedHtml = html;
    const imageDownloads = [];

    for (const img of images) {
      if (!img.src || !img.src.startsWith('http')) continue;

      const ext = path.extname(img.src.split('?')[0]) || '.jpg';
      const filename = `content-${img.index}${ext}`;
      const imageRelPath = `images/news/${slug}`;
      const imageLocalPath = path.join(outputDir, imageRelPath);

      imageDownloads.push({
        url: img.src,
        filename,
        path: imageLocalPath,
        relativePath: `/${imageRelPath}/${filename}`
      });
    }

    // Download all images
    const downloads = await downloader.downloadImages(
      imageDownloads.map(d => ({ url: d.url, filename: d.filename })),
      imageDownloads[0]?.path
    );

    // Replace image URLs in HTML
    downloads.forEach((download, index) => {
      if (download.success) {
        const newPath = imageDownloads[index].relativePath;
        processedHtml = processedHtml.split(download.url).join(newPath);
      }
    });

    return processedHtml;
  }

  async downloadHeroImage(imageUrl, slug, downloader, outputDir) {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return imageUrl;
    }

    const ext = path.extname(imageUrl.split('?')[0]) || '.jpg';
    const filename = `hero${ext}`;
    const imageRelPath = `images/news/${slug}`;
    const imageLocalPath = path.join(outputDir, imageRelPath);

    const result = await downloader.downloadImage(imageUrl, imageLocalPath, filename);
    
    if (result) {
      return `/${imageRelPath}/${filename}`;
    }

    return imageUrl;
  }

  formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (error) {
      this.logger.warn(`Could not parse date: ${dateString}`);
    }
    
    return dateString;
  }

  generateFrontmatter(postData, frontmatterKeys) {
    let frontmatter = '---\n';
    
    for (const key of frontmatterKeys) {
      let val = postData[key];
      
      if (key === 'categories' || key === 'tags') {
        frontmatter += `${key}: ${JSON.stringify(val)}\n`;
      } else if (key === 'draft') {
        frontmatter += `${key}: ${val}\n`;
      } else {
        if (typeof val === 'string' && (val.includes(':') || val.includes('"') || val.includes("'"))) {
          frontmatter += `${key}: "${val.replace(/"/g, '\\"')}"\n`;
        } else {
          frontmatter += `${key}: ${val}\n`;
        }
      }
    }
    
    frontmatter += '---\n\n';
    return frontmatter;
  }
}

module.exports = Converter;
