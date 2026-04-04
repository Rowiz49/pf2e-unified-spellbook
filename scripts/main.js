Hooks.on("renderCreatureSheetPF2e", async (sheet, html) => {
  const actor = sheet.actor;
  const isPC = actor.type !== "character";
  if (!actor || isPC) return;
  console.log(sheet);
  console.log(actor);
});
