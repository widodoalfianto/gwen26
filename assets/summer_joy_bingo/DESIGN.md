---
name: Summer Joy Bingo
colors:
  surface: '#fafaf3'
  surface-dim: '#dbdad4'
  surface-bright: '#fafaf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ed'
  surface-container: '#efeee7'
  surface-container-high: '#e9e8e2'
  surface-container-highest: '#e3e3dc'
  on-surface: '#1b1c18'
  on-surface-variant: '#494738'
  inverse-surface: '#30312c'
  inverse-on-surface: '#f2f1ea'
  outline: '#7a7767'
  outline-variant: '#cbc7b3'
  surface-tint: '#66600c'
  primary: '#66600c'
  on-primary: '#ffffff'
  primary-container: '#f2e989'
  on-primary-container: '#6f6815'
  inverse-primary: '#d2c96d'
  secondary: '#326a2e'
  on-secondary: '#ffffff'
  secondary-container: '#b3f3a6'
  on-secondary-container: '#387133'
  tertiary: '#00677f'
  on-tertiary: '#ffffff'
  tertiary-container: '#c0edff'
  on-tertiary-container: '#00708a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eee686'
  primary-fixed-dim: '#d2c96d'
  on-primary-fixed: '#1f1c00'
  on-primary-fixed-variant: '#4d4800'
  secondary-fixed: '#b3f3a6'
  secondary-fixed-dim: '#98d68d'
  on-secondary-fixed: '#002202'
  on-secondary-fixed-variant: '#185218'
  tertiary-fixed: '#b7eaff'
  tertiary-fixed-dim: '#76d3f3'
  on-tertiary-fixed: '#001f28'
  on-tertiary-fixed-variant: '#004e60'
  background: '#fafaf3'
  on-background: '#1b1c18'
  surface-variant: '#e3e3dc'
typography:
  display-hero:
    fontFamily: Bricolage Grotesque
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  handwritten-accent:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  grid-gutter: 12px
  safe-margin: 20px
---

## Brand & Style

The design system is centered on the concept of a "Sun-Drenched Garden Party." It is crafted for a 26th birthday celebration that feels personal, intimate, and exuberantly joyful. The target audience consists of close friends and family, requiring a UI that feels more like a physical keepsake or a curated gift than a digital utility.

The aesthetic blends **Minimalism** with **Tactile/Skeuomorphic** elements. While the layouts remain clean and functional for mobile gameplay, the individual components possess "physicality"—mimicking paper cards, ink stamps, and organic textures. The emotional response should be one of warmth, nostalgia, and immediate celebration, evoking the sensation of a perfect summer afternoon.

## Colors

The palette is derived from late-spring botanical tones, creating a "sunny day" atmosphere. 

- **Primary (Lemon Verbena):** Used for key highlights, active states, and celebratory moments. It represents the sun.
- **Secondary (Summer Green) & Tertiary (Blue Atoll):** These define team identities ("Team Meadow" and "Team Sky"). They should be used with high-contrast text to ensure legibility.
- **Neutral (Cream White):** The background is not a sterile white but a warm, paper-like cream (#FDFCF5) to reduce eye strain and enhance the tactile feel.
- **Secondary Supports:** Sap Green and Ethereal Blue provide depth for shadows, borders, and secondary UI elements, ensuring the interface feels organic rather than synthetic.

## Typography

This design system uses a rhythmic contrast between structured modernism and quirky expressiveness. 

**Geist** serves as the foundation, providing a technical, clean base that ensures the game remains playable and the data (timer, scores) remains legible. **Bricolage Grotesque** is utilized for headlines; its slightly eccentric, variable-width appearance mimics the charm of hand-cut paper or ink-heavy letterpress.

For "stamped" effects or metadata, **JetBrains Mono** provides a "typewriter" feel that suggests the game was prepared manually. All titles should utilize slight "rotational jitter" (1-2 degrees) via CSS transforms to break the digital grid and reinforce the handwritten narrative.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile devices (360px-430px). The bingo grid itself should be a square aspect ratio container, using `grid-gutter` for spacing between tiles.

- **Mobile First:** The layout relies on a single-column stack for pre-game screens and a tight 5x5 or 4x4 grid for active play.
- **Organic Alignment:** Avoid perfect center-alignment for decorative elements. Shift icons and accents by 2-4px off-center to maintain the "human" feel.
- **Safe Areas:** Ensure a minimum `safe-margin` of 20px on the left and right edges to prevent thumbs from obscuring content on edge-to-edge displays.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layers** and **Soft Ambient Shadows** that mimic paper resting on a wooden table.

- **Surface Layer:** The main background is flat and matte.
- **Card Layer:** Bingo tiles and cards use a very subtle, diffused shadow (`0px 4px 20px rgba(0,0,0,0.05)`) to appear slightly lifted.
- **Active State:** When a tile is "stamped," the elevation should appear to *decrease*, as if the paper has been pressed down. 
- **The "Stamp" Effect:** Use high-opacity, slightly irregular borders for the '✕' marks to simulate ink bleed. These should be rendered as if they are on a layer *above* the text, but with a "Multiply" blend mode effect.

## Shapes

The design system utilizes **Rounded** corners (0.5rem base) to maintain a soft, friendly appearance. 

- **Bingo Tiles:** Should use the base `roundedness` (8px) to feel like collectible tokens.
- **Primary Buttons:** Should use `rounded-xl` (24px) or pill-shapes to invite tapping.
- **Irregularity:** Occasionally apply `border-radius` values that are slightly asymmetrical (e.g., `12px 8px 10px 14px`) for large cards to enhance the "hand-cut" aesthetic.

## Components

### Bingo Tiles
The core component. Each tile is a square card with a subtle 1-degree random rotation. On tap, a "Stamp" (an '✕' in Team Meadow or Team Sky colors) appears with a slight "pop" scale animation. The text inside must remain `text_high_contrast`.

### The Vibrant Timer
A circular or horizontal progress bar using a gradient from `secondary_color_hex` to a warning orange/red. As the time nears zero, the timer should pulse and the "jitter" on the typography should increase in frequency to build tension.

### Action Buttons
Primary buttons should be large (min-height 56px) and use the `primary_color_hex` (Lemon Verbena). They should have a thick, 2px stroke in a darker shade of the same color to feel like a physical "button" or badge.

### Confetti & Celebration
Upon winning "Bingo," utilize a custom confetti particle system using the brand palette (#F2E989, #93D188, #4FAFCE). The motion should be floaty and organic, mimicking falling paper scraps rather than digital sparks.

### Input Fields
Used for player names. These should look like "underline" prompts on a physical card, using a 2px solid bottom border rather than a fully enclosed box.