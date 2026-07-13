# Palette: Localized Japanese User Experience

## Learnings
1. **Direct Localization in Phaser**: Translating text in Phaser is simple by modifying the static text instantiations and `.setText()` calls.
2. **Text Layout/Formatting**: Japanese characters can be wider than Latin characters. Always verify that translated text does not cause layout wrapping or clipping issues, particularly with tight space constraints. Here, standard fonts like 'Plus Jakarta Sans, sans-serif' handle Japanese characters beautifully.
3. **Internal state keys vs Display Strings**: Internal string identifiers (like physics labels or localStorage keys) must remain unchanged to avoid breaking game mechanics, while game display text should be localized.
