/**
 * The logo new content starts with: the starter templates, the editor's
 * default document and the header and footer blocks. A rendered email names
 * its images by absolute URL on our own host, so every message ever sent keeps
 * loading whatever file is at that path. A rebrand therefore adds a file under
 * a new name and points new content at it; a file that has been used is never
 * overwritten, or mail already delivered changes under the reader.
 *
 * The file is a square with the mark centred on transparent bands above and
 * below it, because the Logo block and the blocks that set an image's size give
 * it a width and a height of the same number, and a mark that is not square
 * would be stretched to fill them.
 */
export const EMAIL_MARK_SRC = '/brand/temply-mark-email.png';

/**
 * The mark for a slot under 24px, where the brand's guideline says to use the
 * app icon file and not the bare mark. The slash menu's inline image starts at
 * 20 by 20, so its placeholder is this. Same rule as above: the file is linked
 * from mail by URL and is never replaced in place.
 */
export const EMAIL_ICON_SRC = '/brand/temply-app-icon-gradient-32.png';
