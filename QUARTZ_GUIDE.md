# Quartz Notes Setup Guide

Your notes section is now set up at `/notes` using Quartz v4!

## Overview

- **Source files**: `quartz/content/` - Write your markdown notes here
- **Built site**: `notes/` - The generated static site (committed to git)
- **Config**: `quartz/quartz.config.ts` - Already customized with your green theme

## Workflow

### 1. Add/Edit Notes

Create or edit markdown files in `quartz/content/`:

```bash
cd quartz/content
# Create a new note
echo "---
title: My New Note
date: $(date +%Y-%m-%d)
---

Your content here" > my-new-note.md
```

### 2. Build the Site

After making changes, rebuild:

```bash
cd quartz
npx quartz build
```

### 3. Update Your Site

Copy the built files to the notes directory:

```bash
cd ..
rm -rf notes
cp -r quartz/public notes
```

### 4. Commit Changes

```bash
git add notes/
git add index.html bookshelf.html writing.html woodshop.html decisions.html ideas.html
git commit -m "Update notes"
git push
```

## Features

- **Backlinks**: Automatically generated between linked notes
- **Tags**: Organize notes with frontmatter tags
- **Search**: Full-text search across all notes
- **Graph view**: Visual network of connected notes
- **Dark mode**: Built-in dark mode support

## Tips

1. Use `[[wikilinks]]` to link between notes
2. Add tags in frontmatter: `tags: [example, guide]`
3. The site matches your green theme (#059669)
4. Write in standard markdown with frontmatter

## Advanced

For more features and customization, see the [Quartz documentation](https://quartz.jzhao.xyz/).

The config is already set up with:
- Your fonts (Source Serif Pro, Inter)
- Your color scheme (green/mint theme)
- Page title: "Notes - Jack Kane"

