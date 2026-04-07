// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

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
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Spell data extraction
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SlotInfoNone
 * @property {"none"} type - Indicates no slot tracking (e.g. innate spells).
 */

/**
 * @typedef {Object} SlotInfoSpontaneous
 * @property {"spontaneous"} type
 * @property {number} current - Remaining spell slots for this rank.
 * @property {number} max     - Maximum spell slots for this rank.
 */

/**
 * @typedef {Object} PreparedSlot
 * @property {number}      slotId    - Index of this slot in the `slot.prepared` array.
 * @property {string|null} spellId   - The `_id` of the spell filling this slot, or `null` if empty.
 * @property {boolean}     expended  - Whether the slot has been expended.
 * @property {string|null} spellName - The display name of the prepared spell, or `null` if empty.
 */

/**
 * @typedef {Object} SlotInfoPrepared
 * @property {"prepared"}   type
 * @property {number}       max   - Total number of slots for this rank.
 * @property {PreparedSlot[]} slots - Per-slot state objects (includes empty slots for pip display).
 */

/**
 * @typedef {Object} FocusPip
 * @property {boolean} expended - `true` when this pip has been spent (index >= current focus value).
 */

/**
 * @typedef {Object} SlotInfoFocus
 * @property {"focus"} type
 * @property {number}     current - Remaining focus points.
 * @property {number}     max     - Maximum focus points.
 * @property {FocusPip[]} slots   - One pip per focus point; used by the template to render filled/empty circles.
 */

/**
 * @typedef {Object} SlotInfoEquipment
 * @property {"equipment"} type
 */

/**
 * @typedef {SlotInfoNone|SlotInfoSpontaneous|SlotInfoPrepared|SlotInfoFocus|SlotInfoEquipment} SlotInfo
 */

/**
 * @typedef {Object} SpellViewModel
 * @property {string}      _id      - Foundry item ID of the spell.
 * @property {string}      name     - Display name.
 * @property {string}      img      - Path to the spell's icon image.
 * @property {string}      entryId  - Key of the parent spellcasting collection.
 * @property {number}      castRank - The rank at which this spell is cast (accounts for heightening).
 * @property {string}      groupId  - Rank key used to group spells ("cantrips" or a numeric string).
 * @property {number|null} slotId   - Prepared slot index, or `null` for non-prepared spells.
 * @property {boolean}     expended - Whether this spell instance should be rendered greyed out.
 *   For prepared spells this reflects the individual slot; for spontaneous spells this is
 *   `true` when the rank has no remaining slots.
 * @property {string}      actions  - Action cost glyph value (e.g. "1", "2", "reaction").
 * @property {string}      defense  - Defense string (e.g. "AC", "Reflex", "basic Will").
 * @property {string}      range    - Range string (e.g. "30 feet").
 */

/**
 * @typedef {Object} SourceEntry
 * @property {string}           entryId   - Key of the spellcasting collection this source belongs to.
 * @property {string}           entryName - Display name of the spellcasting entry (e.g. "Arcane Prepared").
 * @property {number}           slotNum   - Numeric slot index used in `system.slots.slot{N}` (0 for cantrips).
 * @property {SlotInfo}         slotInfo  - Slot state for this source at the current rank.
 * @property {SpellViewModel[]} spells    - Spells from this source at the current rank.
 *   Prepared entries emit one entry per slot, so the same spell may appear multiple times.
 */

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
function getDefense(spell) {
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
function getParentItem(actor, entryKey) {
  const itemId = entryKey.split("-casting")[0];
  return actor.items.get(itemId);
}
/**
 * Groups an array of spell items by their effective cast rank.
 *
 * Cantrips are placed under the special key `"cantrips"`. All other spells
 * use the heightened level when available, falling back to the spell's base
 * level.
 *
 * @param {Item[]} spells - Array of PF2e spell item documents belonging to
 *   a single spellcasting collection.
 * @returns {Map<string, Item[]>} A map from rank key to the spells at that rank.
 */
function getSpellsByRank(spells, entry) {
  const spellsByRank = new Map();

  const isFocus = entry?.system?.prepared?.value === "focus";

  for (const spell of spells) {
    let rankKey;

    if (isFocus) {
      rankKey = "focus";
    } else {
      const isCantrip = spell.system.traits.value.includes("cantrip");
      rankKey = isCantrip
        ? "cantrips"
        : String(
            spell.system.location?.heightenedLevel ?? spell.system.level.value,
          );
    }

    if (!spellsByRank.has(rankKey)) spellsByRank.set(rankKey, []);
    spellsByRank.get(rankKey).push(spell);
  }

  return spellsByRank;
}

/**
 * Builds the {@link SlotInfo} object for a given spellcasting entry and rank.
 *
 * The returned object's `type` field determines how the template renders
 * slot indicators in the source sub-header:
 * - `"spontaneous"` — shows remaining / max numeric slots.
 * - `"prepared"`    — shows a pip for each slot, filled or expended.
 * - `"focus"`       — shows a static "Focus" label.
 * - `"equipment"`   — shows a static "Item" label (spell from an item entry).
 * - `"none"`        — shows nothing (e.g. innate spells).
 *
 * @param {boolean} isRegularEntry - Whether the collection comes from a
 *   standard spellcasting entry (i.e. has `entry.system`). Item-based
 *   collections lack `system` and are treated as equipment.
 * @param {string}  rankKey        - The rank key ("cantrips" or a numeric string).
 * @param {Object}  entry          - The spellcasting entry document.
 * @param {Item[]}  rankSpells     - Spells at this rank, used to resolve
 *   prepared slot names.
 * @param {Actor}   actor          - The character actor, used to read the focus pool for focus entries.
 * @returns {SlotInfo} The slot state object for the template.
 */
function getSlotInfo(isRegularEntry, rankKey, entry, rankSpells, actor) {
  const isStaff = !!entry.staff;

  if (isStaff) {
    return getStaffData(actor, entry);
  }

  if (!isRegularEntry) return { type: "equipment" };

  const slotNum = rankKey === "cantrips" ? 0 : Number.parseInt(rankKey);
  const slot = entry.system.slots[`slot${slotNum}`];
  const prepType = entry.system.prepared.value;

  if (prepType === "spontaneous" && slot) {
    return { type: "spontaneous", current: slot.value, max: slot.max };
  }

  if (prepType === "prepared" && slot) {
    return {
      type: "prepared",
      max: slot.max,
      slots: slot.prepared.map((p, idx) => ({
        slotId: idx,
        spellId: p.id,
        expended: p.expended ?? false,
        spellName: p.id
          ? (rankSpells.find((s) => s._id === p.id)?.name ?? null)
          : null,
      })),
    };
  }

  if (prepType === "focus") {
    const focusPool = actor.system.resources.focus ?? { value: 0, max: 0 };
    return {
      type: "focus",
      current: focusPool.value,
      max: focusPool.max,
      slots: Array.from({ length: focusPool.max }, (_, i) => ({
        expended: i >= focusPool.value,
      })),
    };
  }

  if (prepType === "innate") {
    return {
      type: "innate",
    };
  }

  return { type: "none" };
}

/**
 * Builds staff entry data from pf2e dailies
 * @param {Actor} actor
 * @param {Item} entry
 * @returns The staff type and it's corresponding charges
 */
function getStaffData(actor, entry) {
  const rawStaves = actor.flags?.["pf2e-dailies"]?.extra?.dailies?.staves;

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
 * Builds the list of {@link SpellViewModel} objects for a single source entry
 * at a given rank.
 *
 * **Prepared entries** produce one view-model *per slot*, preserving the
 * Foundry slot index (`slotId`) so that cast/expend actions target the correct
 * slot. Slots without a spell are skipped. The same spell document may produce
 * multiple view-models if it has been prepared in more than one slot.
 *
 * **Spontaneous entries** produce one view-model per unique spell. All spells
 * are marked as `expended` when the rank has no remaining slots
 * (`slotInfo.current === 0`), which causes the template to render them greyed out.
 *
 * **All other entry types** (focus, equipment, innate) produce one view-model
 * per spell with `expended: false`.
 *
 * @param {SlotInfo} slotInfo   - Slot state for this source at the current rank.
 * @param {Item[]}   rankSpells - Raw spell items from the collection at this rank.
 * @param {string}   entryKey   - Collection key of the parent spellcasting entry.
 * @param {string}   rankKey    - The rank key ("cantrips" or a numeric string).
 * @param {Actor}    actor      - The actor object
 * @returns {SpellViewModel[]} The spell view-models ready for the template.
 */
function buildSpellViewModels(slotInfo, rankSpells, entryKey, rankKey, actor) {
  const parentItem =
    slotInfo.type === "equipment" ? getParentItem(actor, entryKey) : null;

  const isDrawn = parentItem?.system?.equipped?.carryType === "held";

  const hasUses = slotInfo.type === "innate";

  /** @param {Item} spell @param {number|null} slotId @param {boolean} expended */
  const toViewModel = (spell, slotId, expended) => ({
    _id: spell._id,
    name: spell.name,
    img: spell.img,
    entryId: entryKey,
    castRank:
      spell.system.location?.heightenedLevel ?? spell.system.level.value,
    groupId: rankKey,
    slotId,
    expended,
    actions:
      (spell.system.time?.value === "reaction"
        ? "R"
        : spell.system.time?.value) ?? "",
    defense: getDefense(spell),
    range: spell.system.range?.value ?? "",
    isDrawn,
    isItem: slotInfo.type === "equipment",
    itemId: parentItem?._id,
    hasUses,
    uses: spell.system.location?.uses,
  });

  if (slotInfo.type === "prepared") {
    // One entry per filled slot — duplicates intentional.
    return slotInfo.slots
      .filter((s) => s.spellId)
      .flatMap((s) => {
        const spell = rankSpells.find((r) => r._id === s.spellId);
        return spell ? [toViewModel(spell, s.slotId, s.expended)] : [];
      });
  }

  // Spontaneous: grey out all spells when no slots remain.
  // Focus: grey out all spells when the focus pool is empty.
  // Cantrips: never expended regardless of slot type.
  let expended =
    rankKey !== "cantrips" &&
    ((slotInfo.type === "spontaneous" && slotInfo.current === 0) ||
      (slotInfo.type === "focus" && slotInfo.current === 0) ||
      (slotInfo.type === "staff" && slotInfo.current === 0));

  if (slotInfo.type === "equipment") {
    expended = parentItem?.system?.uses?.value === 0;
  }

  if (slotInfo.type === "innate") {
    return rankSpells.map((spell) => {
      const expended = spell.system.location?.uses?.value === 0;
      return toViewModel(spell, null, expended);
    });
  }

  return rankSpells.map((spell) => toViewModel(spell, null, expended));
}

/**
 * Iterates over every spellcasting collection on the actor and produces a
 * map of rank keys to arrays of {@link SourceEntry} objects, ready to be
 * passed to the Handlebars template.
 *
 * Ritual collections are skipped entirely.
 *
 * @param {Actor} actor - A PF2e character actor document.
 * @returns {Map<string, SourceEntry[]>} A map from rank key to the list of
 *   source entries (spellcasting origins) that have spells at that rank.
 */
export function extractSpells(actor) {
  const collections = actor.spellcasting.collections;
  const rankMap = new Map();

  const keys = [...collections.keys()];

  for (const key of keys) {
    if (key === "rituals") continue;

    const collection = collections.get(key);
    const entry = collection.entry;
    const spells = [...collection.values()];
    const isRegularEntry = !!entry.system;
    const spellsByRank = getSpellsByRank(spells, entry);

    for (const [rankKey, rankSpells] of spellsByRank) {
      if (!rankMap.has(rankKey)) rankMap.set(rankKey, []);

      const slotInfo = getSlotInfo(
        isRegularEntry,
        rankKey,
        entry,
        rankSpells,
        actor,
      );
      const slotNum = rankKey === "cantrips" ? 0 : Number.parseInt(rankKey);
      const spellViewModels = buildSpellViewModels(
        slotInfo,
        rankSpells,
        key,
        rankKey,
        actor,
      );

      rankMap.get(rankKey).push({
        entryId: key,
        entryName: collection.name,
        slotNum,
        slotInfo,
        spells: spellViewModels,
      });
    }
  }

  return rankMap;
}
