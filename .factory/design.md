# Visual thesis — the calm drafting table

Batch Artifact Export looks like the working sheet behind a dependable release: a pale cotton drafting surface, precise indigo construction lines, registration marks, and a vermilion inspector's stamp. It is a blueprint in the original sense—a reproducible instruction—not a neon “developer tool” theme. The generated hero depicts source sheets passing through a measured converter jig into aligned output plates. Decoration always explains the product's input → adapter → output contract.

## Palette

The default light treatment is deliberate because technical drawings are easiest to annotate on paper. A dark treatment is included for system dark mode and becomes a diazo print rather than a generic black theme.

| Token | Light | Dark | Role |
|---|---:|---:|---|
| drafting-ground | `#F2EBD8` | `#0B2740` | paper / diazo sheet |
| raised-sheet | `#FFFDF4` | `#123652` | local surface |
| blueprint-ink | `#123F65` | `#E9F5F2` | primary text and rules |
| annotation | `#4D6170` | `#B8CAD1` | secondary copy |
| survey-blue | `#006D8F` | `#62D5ED` | controls and focus |
| inspector-red | `#A83224` | `#FF8F7F` | errors and high-signal marks |
| pass-green | `#28724B` | `#79D6A0` | successful checks |
| caution-ochre | `#82610A` | `#F0C75E` | caveats |

All text/control combinations are designed for at least WCAG AA contrast. Status uses labels and shapes in addition to color.

## Type and spacing

- **Drawing labels:** `IBM Plex Mono`, locally subset to Latin in WOFF2, for commands, measurements, labels, and tabular figures. It recalls plotter notation without becoming novelty typography.
- **Reading face:** `Atkinson Hyperlegible Next`, locally subset to Latin in WOFF2, for prose and UI copy. It was chosen for legibility at documentation density.
- The scale is 14 / 16 / 20 / 24 / 40 / 64 px. Body never drops below 16 px.
- Spacing follows a 4 px baseline with working intervals of 8, 12, 16, 24, 32, 48, 72, and 96 px. Main reading measure is 66 characters.
- Rules, coordinates, and crop marks establish hierarchy; boxes are reserved for genuinely separable objects such as the install command and live manifest checker.

## Interaction grammar

- The platform download is the only filled control. Secondary actions look like drafting annotations with underlines and arrowheads.
- Copy actions change from “Copy” to “Copied” and announce through a live region.
- The manifest checker runs entirely in the browser and treats pasted TOML as a sheet under inspection: field errors appear beside a numbered diagnostic list. Nothing is uploaded.
- Platform detection changes the recommended package, while every platform remains keyboard-selectable in a native tab list.
- Focus is a 3 px survey-blue ring with a 3 px paper offset. Targets are at least 44 × 44 px.

## Motion policy

On entry, only the hero's three artifact plates settle along their measured rails (220–280 ms, transform and opacity). Tabs use a short 160 ms opacity transition; copied state is instant. Nothing loops. Under `prefers-reduced-motion: reduce`, all transforms and smooth scrolling are disabled and state changes are immediate.

## Responsive intent

At 390 px, drafting coordinates and decorative marginal notes disappear, the hero illustration moves below the install command, and install tabs become a horizontally scrollable native tab row. The CLI contract, copy action, validation errors, and all install options remain. Tables become labelled definition rows instead of forcing horizontal page scrolling.

## Original asset plan and provenance

- `site/assets/hero-blueprint.webp`: generated specifically for this product with the factory `factory-image` deployment, then converted locally to WebP. Prompt: “Use case: infographic-diagram. Asset type: wide landing-page hero illustration. Primary request: an original precision technical drawing showing a stack of varied source documents entering a mechanical conversion jig and emerging as three perfectly aligned PDF, PNG, and SVG output plates. Scene/backdrop: warm ivory cotton drafting paper with a faint measured square grid, crop marks, registration ticks, dimension arrows, and a single red inspector stamp shape. Style/medium: meticulous mid-century industrial patent drawing, indigo ink, restrained cyan construction lines, slight paper grain, flat orthographic/isometric hybrid, editorial and tactile. Composition: wide 3:2, machine and sheets centered/right with clean negative space, no border. Color palette: ivory, deep blueprint indigo, muted cyan, tiny vermilion accent. Constraints: no readable text, no logos, no gradients, no photorealism, no people, no watermark, coherent mechanisms and clean linework.”
- The BAE monogram, crop marks, grid, arrows, and interface icons are hand-authored in HTML/CSS/SVG by the product builder and released under the repository's MIT license.
- No stock art, icon library, remote font, or third-party runtime asset is used.

