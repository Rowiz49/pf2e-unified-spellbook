import { registerAnimistListeners } from "./pf2e-dailies/animist.js";
import { registerStaffListeners } from "./pf2e-dailies/staves.js";

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

  registerStaffListeners(actor, html);
  registerAnimistListeners(actor, html);
}
