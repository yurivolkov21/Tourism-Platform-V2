# Third-party notices

The MIT license in [LICENSE](LICENSE) covers the code and documentation written
for this project. The material listed here comes from other authors. It is
included under its own license, which still applies, and the MIT license does
not relicense it. If you reuse any of it, follow its own terms.

## Code copied into the repository

| Source | License | Where |
| --- | --- | --- |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT, Copyright (c) 2023 shadcn | Files in `libs/shared/ui/src/components/` generated with the shadcn CLI (style `base-nova`) and then edited. The admin shell started from the shadcn block `dashboard-01`: `app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`, `site-header.tsx` and `chart-area-interactive.tsx` in `apps/admin/src/components/` |
| [ReUI](https://github.com/keenthemes/reui) | MIT, Copyright (c) 2025 Keenthemes Inc | `libs/shared/ui/src/components/reui/` |
| [Magic UI](https://github.com/magicuidesign/magicui) | MIT, Copyright (c) Magic UI | `libs/shared/ui/src/components/animated-theme-toggler.tsx`, `libs/shared/ui/src/components/confetti.tsx`, `apps/web/src/components/motion/animated-grid-pattern.tsx` |
| [React Bits](https://github.com/DavidHDev/react-bits) | MIT + Commons Clause, Copyright (c) 2026 David Haz | `libs/shared/ui/src/components/GradientWaves.tsx`, the animated background of the admin login page |
| [PrebuiltUI](https://prebuiltui.com) | PrebuiltUI terms of service | The logo mark, a free placeholder logo named "Slidex": drawn in `apps/web/src/components/logo.tsx` and `apps/admin/src/components/logo.tsx`, exported to `apps/mobile/assets/splash-mark.png`. Converted from PrebuiltUI samples: `apps/web/src/components/home/stats-slider.tsx`, `apps/web/src/components/motion/tilt-card.tsx` |
| Agent skills | The license of each upstream repository listed in `skills-lock.json` | `.claude/skills/`, `.agents/skills/` |

React Bits allows its components to be used and distributed as part of an
application, website or product, but not sold, sublicensed or redistributed on
their own. PrebuiltUI's terms do not grant a license to redistribute its
samples, so the logo mark and the two converted components are not licensed
for reuse by this repository.

## Images and design references

- `apps/web/public/mock/`: nine photos from Unsplash (Unsplash License) and
  Wikimedia Commons (CC BY 2.0, CC BY 4.0, CC BY-SA 4.0 and CC0). The author and
  license of each photo are listed in
  [CREDITS.md](apps/web/public/mock/CREDITS.md).
- `docs/design/mockups/`: some mockups rebuild layouts of ReUI and PrebuiltUI
  sample pages for design review, and `docs/design/mockups/admin-login/` holds
  screenshots and page outlines of ReUI sample pages. Those designs belong to
  their owners.

## Used by the running product but not stored here

- Photos on the live site are stored on Cloudinary. Each photo keeps its own
  license; author and license are recorded per photo in the admin media
  library.
- The fonts Archivo, Literata and IBM Plex Mono (SIL Open Font License 1.1)
  are downloaded at build time by `next/font` on the web and admin sites, and
  come from the `@expo-google-fonts` packages in the mobile app.
- Map tiles on the contact page come from OpenFreeMap, with data from
  OpenMapTiles and OpenStreetMap contributors.
- npm dependencies keep their own licenses, declared in each package.

## License texts

### MIT (shadcn/ui, ReUI, Magic UI)

The three sources above carry these copyright notices:

```text
Copyright (c) 2023 shadcn
Copyright (c) 2025 Keenthemes Inc
Copyright (c) Magic UI
```

Each is licensed under the following terms:

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### React Bits

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
