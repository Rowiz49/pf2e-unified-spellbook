export async function addSettings(MODULE_ID) {
  /*
   * Create setting to show focus spells on top or on bottom
   */
  game.settings.register(MODULE_ID, "showFocusSpellsOnBottom", {
    name: game.i18n.localize("pf2e-unified-spellbook.ShowFocusSpellsOnBottom"),
    hint: game.i18n.localize(
      "pf2e-unified-spellbook.ShowFocusSpellsOnBottomHint",
    ),
    scope: "client", // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config
    type: Boolean, // Number, Boolean, String, or even a custom class or DataModel
    default: false,
    filePicker: false, // set true with a String `type` to use a file picker input,
    requiresReload: false, // when changing the setting, prompt the user to reload
  });
}
