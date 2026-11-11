// Only verified deployed entries belong here. Preview means the preview is new,
// not that its backend is available. Unreleased mail/claims features are omitted.
export const MENU_RELEASE = '1.0.0.4';
export const MENU_CHANGES = {
  'shared-inbox': {introducedIn: '1.0.0.4'},
  landsraad: {introducedIn: '1.0.0.4', preview: true},
  'council-motd': {introducedIn: '1.0.0.4'},
  'house-elections': {introducedIn: '1.0.0.4'},
  'imperial-elections': {introducedIn: '1.0.0.4'},
  applications: {introducedIn: '1.0.0.4'},
  'formal-council': {introducedIn: '1.0.0.4', preview: true},
  'imperial-command': {introducedIn: '1.0.0.4', preview: true},
  'site-profile': {updatedIn: '1.0.0.4'},
};
export function ribbonFor(page, release, changes = MENU_CHANGES) {
  const entry = changes[page];
  if (!release || !entry) return null;
  const label = entry.introducedIn === release ? 'NEW' : entry.updatedIn === release ? 'UPDATE' : null;
  return label ? {label, description: `${label === 'NEW' ? 'New' : 'Updated'} this release${entry.preview ? ' · design preview' : ''}`} : null;
}
export function paintMenuRibbons(root, release) {
  for (const link of root.querySelectorAll('.cp-panel-sidebar a[data-panel-page]')) {
    const value = ribbonFor(link.dataset.panelPage, release);
    let badge = link.querySelector('.cp-menu-ribbon');
    if (!value) {badge?.remove(); continue;}
    if (!badge) {badge = root.ownerDocument.createElement('span'); badge.className = 'cp-menu-ribbon'; link.append(badge);}
    if (badge.textContent !== value.label) badge.textContent = value.label;
    badge.dataset.kind = value.label.toLowerCase();
    badge.title = value.description;
    badge.setAttribute('aria-label', value.description);
  }
}
