import { getActionGlyph, getDefense } from "./utils.js";

/**
 * Builds the base view model for a spell.
 * @param {*} spell The spell item to build the view model for
 * @param {*} entryKey The key of the collection entry this spell belongs to (e.g. "spells-slot1", "focusSpells-focus", etc.), used to identify the source entry for this spell
 * @param {*} rankKey The key of the rank group this spell belongs to (e.g. "cantrips", "focus", "1", "2", etc.)
 * @param {*} overrides An object of properties to override on the base view model, useful for adding/modifying properties that aren't on the spell item itself like expended or slotId
 * @returns A view model object with default properties for a spell entry in the unified spell list.
 */
export function buildBaseViewModel(spell, entryKey, rankKey, overrides = {}) {
  return {
    _id: spell._id,
    name: spell.name,
    img: spell.img,
    entryId: entryKey,
    groupId: rankKey,
    slotId: null,
    expended: false,
    actions: getActionGlyph(spell.system.time?.value),
    defense: getDefense(spell),
    range: spell.system.range?.value ?? "",
    isDrawn: false,
    isItem: false,
    itemId: null,
    hasUses: false,
    uses: null,
    isSignature: false,
    isVirtual: false,
    isAnimistVesselSpell: false,
    isPrimaryAnimistVesselSpell: false,
    ...overrides,
  };
}
