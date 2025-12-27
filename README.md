# Jack Kane's Personal Website

## Project Structure

```
/
├── index.html                 # Main homepage
├── bookshelf.html            # Bookshelf page
├── ideas.html                # Ideas page
├── writing.html              # Writing page
├── woodshop.html             # Woodshop page
├── decisions.html            # Decisions page
├── assets/
│   ├── images/
│   │   ├── woodshop/        # Woodshop project images
│   │   └── misc/            # Miscellaneous images
│   ├── cv.pdf               # CV document
│   └── decisions.py         # Python script for decisions
├── bookshelf-covers/        # Book cover images
├── essays/                  # Essay markdown and HTML files
├── scripts/
│   └── build-essays.js      # Build script for essays
├── node_modules/
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

## Writing Essays in Markdown

All essays are now written in markdown format in the `essays/` directory.

### Workflow

1. **Write your essay** - Create a new `.md` file in the `essays/` folder:
   ```markdown
   # Essay Title

   Your essay content goes here...
   ```

2. **Build HTML** - Run the build script to convert markdown to HTML:
   ```bash
   npm run build-essays
   ```

3. **Publish** - The generated HTML files maintain all the website styling automatically

### Markdown Features Supported

- Paragraphs
- Headings (H2, H3)
- Lists (ordered and unordered)
- Blockquotes
- Images: `![alt text](image.jpg)`
- Code: inline \`code\` and code blocks
- Links: `[text](url)`

### File Structure

```
essays/
  ├── essay-name.md          (write here)
  └── essay-name.html        (auto-generated)
```

The build script automatically:
- Converts markdown to HTML
- Wraps content in the essay template
- Adds navigation and styling
- Extracts the title from the first `#` heading
