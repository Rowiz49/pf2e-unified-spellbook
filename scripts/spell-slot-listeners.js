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
}
