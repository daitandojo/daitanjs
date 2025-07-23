// knowledge/src/initials/index.js
import { getLogger } from '@daitanjs/development';

const initialsLogger = getLogger('daitan-knowledge-initials');

initialsLogger.info(
  'Initial user data module loaded. Contains a default user object structure.'
);

// Review of the data structure for initialUser:
// - This object provides a default/template structure for a user.
// - Fields are reasonably named (though `firstname` and `lastname` could be camelCased to `firstName` and `lastName` for JS convention, the original is preserved).
// - Default values are provided for most fields (e.g., "en" for language, false for booleans, [0,0] for coordinates).
// - `userid` is present but empty; applications would typically populate this with a generated ID (e.g., UUID, database ID, Firebase UID).
// - `requests` is an empty array, suitable for storing related request IDs or objects.
// - `root` (boolean) indicates an admin/superuser status.

// The structure is straightforward and serves as a good starting point for new user objects.
// No dynamic code to refactor here.
// Consistency in casing (e.g. firstname vs. termsAccepted) could be a minor point for future cleanup if desired,
// but for this refactor, the original data is preserved.

export const initialUser = {
  userid: '',
  username: '',
  email: '',
  firstname: '',
  lastname: '',
  language: 'en',
  country: 'GB',
  mobile: '',
  verified: false,
  termsaccepted: false,
  location: '',
  coordinates: [0, 0],
  requests: [],
  root: false,
};
