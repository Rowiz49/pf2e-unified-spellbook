/**
 * Builds staff entry data from pf2e dailies
 * @param {Actor} actor
 * @param {Item} entry
 * @returns The staff type and it's corresponding charges
 */
export function getStaffData(actor, entry) {
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
