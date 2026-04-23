import { extractSpells } from "./spell-extractor.js";
import { registerEventListeners } from "./spell-slot-listeners.js";
import { getOrdinalLabel } from "./utils.js";
import { addSettings } from "./settings.js";
/** Path to the Handlebars template used to render the unified spell list. */
const TEMPLATE_PATH =
  "modules/pf2e-unified-spellbook/templates/unified-spell-list.hbs";

/** Actor flag scope and key used to persist the active view. */
const FLAG_SCOPE = "pf2e-unified-spellbook";
const FLAG_KEY = "unifiedView";
const MODULE_ID = "pf2e-unified-spellbook";

// ---------------------------------------------------------------------------
// Handlebars helpers
// ---------------------------------------------------------------------------

/**
 * Registers all Handlebars helpers required by the unified spell list template.
 * Safe to call multiple times — Handlebars silently overwrites existing helpers
 * with the same name.
 */
function registerHelpers() {
  /**
   * Strict equality helper used in the template to branch on `slotInfo.type`.
   *
   * @example {{#if (unifiedEq slotInfo.type "prepared")}} … {{/if}}
   *
   * @param {*} a - Left-hand operand.
   * @param {*} b - Right-hand operand.
   * @returns {boolean} `true` when `a === b`.
   */
  Handlebars.registerHelper("unifiedEq", (a, b) => a === b);
  Handlebars.registerHelper("unifiedAnd", (a, b) => a && b);
  Handlebars.registerHelper("unifiedOr", (a, b) => a || b);
  Handlebars.registerHelper("unifiedNot", (a) => !a);
}

// ---------------------------------------------------------------------------
// Sheet hook
// ---------------------------------------------------------------------------

/**
 * Hook handler fired whenever a `CreatureSheetPF2e` renders.
 *
 * Injects a "Unified Rank View" toggle button and the rendered unified spell
 * list into the **Known Spells** tab of character sheets. The active view is
 * read from an actor flag ({@link FLAG_SCOPE}/{@link FLAG_KEY}) so it persists
 * across re-renders and reloads. Clicking the toggle writes the new value back
 * to the flag, which triggers a sheet re-render — no manual DOM swapping needed.
 *
 * Exits early for non-character actors.
 *
 * @param {CreatureSheetPF2e} sheet - The sheet application that just rendered.
 * @param {JQuery}            html  - The rendered HTML wrapped in a jQuery object.
 * @returns {Promise<void>}
 */
async function onRenderCreatureSheet(sheet, html) {
  const actor = sheet.actor;
  if (actor?.type !== "character") return;

  const rankMap = extractSpells(actor);
  const showFocusSpellsOnBottom = game.settings.get(
    MODULE_ID,
    "showFocusSpellsOnBottom",
  );

  // Sort: cantrips first, then numeric ranks, then optional focus at top or bottom.
  const sortedRanks = [...rankMap.keys()].sort((a, b) => {
    if (a === "focus") return showFocusSpellsOnBottom ? 1 : -1;
    if (b === "focus") return showFocusSpellsOnBottom ? -1 : 1;
    if (a === "cantrips") return -1;
    if (b === "cantrips") return 1;
    return Number.parseInt(a) - Number.parseInt(b);
  });

  const templateData = {
    ranks: sortedRanks.map((rankKey) => {
      const sources = rankMap.get(rankKey);

      // Extract focus slots if this is the focus rank
      let focusSlots = null;
      let rankLabel;

      if (rankKey === "focus") {
        const focusSource = sources.find((s) => s.slotInfo?.type === "focus");
        focusSlots = focusSource?.slotInfo?.slots ?? [];
        rankLabel = game.i18n.localize("pf2e-unified-spellbook.FocusSpells");
      } else if (rankKey === "cantrips") {
        rankLabel = game.i18n.localize("pf2e-unified-spellbook.Cantrips");
      } else {
        rankLabel = `${getOrdinalLabel(Number.parseInt(rankKey))} ${game.i18n.localize("pf2e-unified-spellbook.Rank")}`;
      }

      return {
        rankKey,
        rankLabel,
        isCantrip: rankKey === "cantrips",
        isFocus: rankKey === "focus",
        sources,
        focusSlots,
      };
    }),
  };

  // Render the external template and convert to a jQuery element.
  const renderedHtml = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH,
    templateData,
  );
  const unifiedEl = $(renderedHtml);

  const knownSpellsTab = html.find(".tab.known-spells");
  const defaultList = knownSpellsTab.find("ol.spellcastingEntry-list").first();
  const addEntryBtn = knownSpellsTab.find(
    'button.create-entry[data-action="spellcasting-create"]',
  );

  // Read the persisted view preference. Defaults to false (default view).
  const unified = actor.getFlag(FLAG_SCOPE, FLAG_KEY) ?? false;

  const toggleBtn = $(`
    <button type="button" class="blue" style="
      display: flex; align-items: center; gap: 6px;
      margin: 4px 8px 6px; width: calc(100% - 16px);
      padding: 4px 8px; font-size: 0.85em;
    ">
      <i class="fa-solid ${unified ? "fa-list" : "fa-book"}"></i>
      <span>${unified ? game.i18n.localize("pf2e-unified-spellbook.DefaultView") : game.i18n.localize("pf2e-unified-spellbook.UnifiedView")}</span>
    </button>
  `);

  defaultList.before(toggleBtn);
  defaultList.before(unifiedEl);

  // Apply the persisted state immediately on render.
  if (unified) {
    defaultList.hide();
    addEntryBtn.hide();
    unifiedEl.show();
    registerEventListeners(actor, html);
  }

  // On click, flip the flag. The flag update triggers a sheet re-render,
  // which re-runs this hook with the new value — no manual DOM toggling needed.
  toggleBtn.on("click", () => {
    actor.setFlag(FLAG_SCOPE, FLAG_KEY, !unified);
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

registerHelpers();
Hooks.once("init", () => {
  addSettings(MODULE_ID);
});
Hooks.on("renderActorSheetPF2e", onRenderCreatureSheet);
