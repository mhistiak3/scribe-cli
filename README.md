# ScribeCLI

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**A powerful Node.js CLI tool that transforms any blog into a clean Markdown content library.**

Scrapes posts from blog URLs, downloads all images locally, and formats frontmatter exactly how you need it.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Configuration](#configuration) • [Examples](#examples)

</div>

---

## 🚀 Features

- **📝 Custom Frontmatter**: Define your frontmatter structure using a `demo.md` template
- **🖼️ Smart Image Handling**: Automatically downloads hero and content images to local folders and updates all links
- **🧹 Intelligent Cleanup**: Removes duplicate titles, metadata blocks (author/date), and site-specific footer content
- **♾️ Infinite Scroll Support**: Robustly scrolls list pages to capture all posts
- **⚙️ Configurable Selectors**: Use interactive prompts or JSON config files for CSS selectors
- **🔄 Retry Logic**: Automatic retry for failed downloads with exponential backoff
- **📊 Progress Tracking**: Beautiful progress bars and spinners for better UX
- **🎯 Production Ready**: Modular architecture, error handling, and comprehensive logging

## 📦 Installation

### Clone and Use

```bash
git clone https://github.com/mhistiak3/scribe-cli.git
cd scribe-cli
npm install
```

Then run directly:

```bash
node bin/scribe <url> <demo.md> [options]
```

Or make it executable:

```bash
chmod +x bin/scribe
./bin/scribe <url> <demo.md> [options]
```

## 🎯 Usage

### Basic Command

```bash
scribe <blog_list_url> <path_to_demo.md> [options]
```

### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--config` | `-c` | string | - | Path to JSON config file with selectors |
| `--output` | `-o` | string | `./output` | Output directory for generated files |
| `--verbose` | `-v` | boolean | `false` | Enable verbose logging |
| `--headless` | - | boolean | `true` | Run browser in headless mode |
| `--timeout` | - | number | `60000` | Page load timeout in milliseconds |
| `--retry` | - | number | `3` | Number of retries for failed downloads |
| `--save-config` | - | string | - | Save interactive config to a file |
| `--help` | `-h` | - | - | Show help |
| `--version` | `-V` | - | - | Show version |

## ⚙️ Configuration

### 1. Create `demo.md`

Create a sample markdown file with the frontmatter fields you want to extract:

```markdown
---
title: ""
meta_title: ""
description: ""
date: ""
image: ""
categories: []
tags: []
author: ""
draft: false
---

Your content here...
```

The tool will parse these keys and prompt you for CSS selectors for each field.

### 2. Create Config File (Optional)

Create a JSON file with your CSS selectors to skip interactive prompts:

```json
{
  "postLinkSelector": "a[href*='/post/']",
  "fm_title": "h1.post-title",
  "fm_date": "time[datetime]",
  "fm_image": "img.hero-image",
  "fm_author": "span.author-name",
  "fm_categories": "",
  "fm_tags": "",
  "contentSelector": "article.post-content"
}
```

**Selector Tips:**
- Leave empty (`""`) to skip fields or use default values
- For images: Will fallback to Open Graph `og:image` if selector fails
- For dates: Will try `datetime` attribute first, then `innerText`
- For content: Be specific to avoid including navigation/footer elements

## 📚 Examples

### Interactive Mode

```bash
scribe https://blog.example.com/posts demo.md
```

The tool will prompt you for each selector interactively.

### Using Config File

```bash
scribe https://blog.example.com/posts demo.md --config myconfig.json
```

### Save Config for Reuse

```bash
scribe https://blog.example.com/posts demo.md --save-config myconfig.json
```

### Custom Output Directory

```bash
scribe https://blog.example.com/posts demo.md -c config.json -o ./my-posts
```

### Verbose Logging

```bash
scribe https://blog.example.com/posts demo.md -c config.json --verbose
```

### Non-Headless Mode (Debug)

```bash
scribe https://blog.example.com/posts demo.md --headless false
```

## 📁 Output Structure

```
output/
├── images/
│   └── news/
│       └── my-post-slug/
│           ├── hero.jpg
│           ├── content-0.jpg
│           └── content-1.jpg
├── my-post-slug.md
├── another-post-slug.md
└── ...
```

### Generated Markdown Example

```markdown
---
title: "How to Build a CLI Tool"
meta_title: "Build Amazing CLI Tools with Node.js"
description: "A comprehensive guide to building CLI tools"
date: "2026-01-01T00:00:00.000Z"
image: "/images/news/how-to-build-cli-tool/hero.jpg"
categories: ["development"]
tags: ["nodejs", "cli"]
author: "John Doe"
draft: false
---

Your content here with updated image paths...

![Example](/images/news/how-to-build-cli-tool/content-0.jpg)
```

## 🛠️ Development

### Project Structure

```
scribe-cli/
├── bin/
│   └── scribe              # CLI entry point
├── src/
│   ├── cli.js              # Main CLI logic
│   ├── lib/
│   │   ├── scraper.js      # Puppeteer scraping
│   │   ├── downloader.js   # Image downloading
│   │   ├── converter.js    # HTML to Markdown
│   │   └── configManager.js# Config handling
│   └── utils/
│       ├── logger.js       # Logging utility
│       ├── validator.js    # Validation helpers
│       └── progress.js     # Progress indicators
├── demo.md                 # Example frontmatter
├── bonnpark_config.json    # Example config
└── package.json
```

### Scripts

```bash
npm start                   # Run CLI
npm run lint                # Lint code
npm run format              # Format code with Prettier
```

## 🐛 Troubleshooting

### No posts found

- Verify your `postLinkSelector` is correct
- Try running with `--headless false` to see the browser
- Use browser DevTools to inspect the list page

### Images not downloading

- Check if images are behind authentication
- Verify image URLs are accessible
- Increase `--retry` count
- Check network connectivity

### Content missing or incorrect

- Refine your `contentSelector` to be more specific
- Use `--verbose` to see what's being extracted
- Check if the site uses dynamic loading (may need longer timeout)

### Puppeteer errors

```bash
# Install Chromium dependencies (Linux)
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
  libasound2
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Puppeteer](https://pptr.dev/) for web scraping
- [Turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) for interactive CLI prompts
- [Ora](https://github.com/sindresorhus/ora) and [cli-progress](https://github.com/npkgz/cli-progress) for beautiful CLI output

## 📧 Support

- 🐛 [Report a bug](https://github.com/tfistiak/scribe-cli/issues)
- 💡 [Request a feature](https://github.com/tfistiak/scribe-cli/issues)
- 📖 [Documentation](https://github.com/tfistiak/scribe-cli)

---


