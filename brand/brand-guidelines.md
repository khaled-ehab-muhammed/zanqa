# زنقة — Brand guidelines

**Idea:** "الزنقة" is the squeeze of an approaching deadline. The symbol is a timer ring that is not closed — time is
running out — with an orange dot that has popped out of it, like the نقطة of ز / ن. Competitive, not stressful:
the ring stays open and calm, the dot is the single point of energy.

**Personality:** confident, youthful, friendly-rivalry, Egyptian. Voice: colloquial Egyptian Arabic for moments of
feedback ("الزنقة بدأت!"), clear standard labels for navigation and buttons.

## Assets
| File | Use |
|---|---|
| `logo-symbol.svg`, `favicon.svg` | app icon, favicon, small sizes (works down to 16px) |
| `logo-primary.svg` | symbol + wordmark on light backgrounds |
| `logo-dark.svg` | symbol + wordmark on Ink |
| `assets/avatar.svg` | square social avatar (orange) |
| `assets/app-icon-*.png` | 192 / 512 / maskable 512 (PWA/home-screen); `public/apple-touch-icon.png` |

**Honest note:** the symbol is pure vector paths. The wordmark in `logo-primary.svg` / `logo-dark.svg` is *live text*
set in Alexandria ExtraBold, so it only renders correctly where that font is available, and it is not yet a custom
ligature. Before print/launch, open the file in Figma or Inkscape, outline the text, and (optionally) draw a custom
connected form of زنقة, e.g. replacing the نقطة of ن with the brand dot.

## Rules
- Clear space around the logo ≥ the diameter of the orange dot ×2. Minimum symbol size 16px, wordmark 80px wide.
- Don't recolor the dot, add gradients/shadows, stretch, or place the light logo on the cream background's low-contrast tints.
- Orange backgrounds take Ink text, never white.

## UI language
Flat surfaces, 1px warm borders, radius 12–14px, one strong accent per screen. Timer and rank are the hero; status is
always shown with text + a ▶ marker, never color alone. Motion is limited to short color transitions and respects reduced motion.
See `colors.md` and `typography.md`.
