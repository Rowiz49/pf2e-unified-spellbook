export async function addSettings(MODULE_ID) {
  /*
   * Create setting to show focus spells on top or on bottom
   */
  game.settings.register(MODULE_ID, "showFocusSpellsOnBottom", {
    name: "Show focus spells at the end of the list",
    hint: "When activated, focus spells will be displayed at the bottom of the spell list",
    scope: "client", // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config
    type: Boolean, // Number, Boolean, String, or even a custom class or DataModel
    default: false,
    filePicker: false, // set true with a String `type` to use a file picker input,
    requiresReload: false, // when changing the setting, prompt the user to reload
  });
}
