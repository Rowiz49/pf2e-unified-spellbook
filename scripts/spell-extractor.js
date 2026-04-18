import { getParentItem } from "./utils.js";
import { injectSignatureVirtuals } from "./signature-spells.js";
import { getStaffData } from "./pf2e-dailies/staves.js";
import { isPrimaryAnimistVesselSpell } from "./pf2e-dailies/animist.js";
import { buildBaseViewModel } from "./spell-view-model.js";
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
 * @property {string|null}      itemId    - Foundry item ID of the spellcasting entry.
 * @property {string}           entryName - Display name of the spellcasting entry (e.g. "Arcane Prepared").
 * @property {number}           slotNum   - Numeric slot index used in `system.slots.slot{N}` (0 for cantrips).
 * @property {SlotInfo}         slotInfo  - Slot state for this source at the current rank.
 * @property {SpellViewModel[]} spells    - Spells from this source at the current rank.
 *   Prepared entries emit one entry per slot, so the same spell may appear multiple times.
 */

/**
 * Groups an array of spell items by their effective cast rank.
 *
 * Cantrips are placed under the special key `"cantrips"`. All other spells
 * use the heightened level when available, falling back to the spell's base
 * level. Spells that are not currently prepared in any slot are ignored for prepared entries.
 *
 * @param {Item[]} spells - Array of PF2e spell item documents belonging to
 *   a single spellcasting collection.
 * @param {Object} entry   - The spellcasting entry document, used to determine
 *   preparation type and slot-based spell assignments for prepared entries.
 * @returns {Map<string, Item[]>} A map from rank key to the spells at that rank.
 */
function getSpellsByRank(spells, entry) {
  const spellsByRank = new Map();
  const prepType = entry?.system?.prepared?.value;
  const isFocus = prepType === "focus";

  // Build a quick lookup so we don't scan the array repeatedly.
  const spellById = new Map(spells.map((s) => [s._id, s]));

  if (prepType === "prepared" && !entry.system?.prepared?.flexible) {
    // Source of truth is the slot data, not the spell's own heightenedLevel.
    return getPreparedSpellsByRank(entry, spellsByRank, spellById);
  }

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
 * Gets prepared spells for a spellcasting entry, grouped by rank. The source of truth is the `entry.system.slots` data, which determines how many slots of each rank there are and which spells are prepared in them. Spells that are not currently prepared in any slot are ignored.
 * @param {Object} entry - The spellcasting entry document, used to determine preparation type and slot-based spell assignments.
 * @param {Map<string, Item[]>} spellsByRank - The map being built of spells by rank, used to group the prepared spells.
 * @param {Map<string, Item>} spellById - A lookup map from spell ID to spell document, used to resolve the spell items for prepared slots.
 * @returns {Map<string, Item[]>} The updated map of spells by rank, now including the prepared spells.
 */
function getPreparedSpellsByRank(entry, spellsByRank, spellById) {
  for (const [slotKey, slot] of Object.entries(entry.system.slots)) {
    if (!slot.prepared?.length) continue;

    const slotNum = Number.parseInt(slotKey.replace("slot", ""));
    const rankKey = slotNum === 0 ? "cantrips" : String(slotNum);

    if (!spellsByRank.has(rankKey)) spellsByRank.set(rankKey, []);

    for (const prepared of slot.prepared) {
      if (!prepared.id) continue;
      const spell = spellById.get(prepared.id);
      if (spell) spellsByRank.get(rankKey).push(spell);
    }
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
function getSlotInfo(
  isRegularEntry,
  rankKey,
  entryKey,
  entry,
  rankSpells,
  actor,
) {
  const isStaff = !!entry.staff;

  if (isStaff) {
    return getStaffData(actor, entry);
  }

  if (!isRegularEntry) {
    const parentItem = getParentItem(actor, entryKey);
    const quantity = parentItem?.system?.quantity ?? 1;

    return { type: "equipment", quantity, parentItem };
  }

  const slotNum = rankKey === "cantrips" ? 0 : Number.parseInt(rankKey);
  const slot = entry.system.slots[`slot${slotNum}`];
  const prepType = entry.system.prepared.value;
  const isFlexible = entry.system.prepared.flexible;

  if ((prepType === "spontaneous" || isFlexible) && slot) {
    return {
      type: "spontaneous",
      current: slot.value,
      max: slot.max,
      isFlexible,
    };
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
    const isAnimistVessel =
      entry.flags?.["pf2e-dailies"]?.identifier === "animist-focus";
    return {
      type: "focus",
      isAnimistVessel,
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
  const parentItem = slotInfo.type === "equipment" ? slotInfo.parentItem : null;
  const isDrawn = parentItem?.system?.equipped?.carryType === "held";
  const slotRank =
    rankKey === "cantrips"
      ? getCastRank(rankSpells[0], rankKey)
      : Number.parseInt(rankKey);

  const toViewModel = (spell, overrides = {}) =>
    buildBaseViewModel(spell, entryKey, rankKey, {
      prepType: slotInfo.type,
      isDrawn,
      isItem: slotInfo.type === "equipment",
      itemId: parentItem?._id ?? null,
      hasUses: slotInfo.type === "innate",
      uses: spell.system.location?.uses ?? null,
      isSignature: spell.system.location?.signature ?? false,
      isAnimistVesselSpell: slotInfo.isAnimistVessel ?? false,
      isPrimaryAnimistVesselSpell:
        (slotInfo.isAnimistVessel ?? false) &&
        isPrimaryAnimistVesselSpell(actor, spell),
      isFlexible: slotInfo.isFlexible ?? false,
      ...overrides,
    });

  if (slotInfo.type === "prepared") {
    return slotInfo.slots
      .filter((s) => s.spellId)
      .flatMap((s) => {
        const spell = rankSpells.find((r) => r._id === s.spellId);
        return spell
          ? [
              toViewModel(spell, {
                castRank: slotRank,
                slotId: s.slotId,
                expended: s.expended,
              }),
            ]
          : [];
      });
  }

  if (slotInfo.type === "innate") {
    return rankSpells.map((spell) =>
      toViewModel(spell, {
        castRank: getCastRank(spell, rankKey),
        expended: spell.system.location?.uses?.value === 0,
      }),
    );
  }

  const expended =
    rankKey !== "cantrips" &&
    ((slotInfo.type === "spontaneous" && slotInfo.current === 0) ||
      (slotInfo.type === "focus" && slotInfo.current === 0) ||
      (slotInfo.type === "staff" && slotInfo.current === 0) ||
      (slotInfo.type === "equipment" && parentItem?.system?.uses?.value === 0));

  return rankSpells.map((spell) =>
    toViewModel(spell, {
      castRank: getCastRank(spell, rankKey),
      expended,
    }),
  );
}

/**
 * Gets the cast rank for a spell based on its rank key.
 * @param {*} spell The spell for which to get the cast rank.
 * @param {*} rankKey The rank key for the spell.
 * @returns The cast rank for the spell.
 */
function getCastRank(spell, rankKey) {
  if (rankKey === "cantrips" || rankKey === "focus")
    // Cantrips use the actor's level divided by 2 rounded down.
    return Math.ceil(spell.parent.system.details.level.value / 2);
  return spell.system.location?.heightenedLevel ?? spell.system.level.value;
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
        key,
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
      ).sort((a, b) => a.name.localeCompare(b.name));

      const { traditionIcon, tradition, dc, attack, proficiency } =
        getEntryData(entry);

      rankMap.get(rankKey).push({
        entryId: key,
        entryName: collection.name,
        itemId: entry?._id ?? null,
        slotNum,
        slotInfo,
        spells: spellViewModels,
        traditionIcon,
        traditionName: tradition.charAt(0).toUpperCase() + tradition.slice(1),
        stats: {
          dc,
          attack,
          proficiency,
        },
      });
    }
  }

  injectSignatureVirtuals(rankMap, collections);
  return rankMap;
}
/**
 * Gets the data needed to render the source entry sub-header for a spellcasting entry, including the tradition icon, tradition name, and either DC or attack bonus depending on the entry's statistic.
 * @param {*} entry The spellcasting entry to extract the data from
 * @returns The data needed to render the source entry sub-header, including the tradition icon, tradition name, and either DC or attack bonus depending on the entry's statistic.
 */
function getEntryData(entry) {
  let tradition = "arcane";
  if (!entry.system) tradition = entry.statistic?.label?.toLowerCase();
  else if (entry.system.tradition?.value)
    tradition = entry.system.tradition.value;
  const traditionIcons = {
    arcane: "fa-book",
    primal: "fa-seedling",
    occult: "fa-ghost",
    divine: "fa-sun",
  };
  const traditionIcon = traditionIcons[tradition] || "fa-book";

  const stats = entry.statistic;
  const dc = stats.dc.value;
  const attack = stats.check.mod >= 0 ? `+${stats.check.mod}` : stats.check.mod;
  const proficiency = game.i18n.localize(
    CONFIG.PF2E.proficiencyLevels[stats.rank],
  );
  return { traditionIcon, tradition, dc, attack, proficiency };
}
