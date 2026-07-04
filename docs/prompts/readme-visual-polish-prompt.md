# Claude Prompt: README Visual Polish

Polish `README.md` so it looks modern, clean, and easy to scan on GitHub.

Use the current codebase as the source of truth. Do not invent features or add claims that are not implemented.

## Goal

Make the README more attractive and professional while keeping it accurate.

## Tasks

1. Improve the hero section
   - Keep the project title clear.
   - Use a short, strong one-line description.
   - Keep badges aligned and readable.
   - Add the dashboard screenshot if `docs/screenshots/dashboard-light.png` exists.

2. Improve readability
   - Use consistent heading levels.
   - Keep paragraphs short.
   - Convert long text blocks into clear bullets or tables.
   - Keep the table of contents accurate.

3. Add feature highlights near the top
   - Add 6 to 8 compact highlights for the strongest implemented features.
   - Examples only if present in code:
     - Multi-cloud inventory
     - Provider management
     - Smart tables
     - Resource topology map
     - Live sync updates
     - RBAC and MFA
     - DNS/domain inventory
     - Branding support

4. Improve screenshots section
   - Add a clean `## Screenshots` section.
   - Use consistent image paths and captions.
   - Only link images that exist.
   - Keep images readable at GitHub README width.

5. Improve Quick Start
   - Make Docker setup the primary path.
   - Keep local setup as a secondary path.
   - Make production notes clear and easy to see.

6. Improve Stack and Architecture
   - Make stack details match current package files.
   - Keep the architecture diagram simple.
   - Remove outdated technology names.

7. Keep Markdown clean
   - Check internal anchor links.
   - Check image links.
   - Keep tables aligned.
   - Avoid excessive emojis.
   - Avoid marketing-heavy language.

## Quality checks

After editing:

- Preview README if possible.
- Confirm all image paths exist.
- Confirm all commands are accurate.
- Confirm all sections are accurate to the codebase.

## Final response

Report:

- README sections polished
- Screenshot links added or skipped
- Outdated content fixed
- Files changed
- Assumptions made
