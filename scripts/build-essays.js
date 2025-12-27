const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configure marked options
marked.setOptions({
  breaks: false,
  gfm: true
});

const essaysDir = path.join(__dirname, '..', 'essays');

// Essay template
function createEssayHTML(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Jack Kane</title>
    <link href="https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.4;
            color: #374151;
            background-color: #fefefe;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 60px;
            padding: 60px 20px;
        }

        .sidebar {
            position: sticky;
            top: 60px;
            height: fit-content;
        }

        .name {
            font-family: 'Source Serif Pro', serif;
            font-size: 2.2rem;
            font-weight: 500;
            margin-bottom: 8px;
            color: #111827;
            line-height: 1.1;
            text-decoration: none;
            display: block;
        }

        .name:hover {
            color: #059669;
        }

        .title {
            color: #059669;
            font-weight: 500;
            margin-bottom: 20px;
            font-size: 0.95rem;
            line-height: 1.2;
        }

        .nav-links {
            list-style: none;
            margin-bottom: 30px;
        }

        .nav-links li {
            margin-bottom: 8px;
        }

        .nav-links a {
            color: #6b7280;
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.2s ease;
            line-height: 1.3;
        }

        .nav-links a:hover {
            color: #059669;
        }

        .nav-links a.current {
            color: #059669;
            font-weight: 500;
        }

        .contact-info {
            font-size: 0.9rem;
            color: #6b7280;
            line-height: 1.4;
        }

        .contact-info a {
            color: #059669;
            text-decoration: none;
        }

        .main-content {
            padding-top: 20px;
        }

        .intro {
            margin-bottom: 40px;
        }

        .intro h1 {
            font-family: 'Source Serif Pro', serif;
            font-size: 1.8rem;
            font-weight: 500;
            margin-bottom: 16px;
            color: #111827;
            line-height: 1.2;
        }

        .intro p {
            font-size: 1.05rem;
            line-height: 1.5;
            margin-bottom: 12px;
        }

        .essay-content {
            font-size: 1.05rem;
            line-height: 1.6;
            color: #4b5563;
        }

        .essay-content p {
            margin-bottom: 20px;
        }

        .essay-content h2 {
            font-family: 'Source Serif Pro', serif;
            font-size: 1.5rem;
            font-weight: 500;
            margin-top: 30px;
            margin-bottom: 16px;
            color: #111827;
            line-height: 1.2;
        }

        .essay-content h3 {
            font-family: 'Source Serif Pro', serif;
            font-size: 1.3rem;
            font-weight: 500;
            margin-top: 25px;
            margin-bottom: 12px;
            color: #111827;
            line-height: 1.2;
        }

        .essay-content ul, .essay-content ol {
            margin-bottom: 20px;
            padding-left: 25px;
        }

        .essay-content li {
            margin-bottom: 8px;
        }

        .essay-content img {
            width: 100%;
            max-width: 600px;
            height: auto;
            margin: 30px 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .essay-content blockquote {
            font-style: italic;
            color: #4b5563;
            border-left: 3px solid #059669;
            padding-left: 20px;
            margin: 25px 0;
            font-size: 1.1rem;
            line-height: 1.5;
        }

        .essay-content code {
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.95em;
        }

        .essay-content pre {
            background-color: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 20px;
        }

        .essay-content pre code {
            background-color: transparent;
            padding: 0;
        }

        @media (max-width: 768px) {
            .container {
                grid-template-columns: 1fr;
                gap: 30px;
                padding: 30px 20px;
            }

            .sidebar {
                position: static;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 20px;
            }

            .name {
                font-size: 1.8rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <aside class="sidebar">
            <a href="../index.html" class="name">Jack Kane</a>

            <nav>
                <ul class="nav-links">
                    <li><a href="../ideas.html">Ideas</a></li>
                    <li><a href="../bookshelf.html">Bookshelf</a></li>
                    <li><a href="../writing.html" class="current">Writing</a></li>
                    <li><a href="../woodshop.html">Woodshop</a></li>
                    <li><a href="../decisions.html">Decisions</a></li>
                </ul>
            </nav>

            <div class="contact-info">
                <p><a href="mailto:jkane29@icloud.com">jkane29@icloud.com</a></p>
                <p><a href="https://twitter.com/desperad0V" target="_blank">@desperad0V</a></p>
                <p>Office: N/A</p>
            </div>
        </aside>

        <main class="main-content">
            <section class="intro">
                <h1>${title}</h1>
            </section>

            <div class="essay-content">
${content}
            </div>
        </main>
    </div>
</body>
</html>
`;
}

// Read all markdown files and convert them
fs.readdir(essaysDir, (err, files) => {
  if (err) {
    console.error('Error reading essays directory:', err);
    return;
  }

  const mdFiles = files.filter(file => file.endsWith('.md'));

  mdFiles.forEach(file => {
    const mdPath = path.join(essaysDir, file);
    const htmlPath = path.join(essaysDir, file.replace('.md', '.html'));

    // Read markdown file
    const markdown = fs.readFileSync(mdPath, 'utf8');

    // Extract title (first # heading)
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : file.replace('.md', '');

    // Remove the title from content since we'll use it in the template
    const contentWithoutTitle = markdown.replace(/^#\s+.+$/m, '').trim();

    // Convert markdown to HTML
    const htmlContent = marked(contentWithoutTitle);

    // Create full HTML page
    const fullHTML = createEssayHTML(title, htmlContent);

    // Write HTML file
    fs.writeFileSync(htmlPath, fullHTML);
    console.log(`✓ Generated ${file} → ${path.basename(htmlPath)}`);
  });

  console.log(`\nSuccessfully built ${mdFiles.length} essay(s)!`);
});
