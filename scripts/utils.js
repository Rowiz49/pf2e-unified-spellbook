const actionGlyphMap = {
  0: "F",
  free: "F",
  1: "1",
  2: "2",
  3: "3",
  "1 or 2": "1/2",
  "1 to 3": "1 - 3",
  "2 or 3": "2/3",
  "2 rounds": "3,3",
  reaction: "R",
};

/**
 * Returns a character that can be used with the Pathfinder action font
 * to display an icon. If null it returns empty string.
 */
export function getActionGlyph(action) {
  if (!action && action !== 0) return "";

  const value =
    typeof action === "object"
      ? action.type === "action"
        ? action.value
        : action.type
      : action;
  const sanitized = String(value ?? "")
    .toLowerCase()
    .trim();

  return actionGlyphMap[sanitized]?.replace("-", "–") ?? "";
}

/**
 * Returns the ordinal string for a given positive integer.
 *
 * @param {number} n - A positive integer (e.g. 1, 2, 3).
 * @returns {string} The number with its ordinal suffix (e.g. "1st", "2nd", "3rd", "4th").
 *
 * @example
 * getOrdinalLabel(1);  // "1st"
 * getOrdinalLabel(11); // "11th"
 * getOrdinalLabel(22); // "22nd"
 */
export function getOrdinalLabel(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Capitalizes the first character of a string, leaving the rest unchanged.
 *
 * @param {string} str - The input string.
 * @returns {string} The string with its first character uppercased,
 *   or an empty string if the input is falsy.
 *
 * @example
 * capitalize("reflex"); // "Reflex"
 * capitalize("");       // ""
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Derives the defense string for a spell.
 *
 * Returns `"AC"` for attack spells with no save, the save's statistic name
 * (capitalized) for non-basic saves, or `"basic <Statistic>"` for basic saves.
 * Returns an empty string when the spell targets neither AC nor a save.
 *
 * @param {Item} spell - A PF2e spell item document.
 * @returns {string} The defense label to display, or `""` if none applies.
 */
export function getDefense(spell) {
  const save = spell.system.defense?.save;
  if (!save) return spell.system.traits.value.includes("attack") ? "AC" : "";
  return save.basic
    ? `basic ${capitalize(save.statistic)}`
    : capitalize(save.statistic);
}

/**
 * Gets parent item for item spells
 * @param {Actor} actor
 * @param {string} entryKey
 * @returns Item
 */
export function getParentItem(actor, entryKey) {
  const itemId = entryKey.split("-casting")[0];
  return actor.items.get(itemId);
}
