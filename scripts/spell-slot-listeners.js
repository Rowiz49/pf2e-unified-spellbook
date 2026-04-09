export function registerFocusPointListener(actor, html) {
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

  html[0].addEventListener("change", (event) => {
    const input = event.target.closest(
      "input[data-item-property][data-item-id]",
    );
    if (!input) return;
    const item = actor.items.get(input.dataset.itemId);
    if (!item) return;
    item.update({ [input.dataset.itemProperty]: Number(input.value) });
  });

  html[0].addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='reset-charges-unified']");
    if (!btn) return;

    const input = html[0].querySelector("input[data-action='change-charges']");
    if (!input) return;

    const max = Number(input.max);
    input.value = String(max);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

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
