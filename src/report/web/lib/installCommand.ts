import { INSTALL_SCRIPT_URL } from '../../../urls.ts';

// The one-off run command, kept in sync with scripts/analyze.sh and the README.
export const INSTALL_COMMAND = `bash -c "$(curl -fsSL ${INSTALL_SCRIPT_URL})"`;
