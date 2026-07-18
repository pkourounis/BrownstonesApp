/** Job roles for the profile + roster dropdowns, drawn from the Toast job list. */
export const JOB_ROLES: string[] = [
  'Barista',
  'Cashier',
  'Counter Server',
  'Server',
  'Head Server',
  'Host',
  'Food Runner',
  'Drink Runner',
  'Runner',
  'Busser',
  'Expo',
  'Bagger',
  'Cook',
  'Chef',
  'Prep',
  'Dishwasher',
  'Floater',
  'Delivery Service Driver',
  'Training',
  'Shift Lead',
  'Floor Manager',
  'Shift Manager / Assistant Manager',
  'Manager',
  'General Manager',
  'Owner',
];

/** The role list with `current` appended if it isn't already a known role. */
export function jobRoleOptions(current?: string | null): string[] {
  if (current && !JOB_ROLES.includes(current)) return [...JOB_ROLES, current];
  return JOB_ROLES;
}
