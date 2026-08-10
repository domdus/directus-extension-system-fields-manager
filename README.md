# System Fields Manager

Simplify the **Files** and **Users** item forms in Directus for non-admin roles — choose which fields appear, in what order, and at what width.

Open **System Fields Manager** from the left bar (**admins only**). Layouts only affect **non-admin** users. **Administrators always see the default Studio forms** and are never restricted by these rules.

> **Important:** This changes how the Data Studio *looks*. It does **not** replace Directus permissions. People may still read or write fields through the API if their access control allows it. Use Access Control for real security; use this extension to clean up the editing experience.

## Overview

<img alt="System Fields Manager — Users layout editor" src="https://raw.githubusercontent.com/domdus/directus-extension-system-fields-manager/main/docs/screenshot_user_fields.png" width="800" />

Directus shows many system fields on Files and Users by default (storage details, theme options, tokens, and more). For Editors or other roles that only need a few fields, that can be noisy.

With **System Fields Manager** you define **layouts** per collection:

1. Pick which **roles** and/or **policies** the layout applies to  
2. Drag fields into the order you want  
3. Show or hide each field, and set width (half / full / fill)

Matched users then see a quieter form. Everyone else (and all admins) keep the normal Directus layout.

## Features

### Files

Control the file detail form — including the file preview chrome at the top.

<img alt="System Fields Manager — Files layout editor" src="https://raw.githubusercontent.com/domdus/directus-extension-system-fields-manager/main/docs/screenshot_file_fields.png" width="800" />

<img alt="Files form with a custom field layout" src="https://raw.githubusercontent.com/domdus/directus-extension-system-fields-manager/main/docs/screenshot_file.png" width="800" />

- **Reorder** fields on the Files item form  
- **Show or hide** fields (title, description, tags, storage details, and more)  
- Set field **width**: half, full, or fill  
- Include the virtual **File Preview** block — show or hide it and place it in the stack (preview stays full width)  
- Assign the layout to selected **roles** and/or **policies**

### Users

Same idea for the user profile / user edit form.

<img alt="Users form with a custom field layout" src="https://raw.githubusercontent.com/domdus/directus-extension-system-fields-manager/main/docs/screenshot_user.png" width="800" />

- **Reorder** fields on the Users item form  
- **Show or hide** identity, preferences, theming, and admin fields  
- Keep section **dividers** (for example Admin Options) when you want clear groups  
- Set field **width** the same way as on Files  
- Assign by **role** and/or **policy**

### Settings

- **Export / import** your System Fields Manager config as JSON (backup or move between projects)  
- **Remove extension data** cleanly before uninstall (only this extension’s settings — not your files or users)

## How layouts work

For each layout you:

1. Choose **roles** and/or **policies** it should apply to  
2. Arrange fields (drag to reorder)  
3. Toggle **visibility** and **width** per field  

**First matching layout wins** (list order). You can leave roles and policies empty for a **catch-all** — place that layout last so it applies to everyone who didn’t match an earlier rule.

Matching is by **role** or **policy** (including parent roles when your Directus version supports them).

## Installation

Requires **Directus 9.26+ through 12.x**.

### npm

```bash
npm install directus-extension-system-fields-manager
```

Place the package in your Directus `extensions` folder (or install into a project that loads extensions from `node_modules`), then restart Directus.

### Marketplace

Search for **System Fields Manager** in **Settings → Marketplace**. This bundle includes an API hook, so some environments only allow App extensions from the Marketplace — use the npm/manual install below if install is blocked.

### Manual Installation

1. Install and build:

```bash
cd directus-extension-system-fields-manager
npm install
npm run build
```

2. Copy the built package into your Directus `extensions` folder (include `package.json` and the `dist` folder).

3. Restart Directus.

4. In the Data Studio:

   1. Open **Settings → Project Settings → Modules**  
   2. Enable **System Fields Manager**  
   3. Open **System Fields Manager** from the left bar  

App users who should receive layouts need **read access to Project Settings** (`directus_settings`) — normal for roles with App Access — so the Studio can load their resolved layout.

## Getting started

1. Open **System Fields Manager** as an admin.  
2. Start with **Files** — hide storage/technical fields your Editors don’t need, and place File Preview where you want it.  
3. Configure **Users** the same way (for example keep name, email, password, status, and role; hide theming and tokens).  
4. Assign each layout to the right roles/policies; add a catch-all last if you want a default for everyone else.  
5. Test with a **non-admin** account (or another browser profile).  
6. Optionally **Export JSON** from Settings so you can restore the config later.

## Tips

- Always pair simpler Studio forms with the right **permissions** in Directus Access Control.  
- Admins won’t see layout changes on themselves — that’s expected; test as a non-admin.  
- Export your config before major changes or before uninstalling.  
- Uninstall cleanup only removes this extension’s data — your files, users, and other project settings stay intact.  
- There is **no automatic migration** from older “system fields” interface experiments; reconfigure layouts in this module.

## License

MIT
