/**
 * Registers event listeners for the unified spell list.
 * @param {*} actor - The actor for which to register listeners.
 * @param {*} html - The HTML element for which to register listeners.
 */
export function registerEventListeners(actor, html) {
  // Focus point adjustment buttons (click to increase, right-click to decrease).
  html[0].addEventListener("click", (event) => {
    const pips = event.target.closest(
      "[data-action='adjust-resource'][data-resource='focus']",
    );
    if (!pips) return;
    const resource = actor.getResource("focus");
    if (resource) actor.updateResource("focus", resource.value + 1);
  });

  html[0].addEventListener("contextmenu", (event) => {
    const pips = event.target.closest(
      "[data-action='adjust-resource'][data-resource='focus']",
    );
    if (!pips) return;
    event.preventDefault();
    const resource = actor.getResource("focus");
    if (resource) actor.updateResource("focus", resource.value - 1);
  });

  // Spell slot adjustment: listen for changes to the unified spell list inputs and propagate them to the underlying spellcasting entry data.
  html[0].addEventListener("change", (event) => {
    const input = event.target.closest(
      "input[data-item-property][data-item-id]",
    );
    if (!input) return;
    const item = actor.items.get(input.dataset.itemId);
    if (!item) return;
    item.update({ [input.dataset.itemProperty]: Number(input.value) });
  });

  // Spell charges for staves reset buttons: listen for clicks on the reset buttons and set the corresponding inputs to their max values, then trigger change events to propagate those changes.
  html[0].addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='reset-charges-unified']");
    if (!btn) return;

    //looks for the real input that changes the charges, which is outside of the unified spell list, and resets it to the max value
    const input = html[0].querySelector("input[data-action='change-charges']");
    if (!input) return;

    const max = Number(input.max);
    input.value = String(max);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Spell charges for staves : listen for changes in the inputs and propagate them to the real input that changes the charges, which is outside of the unified spell list, and trigger change events to propagate those changes.
  html[0].addEventListener("change", (event) => {
    const input = event.target.closest(
      "input[data-action='change-charges-unified']",
    );
    if (!input) return;
    const realInput = html[0].querySelector(
      "input[data-action='change-charges']",
    );
    if (!realInput) return;

    realInput.value = input.value;
    realInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
