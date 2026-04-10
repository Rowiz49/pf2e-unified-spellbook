import { getDailies } from "../utils.js";

/**
 * Checks if a spell is a primary animist vessel spell.
 * @param {Actor} actor The actor to check the spell against, used to access dailies data to determine if the spell is a primary vessel spell.
 * @param {*} spell The spell to check.
 * @returns {boolean} True if the spell is a primary animist vessel spell, false otherwise.
 */
export function isPrimaryAnimistVesselSpell(actor, spell) {
  const dailies = getDailies(actor);
  return dailies?.animist?.primaryVessels?.includes(spell.id) ?? false;
}

/**
 * Registers event listeners for animist vessel retrain buttons.
 * @param {Actor} actor The actor to register listeners for.
 * @param {HTMLElement} html The HTML element to register listeners on.
 */
export async function registerAnimistListeners(actor, html) {
  html[0].addEventListener("click", async (event) => {
    const btn = event.target.closest(
      "[data-action='dailies-retrain-unified'][data-retrain-type='vessel']",
    );
    if (!btn || btn.dataset.retraining) return;

    event.stopPropagation();
    event.preventDefault();
    btn.dataset.retraining = "true";

    const spellRow = btn.closest("[data-item-id]");
    const dailies = game.dailies.api;
    if (!spellRow || !dailies?.retrain) return;

    await dailies.retrain(actor, spellRow.dataset.itemId, "vessel");
    actor.sheet.render();
  });
}
