# Design System Documentation: Financial Editorial

## 1. Overview & Creative North Star
**Creative North Star: The Precision Architect**

Financial and accounting applications often fall into the trap of "data-density clutter." This design system rejects that noise in favor of a high-end editorial approach. We treat financial data as a curated exhibition—high-trust, authoritative, and sophisticated. 

The system breaks the "standard template" look through **intentional asymmetry** and **tonal depth**. By utilizing a "Naranja" (Orange) accent against a rich, tiered monochromatic foundation, we create an environment that feels both vibrant and secure. We avoid the rigid 1px grid of the past, opting instead for organic sectioning defined by light and surface shifts.

---

## 2. Colors & Surface Philosophy

The color palette is derived directly from the brand's core identity, but applied with a hierarchy that emphasizes readability and luxury.

### Core Palette
- **Primary (`#a63500`):** Used sparingly for high-intent actions.
- **Secondary (`#5f5e5e`):** The stabilizing force, providing grounding and context.
- **Background (`#fff8f6`):** A warm, high-end off-white that prevents "eye-strain" common with pure white screens.

### The "No-Line" Rule
To maintain a premium feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through:
1.  **Background Color Shifts:** Use `surface-container-low` components sitting on a `surface` background.
2.  **Tonal Transitions:** Define workspace areas by moving between `surface-container` and `surface-container-highest`.

### Surface Hierarchy & Nesting
Think of the UI as stacked sheets of fine, semi-translucent paper. 
- **Base Level:** `surface` (`#fff8f6`).
- **Content Blocks:** `surface-container-low` (`#fff1ed`).
- **Active Elevated Cards:** `surface-container-highest` (`#fbdcd3`).

### The Glass & Gradient Rule
For floating modals or sidebar navigations, use **Glassmorphism**. Apply `surface-container` with a 70% opacity and a `24px` backdrop-blur. To give main CTAs "soul," use a subtle linear gradient from `primary` (`#a63500`) to `primary-container` (`#d04400`) at a 135-degree angle.

---

## 3. Typography: The Editorial Scale

We pair **Manrope** for display and headlines with **Inter** for functional body text. This creates a "Modern Journal" aesthetic.

- **Display (Manrope, 3.5rem - 2.25rem):** Used for large balance figures and welcome statements. Character spacing should be set to `-0.02em`.
- **Headline (Manrope, 2rem - 1.5rem):** Used for section titles. These should feel authoritative.
- **Title (Inter, 1.375rem - 1rem):** Used for card headers and navigation labels. Semi-bold weight.
- **Body (Inter, 1rem - 0.75rem):** Regular weight. We prioritize line height (1.5x) to ensure financial legibility.
- **Labels (Inter, 0.75rem - 0.6875rem):** Used for micro-data and table headers. Always use `on-surface-variant` (`#5c4037`) for these.

---

## 4. Elevation & Depth

Standard "Material" shadows are too heavy for a modern financial app. We achieve hierarchy through **Tonal Layering**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft "lift" that feels natural.
- **Ambient Shadows:** For floating elements (like dropdowns), use a shadow with a 32px blur, 0px Y-offset, and 6% opacity using the `on-surface` color. It should feel like a soft glow, not a dark smudge.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline-variant` (`#e5beb2`) at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Buttons
- **Primary:** Gradient (`primary` to `primary-container`), White text, Medium roundness (`0.75rem`).
- **Secondary:** `secondary-container` background with `on-secondary-container` text. No border.
- **Tertiary:** Text-only in `primary` color, with a subtle `surface-container-high` background on hover.

### Input Fields
- **Default State:** Background: `surface-container-low`. No border.
- **Focus State:** 2px "Ghost Border" using `surface-tint` (`#aa3600`) at 40% opacity. 
- **Roundness:** Always `md` (0.75rem).

### Cards & Lists
- **Rule:** **Never use horizontal divider lines.** 
- **Separation:** Use vertical white space (`spacing-6` or `spacing-8`) or switch background tones between list items. For accounting ledgers, use alternating `surface` and `surface-container-lowest` backgrounds for rows.

### Data Visualization (Specific for IDT Ledger)
- **Trend Indicators:** Positive trends use `tertiary` (Blue) instead of standard Green to align with the "high-trust" professional palette. Negative trends use `error` (`#ba1a1a`).
- **Ledger Groups:** Group financial transactions in cards with `xl` roundness (`1.5rem`) to soften the data-heavy interface.

---

## 6. Do's and Don'ts

### Do
- **Do** use `spacing-12` (3rem) for outer page margins to create "Editorial Breathing Room."
- **Do** use the `primary` orange for "Success" or "Money-In" actions to reinforce brand recognition.
- **Do** use Manrope for all numerical figures (amounts, percentages) to leverage its modern geometric shapes.

### Don't
- **Don't** use black (`#000000`) for text. Use `on-surface` (`#281812`) to keep the interface feeling premium and warm.
- **Don't** use standard "Drop Shadows" on cards. Stick to tonal shifts (Layering Principle).
- **Don't** cram data. If a table has more than 8 columns, move secondary data into a "Deep Dive" expandable drawer.

---

*This system is designed to transform financial management from a chore into a premium digital experience.*