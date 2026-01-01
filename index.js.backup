const axios = require("axios");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const TurndownService = require("turndown");
const slugify = require("slugify");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const matter = require("gray-matter");
const inquirer = require("inquirer");

// Setup standard output dir
const OUTPUT_DIR = path.join(process.cwd(), "output");

// Helper to download image
async function downloadImage(url, folderPath, filename) {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const filePath = path.join(folderPath, filename);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (e) {
    console.error(`Failed to download image ${url}:`, e.message);
  }
}

async function main() {
  // 1. Parse CLI arguments
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <url> <demoMdPath> [options]")
    .option("config", {
      alias: "c",
      type: "string",
      description: "Path to JSON config file with selectors",
    })
    .demandCommand(2).argv;

  const [listUrl, demoMdPath] = argv._;

  if (!fs.existsSync(demoMdPath)) {
    console.error(`Error: demo.md file not found at ${demoMdPath}`);
    process.exit(1);
  }

  // 2. Parse demo.md to get frontmatter keys
  const demoContent = fs.readFileSync(demoMdPath, "utf8");
  const { data: demoData } = matter(demoContent);
  const frontmatterKeys = Object.keys(demoData);

  console.log(
    `Found frontmatter keys in demo.md: ${frontmatterKeys.join(", ")}`
  );

  // 3. Prompt user for selectors
  let answers;
  if (argv.config) {
    if (!fs.existsSync(argv.config)) {
      console.error(`Error: Config file not found at ${argv.config}`);
      process.exit(1);
    }
    console.log(`Reading selectors from ${argv.config}...`);
    answers = JSON.parse(fs.readFileSync(argv.config, "utf8"));
  } else {
    const questions = [
      {
        type: "input",
        name: "postLinkSelector",
        message:
          'Enter CSS selector for the post links on the list page (e.g., ".post-card a"):',
        validate: (input) => (input ? true : "Selector cannot be empty"),
      },
      ...frontmatterKeys.map((key) => ({
        type: "input",
        name: `fm_${key}`,
        message: `Enter CSS selector for "${key}" (leave empty to skip/use default):`,
      })),
      {
        type: "input",
        name: "contentSelector",
        message:
          'Enter CSS selector for the main content body (e.g., ".entry-content"):',
        validate: (input) => (input ? true : "Selector cannot be empty"),
      },
    ];

    answers = await inquirer.prompt(questions);
  }

  // 4. Launch Puppeteer
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  console.log(`Navigating to ${listUrl}...`);
  await page.goto(listUrl, { waitUntil: "networkidle2" });

  // Auto-scroll to ensure items load (Robust)
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      let checks = 0;
      const maxChecks = 50;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (window.innerHeight + window.scrollY >= scrollHeight - 50) {
          checks++;
          if (checks >= maxChecks) {
            clearInterval(timer);
            resolve();
          }
        } else {
          checks = 0;
        }
      }, 100);
    });
  });

  // 5. Scrape List Page
  const links = await page.$$eval(answers.postLinkSelector, (els) =>
    els.map((el) => el.href)
  );
  const uniqueLinks = [...new Set(links)];
  console.log(`Found ${uniqueLinks.length} posts.`);

  if (uniqueLinks.length === 0) {
    console.warn("No links found using the provided selector.");
    await browser.close();
    return;
  }

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  const turndownService = new TurndownService();

  // 6. Scrape Detail Pages
  for (const link of uniqueLinks) {
    console.log(`Scraping ${link}...`);
    try {
      const postPage = await browser.newPage();
      // Go to page
      await postPage.goto(link, { waitUntil: "domcontentloaded" });

      const postData = {};

      // Extract Frontmatter fields
      for (const key of frontmatterKeys) {
        const selector = answers[`fm_${key}`];
        if (selector) {
          let value;
          if (
            key.toLowerCase().includes("image") ||
            key.toLowerCase().includes("thumb")
          ) {
            // First try selector
            value = await postPage
              .$eval(selector, (el) => el.src)
              .catch(() => null);
            // Fallback to Open Graph
            if (!value) {
              value = await postPage
                .$eval('meta[property="og:image"]', (el) => el.content)
                .catch(() => null);
            }
          } else if (key.toLowerCase().includes("date")) {
            value = await postPage
              .$eval(
                selector,
                (el) => el.getAttribute("datetime") || el.innerText
              )
              .catch(() => null);
          } else {
            value = await postPage
              .$eval(selector, (el) => el.innerText)
              .catch(() => null);
          }
          postData[key] = value || "";
        } else {
          postData[key] = "";
        }
      }

      // --- REFINEMENTS ---

      // Hardcode fields
      postData.categories = ["news"];
      postData.tags = ["Bonn Park Media"];
      postData.draft = false;

      const title = postData.title || postData.name || "untitled";
      const slug =
        slugify(title, { lower: true, strict: true }) || `post-${Date.now()}`;

      // Refine Date Format
      if (postData.date) {
        try {
          const d = new Date(postData.date);
          if (!isNaN(d.getTime())) {
            postData.date = d.toISOString(); // 2023-04-11T00:00:00.000Z
          }
        } catch (e) {
          console.warn(`Could not parse date: ${postData.date}`);
        }
      }

      // Image Path logic
      if (postData.image && postData.image.startsWith("http")) {
        const ext = path.extname(postData.image.split("?")[0]) || ".jpg";
        const filename = `hero${ext}`;
        const imageRelPath = `images/news/${slug}`;
        const imageLocalPath = path.join(OUTPUT_DIR, imageRelPath);

        await downloadImage(postData.image, imageLocalPath, filename);
        postData.image = `/${imageRelPath}/${filename}`;
      }

      // Content Cleanup and Extraction
      const contentData = await postPage.evaluate(
        async (selector, titleToClean) => {
          const container = document.querySelector(selector);
          if (!container) return { html: "", images: [] };

          const div = container.cloneNode(true);

          // Remove H1 Title
          if (titleToClean) {
            const h1s = Array.from(div.querySelectorAll("h1"));
            h1s.forEach((h1) => {
              const h1Text = h1.innerText.trim().toLowerCase();
              const titleText = titleToClean.trim().toLowerCase();
              if (h1Text === titleText || titleText.includes(h1Text)) {
                h1.remove();
              }
            });
          }

          // Remove Metadata Block (Top)
          let removed = false;
          const topElements = Array.from(div.children).slice(0, 5);
          for (const el of topElements) {
            const text = el.innerText.toLowerCase();
            if (
              (text.includes("min read") && text.length < 300) ||
              (text.match(/[a-z]{3} \d{1,2}, \d{4}/) && text.length < 100)
            ) {
              el.remove();
              removed = true;
            }
          }
          if (!removed) {
            const uls = div.querySelectorAll("ul");
            for (const ul of uls) {
              if (ul.innerText.toLowerCase().includes("min read")) {
                ul.remove();
                break;
              }
            }
          }

          // Final string replacement for filler just in case
          div.innerHTML = div.innerHTML.replace(
            /this is just to fill empty area of this tag/gi,
            ""
          );

          // Extract images
          const imgs = Array.from(div.querySelectorAll("img"));
          const images = imgs.map((img, i) => ({
            src: img.src,
            index: i,
          }));

          return { html: div.innerHTML, images };
        },
        answers.contentSelector,
        postData.title || ""
      );

      let finalHtml = contentData.html;

      // processing body images
      if (contentData.images && contentData.images.length > 0) {
        for (const img of contentData.images) {
          if (img.src && img.src.startsWith("http")) {
            const ext = path.extname(img.src.split("?")[0]) || ".jpg";
            const filename = `content-${img.index}${ext}`;
            const imageRelPath = `images/news/${slug}`;
            const imageLocalPath = path.join(OUTPUT_DIR, imageRelPath);

            await downloadImage(img.src, imageLocalPath, filename);

            const newPath = `/${imageRelPath}/${filename}`;
            finalHtml = finalHtml.split(img.src).join(newPath);
          }
        }
      }

      let markdownBody = turndownService.turndown(finalHtml);

      // Post-Turndown Cleanup (String based)
      // Remove "Follow:" lines and everything after "Recent Posts"

      // 1. Remove "Follow:" lines
      markdownBody = markdownBody.replace(/^.*Follow:.*$/gm, "");
      markdownBody = markdownBody.replace(/^.*Listen:.*$/gm, "");

      // 2. Remove "Recent Posts" and everything after
      // Markdown header for Recent Posts might be "Recent Posts\n------------" or "## Recent Posts"
      const recentPostsRegex = /(Recent Posts|See All)[\s\S]*$/i;
      markdownBody = markdownBody.replace(recentPostsRegex, "");

      // 3. Remove extra newlines created by removals
      markdownBody = markdownBody.replace(/\n{3,}/g, "\n\n").trim();

      await postPage.close();

      // Custom Frontmatter Construction
      let frontmatter = "---\n";
      for (const key of frontmatterKeys) {
        let val = postData[key];
        if (key === "categories" || key === "tags") {
          frontmatter += `${key}: ${JSON.stringify(val)}\n`;
        } else if (key === "draft") {
          frontmatter += `${key}: ${val}\n`;
        } else {
          if (
            typeof val === "string" &&
            (val.includes(":") || val.includes('"') || val.includes("'"))
          ) {
            // escape quotes
            frontmatter += `${key}: "${val.replace(/"/g, '\\"')}"\n`;
          } else {
            frontmatter += `${key}: ${val}\n`;
          }
        }
      }
      frontmatter += "---\n\n";

      const fileContent = frontmatter + markdownBody;
      const filePath = path.join(OUTPUT_DIR, `${slug}.md`);
      fs.writeFileSync(filePath, fileContent);
      console.log(`Saved ${filePath}`);
    } catch (error) {
      console.error(`Failed to scrape ${link}:`, error.message);
    }
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
