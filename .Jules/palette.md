# Palette: Localized Japanese User Experience

## Learnings
1. **Direct Localization in Phaser**: Translating text in Phaser is simple by modifying the static text instantiations and `.setText()` calls.
2. **Natural Translations over Katakana Loanwords**: Japanese users prefer more native vocabulary (e.g., "得点" for Score, "最高得点" for High Score, "もう一度" for Restart, and "動物合体" for Game Title) rather than phonetic katakana transliterations ("スコア", "ハイスコア", "リスタート", "どうぶつマージ"). This provides a much more immersive and high-quality UX.
3. **Internal state keys vs Display Strings**: Internal string identifiers (like physics labels or localStorage keys) must remain unchanged to avoid breaking game mechanics, while game display text should be localized.
