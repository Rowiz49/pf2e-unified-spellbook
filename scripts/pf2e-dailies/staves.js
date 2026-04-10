import { getDailies } from "../utils.js";

/**
 * Builds staff entry data from pf2e dailies
 * @param {Actor} actor
 * @param {Item} entry
 * @returns The staff type and it's corresponding charges
 */
export function getStaffData(actor, entry) {
  const rawStaves = getDailies(actor)?.staves;

  const stavesArray = Array.isArray(rawStaves)
    ? rawStaves
    : rawStaves
      ? [rawStaves]
      : [];
  const staffId =
    entry.staff?._id ?? entry.staff?.id ?? entry.id?.replace(/-casting$/, "");

  const staffData = stavesArray.find((s) => s.staffId === staffId);
  if (staffData) {
    const charges = staffData.charges ?? { value: 0, max: 0 };
    return {
      type: "staff",
      current: charges.value,
      max: charges.max,
    };
  } else {
    return {
      type: "staff",
      current: 0,
      max: 0,
    };
  }
}

/**
 * Registers event listeners for staff entries.
 * @param {Actor} actor Pf2e Actor whose staff entry listeners are being registered
 * @param {HTMLElement} html The HTML element for which to register listeners
 */
export function registerStaffListeners(actor, html) {
  const realInput = html[0].querySelector(
    "input[data-action='change-charges']",
  );

  // Spell charges for staves reset buttons: listen for clicks on the reset buttons and set the corresponding inputs to their max values, then trigger change events to propagate those changes.
  html[0].addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='reset-charges-unified']");
    if (!btn || !realInput) return;

    const max = Number(realInput.max);
    realInput.value = String(max);
    realInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Spell charges for staves : listen for changes in the inputs and propagate them to the real input that changes the charges, which is outside of the unified spell list, and trigger change events to propagate those changes.
  html[0].addEventListener("change", (event) => {
    const input = event.target.closest(
      "input[data-action='change-charges-unified']",
    );
    if (!input || !realInput) return;

    realInput.value = input.value;
    realInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
