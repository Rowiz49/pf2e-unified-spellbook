import { buildBaseViewModel } from "./spell-view-model.js";
/**
 * For spontaneous entries, injects virtual SpellViewModels for signature spells
 * at every rank above their native rank that has available slots (max > 0).
 *
 * @param {Map<string, SourceEntry[]>} rankMap
 * @param {Collection}                collections
 */
export function injectSignatureVirtuals(rankMap, collections) {
  const keys = [...collections.keys()];

  for (const key of keys) {
    if (key === "rituals") continue;
    const collection = collections.get(key);
    const entry = collection.entry;
    if (
      !(
        entry.system?.prepared.value === "spontaneous" ||
        entry.system?.prepared.flexible
      )
    )
      continue;

    const spells = [...collection.values()];
    const signatures = spells.filter((s) => s.system.location?.signature);
    if (!signatures.length) continue;

    for (const spell of signatures) {
      addVirtualSpell(spell, entry, rankMap, key, collection);
    }
  }
}
/**
 * Adds a virtual spell to the unified spell list. These are heightened signature spells that don't exist as actual items on the actor but are displayed in the unified spell list when their base spell is signature and there are higher-level slots available.
 * @param {*} spell Spell item that is the source of the virtual spell
 * @param {*} entry Entry that provides the slots to determine which virtual spells to create
 * @param {*} rankMap Map of rank keys to spell sources, used to find the correct group for the virtual spell
 * @param {*} key The key of the collection this spell belongs to (e.g. "spells", "focusSpells"), used to identify the source entry in the rankMap
 * @param {*} collection The collection this spell belongs to, used to get the entry name for the virtual spell source
 */
function addVirtualSpell(spell, entry, rankMap, key, collection) {
  const isFlexible = entry.system.prepared.flexible;
  const originalRank = spell.system.level.value;
  const originalLocationRank =
    spell.system.location?.heightenedLevel ?? originalRank;
  console.log(spell.system, { originalRank, originalLocationRank }); // DEBUG
  for (const [slotKey, slot] of Object.entries(entry.system.slots)) {
    const slotNum = Number.parseInt(slotKey.replace("slot", ""));
    if (
      slotNum === 0 ||
      slotNum < originalRank ||
      slotNum == originalLocationRank ||
      slot.max === 0
    )
      continue;

    const rankKey = String(slotNum);
    if (!rankMap.has(rankKey)) continue;

    const virtualVm = buildBaseViewModel(spell, key, rankKey, {
      castRank: slotNum,
      prepType: "spontaneous",
      expended: slot.value === 0,
      isSignature: true,
      isVirtual: true,
      isFlexible,
    });

    const sources = rankMap.get(rankKey);
    const existingSource = sources.find((s) => s.entryId === key);

    if (existingSource) {
      existingSource.spells.push(virtualVm);

      sortVirtualsInPlace(existingSource.spells);
    } else {
      sources.push({
        entryId: key,
        entryName: collection.name,
        itemId: entry?._id ?? null,
        slotNum,
        slotInfo: {
          type: "spontaneous",
          current: slot.value,
          max: slot.max,
        },
        spells: [virtualVm],
      });
    }
  }
}

/**
 * Sorts virtual spells in place while maintaining the order of non-virtual spells.
 * @param {SpellViewModel[]} spells - The array of spell view models to sort.
 */
function sortVirtualsInPlace(spells) {
  // Extract virtual spells
  const virtuals = spells.filter((s) => s.isVirtual);

  // Sort only the virtuals
  virtuals.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  // Reinsert them into their original positions
  let vIndex = 0;
  for (let i = 0; i < spells.length; i++) {
    if (spells[i].isVirtual) {
      spells[i] = virtuals[vIndex++];
    }
  }
}
