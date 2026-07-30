# Design QA

- Source visual truth: `design-assets/home-mockup-reference.png`
- Implementation screenshot: unavailable
- Intended viewport: 390 × 844 mobile
- State: home screen, default star-coin balance, first navigation item selected
- Full-view comparison evidence: blocked because the WeChat DevTools CLI is not installed in this environment and the repository does not provide a browser renderer for WXML/WXSS.
- Focused region comparison evidence: generated hero and action-card assets were opened and checked after cropping; both preserve the source art direction, copy, crop, and image quality. Runtime layout comparison remains unavailable.

## Findings

- [P2] Runtime viewport comparison is unavailable.
  - Location: `miniprogram/pages/index/index`
  - Evidence: the source mockup can be opened, but no rendered mini-program screenshot can be captured in the current environment.
  - Impact: final safe-area spacing and fixed navigation placement still need confirmation in WeChat DevTools at 390 × 844.
  - Fix: open the project in WeChat DevTools, capture the homepage at 390 × 844, and compare it with the source mockup.

## Static checks completed

- Fonts and typography: display lettering remains inside the generated image; dynamic coin and navigation text use platform-safe Chinese font fallbacks.
- Spacing and layout rhythm: hero and action assets retain source aspect ratios; the bottom navigation includes safe-area padding.
- Colors and visual tokens: cream, blush, powder-blue, warm-white, and cocoa tokens were mapped into global WXSS.
- Image quality and asset fidelity: generated PNG source is preserved outside the mini-program package; runtime crops are JPEG-compressed to keep the main package lean.
- Copy and content: all three card labels and four navigation labels match the source visual.
- JavaScript, JSON, and local image references were validated.

## Comparison history

- No visual iteration was possible without a rendered implementation screenshot.

## Follow-up polish

- Confirm safe-area spacing on an iPhone-sized simulator and one Android device.
- If the platform font appears too rigid, add a licensed rounded Chinese UI font as a local asset in a later pass.

final result: blocked
